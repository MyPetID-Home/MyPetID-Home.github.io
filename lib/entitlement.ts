'use client';

import { useCallback, useEffect, useState } from 'react';
import { isAdminEmail, supabase } from './supabase';

// Server-decided plan for the signed-in member. The source of truth is the
// my_entitlement() RPC (docs/migrations/2026-10-entitlements.sql), which checks
// paid-through dates; never a tier kept in localStorage. Until that migration is
// applied, falls back to profiles.tier (which RLS stops users from changing).

export type EntitlementTier = 'free' | 'basic' | 'silver' | 'gold' | 'diamond' | 'admin';

export type Entitlement = {
  tier: EntitlementTier;
  paid: boolean;
  maxUsers: number;
  maxTags: number;
  scanTracking: boolean;
  source: string;
  paidThrough: string | null;
};

export type UseEntitlement = Entitlement & {
  loading: boolean;
  error: string | null;
  refresh: () => Promise<Entitlement>;
};

const tierOrder: EntitlementTier[] = ['free', 'basic', 'silver', 'gold', 'diamond', 'admin'];

// Mirrors membership_tiers; used only by the profiles.tier fallback.
const fallbackLimits: Record<EntitlementTier, { maxTags: number; maxUsers: number }> = {
  free: { maxTags: 0, maxUsers: 1 },
  basic: { maxTags: 1, maxUsers: 1 },
  silver: { maxTags: 1, maxUsers: 2 },
  gold: { maxTags: 2, maxUsers: 1 },
  diamond: { maxTags: 3, maxUsers: 2 },
  admin: { maxTags: 999, maxUsers: 999 },
};

export const freeEntitlement: Entitlement = { tier: 'free', paid: false, maxUsers: 1, maxTags: 0, scanTracking: false, source: 'free', paidThrough: null };

function cleanTier(value: unknown): EntitlementTier {
  const tier = String(value || 'free').toLowerCase() as EntitlementTier;
  return tierOrder.includes(tier) ? tier : 'free';
}

function fromTier(tier: EntitlementTier, source: string): Entitlement {
  return { tier, paid: tier !== 'free', ...fallbackLimits[tier], scanTracking: tier !== 'free', source, paidThrough: null };
}

/** True when `tier` is at least `minimum` in the free < basic < silver < gold < diamond < admin order. */
export function tierAtLeast(tier: EntitlementTier, minimum: EntitlementTier) {
  return tierOrder.indexOf(tier) >= tierOrder.indexOf(minimum);
}

/** True when the plan allows `users` total people (owner + helpers). */
export function allowsUsers(entitlement: Pick<Entitlement, 'maxUsers'>, users: number) {
  return entitlement.maxUsers >= users;
}

/** True when the plan allows `tags` active tags. */
export function allowsTags(entitlement: Pick<Entitlement, 'maxTags'>, tags: number) {
  return entitlement.maxTags >= tags;
}

/** Lowest paid tier whose user allowance covers `users` (null when none does). */
export function requiresTier(users: number): EntitlementTier | null {
  return (['basic', 'silver', 'gold', 'diamond'] as EntitlementTier[]).find((tier) => fallbackLimits[tier].maxUsers >= users) || null;
}

// One cached answer per signed-in user for the page session.
let cache: { userId: string; value: Entitlement } | null = null;
let inflight: { userId: string; promise: Promise<Entitlement> } | null = null;

function isMissingRpc(error: { code?: string; message?: string }) {
  const message = String(error.message || '');
  return error.code === 'PGRST202' || error.code === '42883' || message.includes('my_entitlement') || message.includes('schema cache');
}

async function loadEntitlement(userId: string, email: string | null | undefined): Promise<Entitlement> {
  if (!supabase) return freeEntitlement;
  const { data, error } = await supabase.rpc('my_entitlement');
  if (!error && data && typeof data === 'object') {
    const row = data as Record<string, unknown>;
    const tier = cleanTier(row.tier);
    return {
      tier,
      paid: Boolean(row.paid),
      maxUsers: Number(row.max_users ?? fallbackLimits[tier].maxUsers),
      maxTags: Number(row.max_tags ?? fallbackLimits[tier].maxTags),
      scanTracking: Boolean(row.scan_tracking),
      source: String(row.source || 'free'),
      paidThrough: row.paid_through ? String(row.paid_through) : null,
    };
  }
  if (error && !isMissingRpc(error)) throw new Error(error.message);

  // Migration not applied yet: profiles.tier / is_admin for this user.
  const { data: profile, error: profileError } = await supabase.from('profiles').select('tier,is_admin').eq('id', userId).maybeSingle();
  if (profileError) throw new Error(profileError.message);
  if (profile?.is_admin || isAdminEmail(email)) return fromTier('admin', 'admin');
  return fromTier(cleanTier(profile?.tier), 'profile');
}

/** Fetches (or returns the cached) entitlement for the signed-in user. `force` skips the cache. */
export async function getEntitlement(force = false): Promise<Entitlement> {
  if (!supabase) return freeEntitlement;
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) {
    cache = null;
    return freeEntitlement;
  }
  if (!force && cache?.userId === user.id) return cache.value;
  if (!force && inflight?.userId === user.id) return inflight.promise;
  const promise = loadEntitlement(user.id, user.email).then((value) => {
    cache = { userId: user.id, value };
    return value;
  }).finally(() => {
    if (inflight?.promise === promise) inflight = null;
  });
  inflight = { userId: user.id, promise };
  return promise;
}

/** Drops the cached entitlement (call after checkout, coupon redemption, or sign-out). */
export function clearEntitlementCache() {
  cache = null;
  inflight = null;
}

/**
 * React hook: { loading, error, tier, paid, maxUsers, maxTags, scanTracking, source, paidThrough, refresh }.
 * Reloads when the signed-in user changes; refresh() bypasses the cache.
 */
export function useEntitlement(): UseEntitlement {
  const [state, setState] = useState<Entitlement>(cache?.value || freeEntitlement);
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force: boolean) => {
    setLoading(true);
    try {
      const value = await getEntitlement(force);
      setState(value);
      setError(null);
      return value;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not check your plan.');
      return cache?.value || freeEntitlement;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || (event === 'SIGNED_IN' && session?.user.id !== cache?.userId)) {
        clearEntitlementCache();
        void load(true);
      }
    });
    return () => data.subscription.unsubscribe();
  }, [load]);

  const refresh = useCallback(() => load(true), [load]);
  return { ...state, loading, error, refresh };
}
