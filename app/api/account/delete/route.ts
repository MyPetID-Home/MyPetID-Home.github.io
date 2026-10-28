import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isAdminEmail } from '../../../../lib/supabase';
import { serverSupabase, stripeList, stripeRequest, stripeRetrieve, userFromBearer } from '../../../../lib/server-integrations';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/account/delete   body { confirm: 'DELETE' }   Authorization: bearer access token
 *
 * Permanently deletes the signed-in account:
 *   1. refuses unless the user signed in within the last 15 minutes, and refuses admin accounts
 *   2. cancels any live Stripe subscriptions (skipped when Stripe is not configured; a Stripe
 *      error aborts the deletion so nobody keeps getting billed for a deleted account)
 *   3. removes the user's files under <uid>/ in pet-photos, tag-assets, profile-images, medical-documents
 *   4. unlinks tags (pet_id/created_by null, status unassigned; the physical tag record stays)
 *   5. deletes scan reports about the user's dogs, then the auth user. Every other row goes with
 *      it through FK cascades (auth.users -> profiles -> pets, walks, documents, notifications,
 *      households, ...). Billing records (membership_events, tag_orders) and the audit log are kept
 *      with profile_id set to null.
 *   6. writes account_activity_log rows (requested / completed)
 */

const RECENT_SIGN_IN_MS = 15 * 60 * 1000;
const BUCKETS = ['pet-photos', 'tag-assets', 'profile-images', 'medical-documents'];
const LIVE_STRIPE_STATUSES = new Set(['active', 'trialing', 'past_due', 'unpaid', 'incomplete']);

class UserFacingError extends Error {
  constructor(message: string, public status = 400, public code = 'error') { super(message); }
}

function jwtPayload(token: string): Record<string, any> {
  try {
    const part = token.split('.')[1] || '';
    return JSON.parse(Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  } catch {
    return {};
  }
}

/** When the user last actually authenticated (not when the access token was refreshed). */
function authenticatedAt(token: string, lastSignInAt?: string | null): number | null {
  const payload = jwtPayload(token);
  // Supabase puts the original sign-in time of each method in amr[].timestamp (seconds); it is
  // carried over on refresh, unlike iat which changes every refresh.
  const amr = Array.isArray(payload.amr) ? payload.amr : [];
  const stamps = amr.map((entry: any) => Number(entry?.timestamp)).filter((n: number) => Number.isFinite(n) && n > 0);
  if (stamps.length) return Math.max(...stamps) * 1000;
  const lastSignIn = lastSignInAt ? Date.parse(lastSignInAt) : NaN;
  return Number.isFinite(lastSignIn) ? lastSignIn : null;
}

function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY || process.env.MYPETID_STRIPE_SECRET_KEY || process.env.MYPETID_STRIPE_RESTRICTED_KEY);
}

async function cancelStripe(supabase: SupabaseClient, uid: string) {
  const { data: events, error } = await supabase.from('membership_events')
    .select('provider_customer_id,provider_subscription_id')
    .eq('profile_id', uid).eq('provider', 'stripe');
  if (error) throw error;
  const customers = new Set<string>();
  const subscriptions = new Set<string>();
  (events || []).forEach((row: { provider_customer_id: string | null; provider_subscription_id: string | null }) => {
    if (row.provider_customer_id?.startsWith('cus_')) customers.add(row.provider_customer_id);
    if (row.provider_subscription_id?.startsWith('sub_')) subscriptions.add(row.provider_subscription_id);
  });
  if (!customers.size && !subscriptions.size) return { cancelled: 0, skipped: false };
  if (!stripeConfigured()) return { cancelled: 0, skipped: true };

  const live = new Set<string>();
  for (const customer of customers) {
    const list = await stripeList('/subscriptions', { customer, status: 'all', limit: 100 });
    (list?.data || []).forEach((sub: { id: string; status: string }) => { if (LIVE_STRIPE_STATUSES.has(sub.status)) live.add(sub.id); });
  }
  for (const id of subscriptions) {
    if (live.has(id)) continue;
    try {
      const sub = await stripeRetrieve(`/subscriptions/${encodeURIComponent(id)}`);
      if (LIVE_STRIPE_STATUSES.has(sub?.status)) live.add(id);
    } catch { /* already gone */ }
  }
  for (const id of live) {
    await stripeRequest(`/subscriptions/${encodeURIComponent(id)}`, {}, 'DELETE');
  }
  return { cancelled: live.size, skipped: false };
}

async function listFiles(supabase: SupabaseClient, bucket: string, prefix: string, depth = 0): Promise<string[]> {
  if (depth > 6) return [];
  const paths: string[] = [];
  for (let offset = 0; offset < 20000; offset += 1000) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000, offset });
    if (error) throw new Error(`${bucket}: ${error.message}`);
    const items = data || [];
    for (const item of items) {
      const path = `${prefix}/${item.name}`;
      // Folders come back without an id.
      if (item.id) paths.push(path);
      else paths.push(...await listFiles(supabase, bucket, path, depth + 1));
    }
    if (items.length < 1000) break;
  }
  return paths;
}

async function deleteStorage(supabase: SupabaseClient, uid: string) {
  let removed = 0;
  for (const bucket of BUCKETS) {
    let paths: string[] = [];
    try { paths = await listFiles(supabase, bucket, uid); } catch (error) {
      if (/not found/i.test(error instanceof Error ? error.message : '')) continue; // bucket missing
      throw error;
    }
    for (let i = 0; i < paths.length; i += 100) {
      const chunk = paths.slice(i, i + 100);
      const { error } = await supabase.storage.from(bucket).remove(chunk);
      if (error) throw new Error(`${bucket}: ${error.message}`);
      removed += chunk.length;
    }
  }
  return removed;
}

async function audit(supabase: SupabaseClient, row: Record<string, unknown>) {
  // Best effort: never block a deletion because the audit insert failed.
  try { await supabase.from('account_activity_log').insert(row); } catch { /* ignore */ }
}

export async function POST(request: NextRequest) {
  try {
    let auth: Awaited<ReturnType<typeof userFromBearer>>;
    try { auth = await userFromBearer(request.headers.get('authorization')); } catch {
      throw new UserFacingError('Please sign in again to delete your account.', 401, 'reauth_required');
    }
    const { user, token } = auth;
    const body = await request.json().catch(() => ({})) as { confirm?: unknown };
    if (body?.confirm !== 'DELETE') throw new UserFacingError('Type DELETE to confirm.', 400, 'confirm_required');

    const supabase = serverSupabase();
    const uid = user.id;

    const signedInAt = authenticatedAt(token, user.last_sign_in_at);
    if (!signedInAt || Date.now() - signedInAt > RECENT_SIGN_IN_MS) {
      throw new UserFacingError('For your security, please sign out and sign in again, then delete your account within 15 minutes.', 401, 'reauth_required');
    }

    const { data: profile, error: profileError } = await supabase.from('profiles').select('id,tier,is_admin').eq('id', uid).maybeSingle();
    if (profileError) throw profileError;
    if (profile?.is_admin || profile?.tier === 'admin' || isAdminEmail(user.email)) {
      throw new UserFacingError('Admin accounts can\'t be deleted here. Remove admin access first.', 403, 'admin');
    }

    const userAgent = (request.headers.get('user-agent') || '').slice(0, 300);
    await audit(supabase, { actor_profile_id: uid, target_profile_id: uid, target_table: 'auth.users', target_record_id: uid, action: 'system', source: 'api/account/delete', user_agent: userAgent, note: 'account deletion requested by the user' });

    // 1. Billing first: if Stripe can't be cancelled, stop before anything is deleted.
    let stripe: { cancelled: number; skipped: boolean };
    try { stripe = await cancelStripe(supabase, uid); } catch (error) {
      throw new UserFacingError(`We couldn't cancel your subscription automatically (${error instanceof Error ? error.message : 'Stripe error'}). Nothing was deleted. Cancel it in Billing, or contact support.`, 502, 'stripe');
    }

    // 2. Files under <uid>/
    const filesRemoved = await deleteStorage(supabase, uid);

    // 3. Tags: unlink, keep the physical tag record.
    const { data: pets, error: petsError } = await supabase.from('pets').select('id').eq('owner_id', uid);
    if (petsError) throw petsError;
    const petIds = (pets || []).map((p: { id: string }) => p.id);
    const unlink = { pet_id: null, created_by: null, claimed_at: null, status: 'unassigned', activated_by_device: null };
    const tagsByOwner = await supabase.from('tags').update(unlink).eq('created_by', uid).select('id');
    if (tagsByOwner.error) throw tagsByOwner.error;
    let tagsUnlinked = tagsByOwner.data?.length || 0;
    if (petIds.length) {
      const tagsByPet = await supabase.from('tags').update(unlink).in('pet_id', petIds).select('id');
      if (tagsByPet.error) throw tagsByPet.error;
      tagsUnlinked += tagsByPet.data?.length || 0;

      // 4. Scan reports about this user's dogs (pets.id -> scan_events is SET NULL, which would
      //    leave location data orphaned). Scans this user made of other people's dogs stay with
      //    those owners (scanner_profile_id is set null by the FK).
      const scans = await supabase.from('scan_events').delete().in('pet_id', petIds);
      if (scans.error) throw scans.error;
    }

    // 5. The auth user; profiles and everything owned cascade from it.
    const { error: deleteError } = await supabase.auth.admin.deleteUser(uid);
    if (deleteError) throw new Error(`Account removal failed: ${deleteError.message}`);

    await audit(supabase, { actor_profile_id: null, target_profile_id: null, target_table: 'auth.users', target_record_id: uid, action: 'delete', source: 'api/account/delete', user_agent: userAgent, note: `account deleted; pets=${petIds.length} files=${filesRemoved} tags_unlinked=${tagsUnlinked} stripe_cancelled=${stripe.cancelled}${stripe.skipped ? ' stripe_not_configured' : ''}` });

    return NextResponse.json({ ok: true, petsDeleted: petIds.length, filesRemoved, tagsUnlinked, subscriptionsCancelled: stripe.cancelled, stripeSkipped: stripe.skipped });
  } catch (error) {
    if (error instanceof UserFacingError) return NextResponse.json({ ok: false, code: error.code, error: error.message }, { status: error.status });
    const message = error instanceof Error ? error.message : (error as { message?: string })?.message || 'Account deletion failed.';
    return NextResponse.json({ ok: false, code: 'error', error: message }, { status: 400 });
  }
}
