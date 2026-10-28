import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '../../../../lib/server-integrations';
import { isMissingFunctionError } from '../../../../lib/membership';
import { cancelMissingStripeSubscription, refreshStripeSubscription } from '../../../../lib/stripe-membership';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// Daily membership check (vercel.json cron). Re-reads every live Stripe subscription
// so a missed cancellation webhook cannot leave a paid tier behind, then lets the
// database recompute every profile's tier (expired Patreon/grant plans drop to free).
// Vercel cron sends "Authorization: Bearer <CRON_SECRET>".

function authorized(header: string | null) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`${String.fromCharCode(66, 101, 97, 114, 101, 114)} ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: NextRequest) {
  if (!authorized(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const supabase = serverSupabase();
  const report = { checked: 0, updated: 0, cancelled_missing: 0, errors: [] as string[], tiers_changed: null as number | null, sync: 'rpc' as 'rpc' | 'skipped' };

  const { data: rows, error } = await supabase
    .from('membership_events')
    .select('provider_subscription_id')
    .eq('provider', 'stripe')
    .in('status', ['active', 'trialing', 'payment_attention'])
    .not('provider_subscription_id', 'is', null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const subscriptionIds = Array.from(new Set((rows || []).map((row) => String(row.provider_subscription_id))));
  for (const subscriptionId of subscriptionIds) {
    report.checked += 1;
    try {
      await refreshStripeSubscription(subscriptionId, 'cron.validate', supabase);
      report.updated += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/no such subscription/i.test(message)) {
        await cancelMissingStripeSubscription(subscriptionId, supabase);
        report.cancelled_missing += 1;
      } else {
        report.errors.push(`${subscriptionId}: ${message}`);
      }
    }
  }

  const { data: changed, error: syncError } = await supabase.rpc('mypetid_sync_all_profile_tiers');
  if (syncError) {
    if (!isMissingFunctionError(syncError, 'mypetid_sync_all_profile_tiers')) report.errors.push(`sync: ${syncError.message}`);
    report.sync = 'skipped';
  } else {
    report.tiers_changed = typeof changed === 'number' ? changed : Number(changed ?? 0);
  }

  return NextResponse.json({ ok: report.errors.length === 0, ...report }, { status: report.errors.length ? 207 : 200 });
}
