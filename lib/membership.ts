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

export async function getMembershipSummary(supabase: SupabaseClient, profileId: string): Promise<MembershipSummary> {
  const { data: profile, error: profileError } = await supabase.from('profiles').select('id,email,tier,is_admin').eq('id', profileId).single();
  if (profileError) throw profileError;
  const profileTier = cleanTier(profile?.tier);

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
  const effectiveTier = profile?.is_admin ? 'admin' : betterTier(profileTier, eventTier);

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
    provider: latestEvent?.provider || (profile?.is_admin ? 'admin' : 'profile'),
    status: latestEvent?.status || (profile?.is_admin ? 'active' : 'profile'),
    provider_customer_id: latestEvent?.provider_customer_id || null,
    provider_subscription_id: latestEvent?.provider_subscription_id || null,
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
