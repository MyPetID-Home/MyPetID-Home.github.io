import { NextRequest, NextResponse } from 'next/server';
import { isAdminEmail } from '../../../../lib/supabase';
import { serverSupabase, stripeRequest, userFromBearer } from '../../../../lib/server-integrations';
import { getMembershipSummary } from '../../../../lib/membership';
import { cleanCouponTier, couponHint, generateCouponCode, grantExpiration, hashCouponCode } from '../../../../lib/coupons';
import { sendCouponEmail } from '../../../../lib/email-verification';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function requireAdmin(request: NextRequest) {
  const { user } = await userFromBearer(request.headers.get('authorization'));
  const supabase = serverSupabase();
  const { data: profile, error } = await supabase.from('profiles').select('id,email,tier,is_admin').eq('id', user.id).maybeSingle();
  if (error) throw error;
  if (!profile?.is_admin && profile?.tier !== 'admin' && !isAdminEmail(user.email)) throw new Error('Admin access required.');
  return { user, profile, supabase };
}

function monthsFromDays(days?: number | null) {
  if (!days || days <= 0) return null;
  return Math.max(1, Math.round(days / 30));
}

async function createStripePromotion(code: string, tier: string, durationDays: number | null, maxRedemptions: number) {
  const durationMonths = monthsFromDays(durationDays);
  const coupon = await stripeRequest('/coupons', {
    percent_off: 100,
    duration: durationMonths ? 'repeating' : 'forever',
    duration_in_months: durationMonths || undefined,
    name: `MyPetID ${tier} comp${durationDays ? ` ${durationDays}d` : ''}`,
    'metadata[tier]': tier,
    'metadata[source]': 'mypetid_admin_coupon',
  });
  const promo = await stripeRequest('/promotion_codes', {
    coupon: coupon.id,
    code,
    active: true,
    max_redemptions: maxRedemptions,
    'metadata[tier]': tier,
    'metadata[source]': 'mypetid_admin_coupon',
  });
  return { coupon_id: coupon.id, promotion_code_id: promo.id };
}

export async function GET(request: NextRequest) {
  try {
    const { supabase } = await requireAdmin(request);
    const search = request.nextUrl.searchParams.get('search')?.trim().toLowerCase() || '';
    const { data: profiles, error: profileError } = await supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(75);
    if (profileError) throw profileError;
    const filtered = (profiles || []).filter((profile: any) => !search || [profile.email, profile.display_name, profile.phone, profile.id].some((value) => String(value || '').toLowerCase().includes(search))).slice(0, 40);
    const memberships = await Promise.all(filtered.map(async (profile: any) => {
      const summary = await getMembershipSummary(supabase, profile.id);
      const { data: grants } = await supabase.from('membership_grants').select('*').eq('profile_id', profile.id).order('created_at', { ascending: false }).limit(8);
      return { profile, membership: summary, grants: grants || [] };
    }));
    const { data: coupons, error: couponError } = await supabase.from('access_coupons').select('*').order('created_at', { ascending: false }).limit(40);
    if (couponError) throw couponError;
    return NextResponse.json({ accounts: memberships, coupons: coupons || [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Admin membership lookup failed.' }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await requireAdmin(request);
    const body = await request.json();
    const action = String(body.action || '');
    if (action === 'grant_membership') {
      const tier = cleanCouponTier(body.tier);
      const profileId = String(body.profileId || '');
      if (!profileId) throw new Error('Choose a user/profile to grant.');
      const durationDays = Number(body.durationDays || 0) || null;
      const expiresAt = grantExpiration(durationDays);
      const { data: grant, error: grantError } = await supabase.from('membership_grants').insert({
        profile_id: profileId,
        tier,
        source: 'admin',
        status: 'active',
        expires_at: expiresAt,
        granted_by: user.id,
        note: body.note ? String(body.note).slice(0, 500) : null,
        metadata: { duration_days: durationDays, manual_admin_grant: true },
      }).select('*').single();
      if (grantError) throw grantError;
      await supabase.from('membership_events').insert({ profile_id: profileId, provider: 'admin_grant', tier, status: 'active', metadata: { grant_id: grant.id, expires_at: expiresAt, note: body.note || null } });
      return NextResponse.json({ grant, membership: await getMembershipSummary(supabase, profileId) });
    }

    if (action === 'update_grant') {
      const grantId = String(body.grantId || '');
      const status = String(body.status || 'active');
      if (!['active', 'revoked', 'expired'].includes(status)) throw new Error('Invalid grant status.');
      const { data: grant, error } = await supabase.from('membership_grants').update({ status, note: body.note ? String(body.note).slice(0, 500) : undefined }).eq('id', grantId).select('*').single();
      if (error) throw error;
      return NextResponse.json({ grant });
    }

    if (action === 'generate_coupon') {
      const tier = cleanCouponTier(body.tier);
      const durationDays = Number(body.durationDays || 30) || 30;
      const maxRedemptions = Math.max(1, Math.min(100, Number(body.maxRedemptions || 1)));
      const recipientEmail = String(body.recipientEmail || '').trim().toLowerCase() || null;
      const code = generateCouponCode(tier);
      const codeHash = hashCouponCode(code);
      const expiresInDays = Number(body.expiresInDays || 30) || 30;
      let metadata: Record<string, unknown> = { duration_days: durationDays, app_coupon: true, patreon_equivalent: true };
      if (body.createStripePromotion) {
        try {
          metadata = { ...metadata, stripe: await createStripePromotion(code, tier, durationDays, maxRedemptions) };
        } catch (error) {
          metadata = { ...metadata, stripe_error: error instanceof Error ? error.message : 'Stripe promotion creation failed' };
        }
      }
      const { data: coupon, error: couponError } = await supabase.from('access_coupons').insert({
        code_hash: codeHash,
        code_hint: couponHint(code),
        tier,
        duration_days: durationDays,
        max_redemptions: maxRedemptions,
        recipient_email: recipientEmail,
        created_by: user.id,
        expires_at: grantExpiration(expiresInDays),
        metadata,
      }).select('*').single();
      if (couponError) throw couponError;
      let emailed = false;
      if (body.emailCode && recipientEmail) {
        await sendCouponEmail(recipientEmail, code, tier, durationDays);
        emailed = true;
      }
      return NextResponse.json({ coupon, code, emailed });
    }

    if (action === 'disable_coupon') {
      const couponId = String(body.couponId || '');
      const { data: coupon, error } = await supabase.from('access_coupons').update({ status: 'disabled' }).eq('id', couponId).select('*').single();
      if (error) throw error;
      return NextResponse.json({ coupon });
    }

    throw new Error('Unsupported admin membership action.');
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Admin membership action failed.' }, { status: 400 });
  }
}
