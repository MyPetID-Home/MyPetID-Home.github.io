import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase, userFromBearer } from '../../../../lib/server-integrations';
import { getMembershipSummary } from '../../../../lib/membership';
import { grantExpiration, hashCouponCode, normalizeCouponCode } from '../../../../lib/coupons';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { user } = await userFromBearer(request.headers.get('authorization'));
    const body = await request.json();
    const code = normalizeCouponCode(String(body.code || ''));
    if (code.length < 8) throw new Error('Enter a valid MyPetID coupon code.');
    const supabase = serverSupabase();
    const { data: profile, error: profileError } = await supabase.from('profiles').select('id,email').eq('id', user.id).maybeSingle();
    if (profileError) throw profileError;
    const email = String(profile?.email || user.email || '').toLowerCase();
    const { data: coupon, error: couponError } = await supabase.from('access_coupons').select('*').eq('code_hash', hashCouponCode(code)).maybeSingle();
    if (couponError) throw couponError;
    if (!coupon) throw new Error('Coupon code was not found.');
    if (coupon.status !== 'active') throw new Error('Coupon code is not active.');
    if (coupon.expires_at && new Date(coupon.expires_at).getTime() <= Date.now()) throw new Error('Coupon code has expired.');
    if (Number(coupon.redemption_count || 0) >= Number(coupon.max_redemptions || 1)) throw new Error('Coupon code has already been redeemed.');
    if (coupon.recipient_email && String(coupon.recipient_email).toLowerCase() !== email) throw new Error('Coupon code is assigned to a different email address.');
    const expiresAt = grantExpiration(Number(coupon.duration_days || 0) || null);
    const { data: grant, error: grantError } = await supabase.from('membership_grants').insert({
      profile_id: user.id,
      tier: coupon.tier,
      status: 'active',
      source: 'coupon',
      expires_at: expiresAt,
      coupon_id: coupon.id,
      note: `Redeemed coupon ${coupon.code_hint || ''}`.trim(),
      metadata: { coupon_id: coupon.id, duration_days: coupon.duration_days, recipient_email: coupon.recipient_email || null },
    }).select('*').single();
    if (grantError) throw grantError;
    const now = new Date().toISOString();
    const nextCount = Number(coupon.redemption_count || 0) + 1;
    const couponStatus = nextCount >= Number(coupon.max_redemptions || 1) ? 'disabled' : 'active';
    await supabase.from('access_coupons').update({ redemption_count: nextCount, redeemed_by: user.id, redeemed_at: now, status: couponStatus }).eq('id', coupon.id);
    await supabase.from('membership_events').insert({ profile_id: user.id, provider: 'coupon', tier: coupon.tier, status: 'active', metadata: { coupon_id: coupon.id, grant_id: grant.id, expires_at: expiresAt } });
    return NextResponse.json({ redeemed: true, grant, membership: await getMembershipSummary(supabase, user.id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Coupon redemption failed.' }, { status: 400 });
  }
}
