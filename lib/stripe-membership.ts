import type { SupabaseClient } from '@supabase/supabase-js';
import { serverSupabase, stripeRetrieve } from './server-integrations';
import { syncProfileTier } from './membership';

// Shared by /api/stripe/webhook and /api/cron/validate-memberships: writes one Stripe
// subscription's state (status + paid-through time) to membership_events, then resyncs
// profiles.tier from the database's effective tier.

type StripeObject = Record<string, any>;

const paidStatuses = new Set(['active', 'trialing']);

/** Stripe subscription status -> membership_events.status. */
export function membershipStatusFromStripe(stripeStatus?: string, eventType?: string) {
  if (eventType === 'customer.subscription.deleted') return 'cancelled';
  if (stripeStatus === 'active' || stripeStatus === 'trialing') return stripeStatus;
  if (stripeStatus === 'past_due' || stripeStatus === 'incomplete') return 'payment_attention';
  if (stripeStatus === 'canceled' || stripeStatus === 'unpaid' || stripeStatus === 'incomplete_expired') return 'cancelled';
  if (stripeStatus === 'paused') return 'paused';
  return stripeStatus || 'pending';
}

function epochToIso(value: unknown) {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000).toISOString() : null;
}

/** Paid-through time of a subscription (top-level field on older API versions, per item on newer ones). */
export function subscriptionPeriodEnd(subscription: StripeObject) {
  const direct = epochToIso(subscription?.current_period_end);
  if (direct) return direct;
  const ends = (subscription?.items?.data || []).map((item: StripeObject) => Number(item?.current_period_end)).filter((value: number) => Number.isFinite(value) && value > 0);
  return ends.length ? epochToIso(Math.max(...ends)) : null;
}

/** Latest line period end on an invoice. */
export function invoicePeriodEnd(invoice: StripeObject) {
  const ends = (invoice?.lines?.data || []).map((line: StripeObject) => Number(line?.period?.end)).filter((value: number) => Number.isFinite(value) && value > 0);
  return ends.length ? epochToIso(Math.max(...ends)) : epochToIso(invoice?.period_end);
}

/** Subscription id referenced by an invoice (field moved under parent on newer API versions). */
export function invoiceSubscriptionId(invoice: StripeObject): string | null {
  if (typeof invoice?.subscription === 'string') return invoice.subscription;
  if (typeof invoice?.subscription?.id === 'string') return invoice.subscription.id;
  const parent = invoice?.parent?.subscription_details?.subscription;
  if (typeof parent === 'string') return parent;
  const line = (invoice?.lines?.data || []).find((item: StripeObject) => item?.parent?.subscription_item_details?.subscription || typeof item?.subscription === 'string');
  return line?.parent?.subscription_item_details?.subscription || line?.subscription || null;
}

async function tierFromPrice(supabase: SupabaseClient, subscription: StripeObject) {
  const priceId = subscription?.items?.data?.[0]?.price?.id;
  if (!priceId) return null;
  const { data } = await supabase.from('membership_tiers').select('tier').eq('stripe_price_id', priceId).maybeSingle();
  return data?.tier ? String(data.tier) : null;
}

async function findMembershipRow(supabase: SupabaseClient, eventId: string | null, subscriptionId: string | null) {
  if (eventId) {
    const { data } = await supabase.from('membership_events').select('id,profile_id,tier,metadata').eq('id', eventId).maybeSingle();
    if (data) return data;
  }
  if (subscriptionId) {
    const { data } = await supabase.from('membership_events').select('id,profile_id,tier,metadata').eq('provider', 'stripe').eq('provider_subscription_id', subscriptionId)
      .order('updated_at', { ascending: false }).limit(1).maybeSingle();
    if (data) return data;
  }
  return null;
}

/**
 * Upserts the membership_events row for one Stripe subscription object and resyncs the
 * member's profile tier. `eventType` is recorded in metadata ('cron.validate' for the sweep).
 */
export async function applyStripeSubscription(subscription: StripeObject, eventType: string, supabase: SupabaseClient = serverSupabase()) {
  const metadata = subscription?.metadata || {};
  const subscriptionId = typeof subscription?.id === 'string' ? subscription.id : null;
  const customerId = typeof subscription?.customer === 'string' ? subscription.customer : subscription?.customer?.id || null;
  const status = membershipStatusFromStripe(subscription?.status, eventType);
  const periodEnd = subscriptionPeriodEnd(subscription);
  const existing = await findMembershipRow(supabase, metadata.membership_event_id || null, subscriptionId);
  const profileId = metadata.profile_id || existing?.profile_id || null;
  const tier = metadata.tier || existing?.tier || await tierFromPrice(supabase, subscription);
  const nextMetadata = {
    ...(existing?.metadata || {}),
    stripe_event_type: eventType,
    stripe_object_id: subscriptionId,
    stripe_status: subscription?.status || null,
    current_period_end: periodEnd,
    cancel_at_period_end: Boolean(subscription?.cancel_at_period_end),
    validated_at: new Date().toISOString(),
  };
  const row = {
    profile_id: profileId,
    provider_customer_id: customerId,
    provider_subscription_id: subscriptionId,
    tier,
    status,
    metadata: nextMetadata,
    updated_at: new Date().toISOString(),
  };
  if (existing) await supabase.from('membership_events').update(row).eq('id', existing.id);
  else if (profileId || subscriptionId || customerId) await supabase.from('membership_events').insert({ ...row, provider: 'stripe' });

  await syncProfileTier(supabase, profileId, paidStatuses.has(status) && tier ? tier : status === 'cancelled' || status === 'payment_attention' ? 'free' : undefined);
  return { profileId, subscriptionId, status, tier, currentPeriodEnd: periodEnd };
}

/** Fetches a subscription from Stripe and applies it. */
export async function refreshStripeSubscription(subscriptionId: string, eventType: string, supabase: SupabaseClient = serverSupabase()) {
  const subscription = await stripeRetrieve(`/subscriptions/${encodeURIComponent(subscriptionId)}`);
  return applyStripeSubscription(subscription, eventType, supabase);
}

/** Marks every row for a subscription Stripe no longer knows about as cancelled. */
export async function cancelMissingStripeSubscription(subscriptionId: string, supabase: SupabaseClient = serverSupabase()) {
  const { data: rows } = await supabase.from('membership_events').select('id,profile_id,metadata').eq('provider', 'stripe').eq('provider_subscription_id', subscriptionId);
  for (const row of rows || []) {
    await supabase.from('membership_events').update({
      status: 'cancelled',
      metadata: { ...(row.metadata || {}), stripe_status: 'missing', validated_at: new Date().toISOString() },
      updated_at: new Date().toISOString(),
    }).eq('id', row.id);
  }
  const profiles = Array.from(new Set((rows || []).map((row) => row.profile_id).filter(Boolean))) as string[];
  for (const profileId of profiles) await syncProfileTier(supabase, profileId, 'free');
  return profiles;
}
