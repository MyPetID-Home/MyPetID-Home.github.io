import type { SupabaseClient } from '@supabase/supabase-js';

export type MembershipTier = 'free' | 'basic' | 'silver' | 'gold' | 'diamond' | 'admin';

export type MembershipSummary = {
  profile_id: string;
  email: string | null;
  tier: MembershipTier;
  effective_tier: MembershipTier;
  is_admin: boolean;
  provider: string;
  status: string;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  active_grant: Record<string, unknown> | null;
  limits: {
    max_tags: number | null;
    max_users: number | null;
    scan_tracking_enabled: boolean;
  };
  usage: {
    active_tags: number;
    pets: number;
    helpers: number;
  };
  remaining: {
    tags: number | null;
    users: number | null;
  };
  tier_record: Record<string, unknown> | null;
  latest_event: Record<string, unknown> | null;
};

const tierOrder: MembershipTier[] = ['free', 'basic', 'silver', 'gold', 'diamond', 'admin'];
const activeStatuses = new Set(['active', 'trialing']);

function cleanTier(value: unknown): MembershipTier {
  const tier = String(value || 'free').toLowerCase() as MembershipTier;
  return tierOrder.includes(tier) ? tier : 'free';
}

function betterTier(a: MembershipTier, b: MembershipTier) {
  return tierOrder.indexOf(a) >= tierOrder.indexOf(b) ? a : b;
}

function remaining(limit: number | null, used: number) {
  return limit === null ? null : Math.max(0, limit - used);
}

export function canUseAllowance(limit: number | null, used: number) {
  return limit === null || used < limit;
}

/** Result of the mypetid_plan_limits() database function (2026-10-entitlements.sql). */
export type PlanLimits = {
  tier: MembershipTier;
  paid: boolean;
  max_tags: number;
  max_users: number;
  scan_tracking: boolean;
  source: string;
  paid_through: string | null;
};

/** True when a Supabase error means the RPC is not deployed yet (migration not applied). */
export function isMissingFunctionError(error: { code?: string; message?: string } | null | undefined, name: string) {
  if (!error) return false;
  const message = String(error.message || '');
  return error.code === 'PGRST202' || error.code === '42883' || message.includes(name) || message.includes('schema cache');
}

/** Effective plan decided by the database, or null when the function is not deployed yet. */
export async function fetchPlanLimits(supabase: SupabaseClient, profileId: string): Promise<PlanLimits | null> {
  const { data, error } = await supabase.rpc('mypetid_plan_limits', { p_uid: profileId });
  if (error) {
    if (isMissingFunctionError(error, 'mypetid_plan_limits')) return null;
    throw error;
  }
  if (!data || typeof data !== 'object') return null;
  const row = data as Record<string, unknown>;
  return {
    tier: cleanTier(row.tier),
    paid: Boolean(row.paid),
    max_tags: Number(row.max_tags ?? 0),
    max_users: Number(row.max_users ?? 1),
    scan_tracking: Boolean(row.scan_tracking),
    source: String(row.source || 'free'),
    paid_through: row.paid_through ? String(row.paid_through) : null,
  };
}

/**
 * Writes the effective tier back to profiles.tier (admins untouched) with the
 * mypetid_sync_profile_tier() function. Until the migration is applied, falls back to
 * setting `fallbackTier` directly when one is given. Service-role client only.
 */
export async function syncProfileTier(supabase: SupabaseClient, profileId: string | null | undefined, fallbackTier?: string) {
  if (!profileId) return null;
  const { data, error } = await supabase.rpc('mypetid_sync_profile_tier', { p_uid: profileId });
  if (!error) return typeof data === 'string' ? data : null;
  if (!isMissingFunctionError(error, 'mypetid_sync_profile_tier')) throw error;
  if (!fallbackTier) return null;
  await supabase.from('profiles').update({ tier: fallbackTier }).eq('id', profileId).neq('tier', 'admin');
  return fallbackTier;
}

export async function getMembershipSummary(supabase: SupabaseClient, profileId: string): Promise<MembershipSummary> {
  const { data: profile, error: profileError } = await supabase.from('profiles').select('id,email,tier,is_admin').eq('id', profileId).single();
  if (profileError) throw profileError;
  const profileTier = cleanTier(profile?.tier);
  const planLimits = await fetchPlanLimits(supabase, profileId);

  const { data: latestEvents, error: eventError } = await supabase
    .from('membership_events')
    .select('*')
    .eq('profile_id', profileId)
    .in('status', Array.from(activeStatuses))
    .order('updated_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(5);
  if (eventError) throw eventError;

  const latestEvent = (latestEvents || [])[0] || null;
  const eventTier = cleanTier(latestEvent?.tier);

  const { data: activeGrants, error: grantError } = await supabase
    .from('membership_grants')
    .select('*')
    .eq('profile_id', profileId)
    .eq('status', 'active')
    .lte('starts_at', new Date().toISOString())
    .order('expires_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(10);
  if (grantError && !String(grantError.message || '').includes('membership_grants')) throw grantError;
  const nowMs = Date.now();
  const activeGrant = (activeGrants || [])
    .filter((grant: any) => !grant.expires_at || new Date(grant.expires_at).getTime() > nowMs)
    .sort((a: any, b: any) => tierOrder.indexOf(cleanTier(b.tier)) - tierOrder.indexOf(cleanTier(a.tier)))[0] || null;
  const grantTier = cleanTier(activeGrant?.tier);
  // The database function is authoritative (it checks paid-through dates); the
  // TypeScript fallback below is only used until 2026-10-entitlements.sql is applied.
  const effectiveTier: MembershipTier = profile?.is_admin ? 'admin' : planLimits ? planLimits.tier : betterTier(betterTier(profileTier, eventTier), grantTier);

  const { data: tier, error: tierError } = await supabase.from('membership_tiers').select('*').eq('tier', effectiveTier).maybeSingle();
  if (tierError) throw tierError;
  const fallback = effectiveTier === 'admin' ? { max_tags: null, max_users: null, scan_tracking_enabled: true } : { max_tags: 0, max_users: 1, scan_tracking_enabled: false };
  const maxTags = profile?.is_admin ? null : Number.isFinite(Number(tier?.max_tags)) ? Number(tier?.max_tags) : fallback.max_tags;
  const maxUsers = profile?.is_admin ? null : Number.isFinite(Number(tier?.max_users)) ? Number(tier?.max_users) : fallback.max_users;
  const scanTracking = profile?.is_admin ? true : Boolean(tier?.scan_tracking_enabled ?? fallback.scan_tracking_enabled);

  const { count: tagCount, error: tagError } = await supabase.from('tags').select('id', { count: 'exact', head: true }).eq('created_by', profileId).not('pet_id', 'is', null);
  if (tagError) throw tagError;
  const { count: petCount, error: petError } = await supabase.from('pets').select('id', { count: 'exact', head: true }).eq('owner_id', profileId);
  if (petError) throw petError;
  const { count: helperCount, error: inviteError } = await supabase.from('dog_pack_invites').select('id', { count: 'exact', head: true }).eq('inviter_profile_id', profileId).eq('status', 'active');
  if (inviteError) throw inviteError;

  const activeTags = tagCount || 0;
  const pets = petCount || 0;
  const helpers = helperCount || 0;
  return {
    profile_id: profileId,
    email: profile?.email || null,
    tier: profileTier,
    effective_tier: effectiveTier,
    is_admin: Boolean(profile?.is_admin),
    provider: planLimits && !profile?.is_admin
      ? planLimits.source === 'grant' && activeGrant?.source ? String(activeGrant.source) : planLimits.source
      : activeGrant?.source ? String(activeGrant.source) : latestEvent?.provider || (profile?.is_admin ? 'admin' : 'profile'),
    status: planLimits && !profile?.is_admin
      ? planLimits.paid ? `active${planLimits.paid_through ? ` until ${planLimits.paid_through}` : ''}` : latestEvent ? 'expired' : 'free'
      : activeGrant ? `active${activeGrant.expires_at ? ` until ${activeGrant.expires_at}` : ''}` : latestEvent?.status || (profile?.is_admin ? 'active' : 'profile'),
    provider_customer_id: latestEvent?.provider_customer_id || null,
    provider_subscription_id: latestEvent?.provider_subscription_id || null,
    active_grant: activeGrant || null,
    limits: { max_tags: maxTags, max_users: maxUsers, scan_tracking_enabled: scanTracking },
    usage: { active_tags: activeTags, pets, helpers },
    remaining: { tags: remaining(maxTags, activeTags), users: remaining(maxUsers, helpers + 1) },
    tier_record: tier || null,
    latest_event: latestEvent || null,
  };
}

export function assertTagAllowance(summary: MembershipSummary) {
  if (!summary.limits.scan_tracking_enabled) throw new Error('Scan tracking requires an active Basic, Silver, Gold, Diamond, Patreon, Stripe, or admin membership.');
  if (!canUseAllowance(summary.limits.max_tags, summary.usage.active_tags)) throw new Error(`Your ${summary.effective_tier} plan has no remaining active tag slots. Upgrade or deactivate another tag first.`);
}

export function assertHelperAllowance(summary: MembershipSummary, requestedInvites = 1) {
  const usedHelpers = summary.usage.helpers;
  const limit = summary.limits.max_users;
  if (limit !== null && usedHelpers + 1 + requestedInvites > limit) throw new Error(`Your ${summary.effective_tier} plan allows ${limit} total user/helper slot(s). Upgrade before inviting more helpers.`);
}
