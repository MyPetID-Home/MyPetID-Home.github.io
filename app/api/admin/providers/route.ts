import { NextRequest, NextResponse } from 'next/server';
import { isAdminEmail } from '../../../../lib/supabase';
import { serverSupabase, stripeList, stripeRequest, userFromBearer } from '../../../../lib/server-integrations';
import { patreonCreatorGet, tierSlugFromPatreon } from '../../../../lib/patreon';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function requireAdmin(request: NextRequest) {
  const { user } = await userFromBearer(request.headers.get('authorization'));
  const supabase = serverSupabase();
  const { data: profile, error } = await supabase.from('profiles').select('id,email,tier,is_admin').eq('id', user.id).maybeSingle();
  if (error) throw error;
  if (!profile?.is_admin && profile?.tier !== 'admin' && !isAdminEmail(user.email)) throw new Error('Admin access required.');
  return { user, supabase };
}

function cleanTier(value: unknown) {
  const tier = String(value || '').toLowerCase();
  if (!['basic', 'silver', 'gold', 'diamond'].includes(tier)) throw new Error('Choose Basic, Silver, Gold, or Diamond.');
  return tier;
}

async function stripeSnapshot() {
  const [products, prices, coupons, promotionCodes] = await Promise.allSettled([
    stripeList('/products', { limit: 40, active: true }),
    stripeList('/prices', { limit: 50, active: true, type: 'recurring' }),
    stripeList('/coupons', { limit: 40 }),
    stripeList('/promotion_codes', { limit: 40 }),
  ]);
  const read = (result: PromiseSettledResult<any>) => result.status === 'fulfilled' ? result.value?.data || [] : [];
  const errors = [products, prices, coupons, promotionCodes]
    .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
    .map((result) => result.reason instanceof Error ? result.reason.message : String(result.reason));
  return { products: read(products), prices: read(prices), coupons: read(coupons), promotion_codes: read(promotionCodes), errors };
}

async function patreonSnapshot() {
  try {
    const campaigns = await patreonCreatorGet('/campaigns?include=tiers&fields%5Bcampaign%5D=creation_name,summary,is_monthly,patron_count&fields%5Btier%5D=title,amount_cents,description,published,url');
    return { campaigns: campaigns?.data || [], included: campaigns?.included || [], editable_in_app: false, note: 'Patreon creator API is used here for read/sync. Patreon tier/coupon creation or editing must be done in Patreon Creator dashboard; MyPetID admin grants/coupons provide Patreon-equivalent comp access inside the app.' };
  } catch (error) {
    return { campaigns: [], included: [], editable_in_app: false, error: error instanceof Error ? error.message : 'Patreon fetch failed', note: 'Patreon editing is dashboard-only; app grants/coupons can still comp access.' };
  }
}

export async function GET(request: NextRequest) {
  try {
    const { supabase } = await requireAdmin(request);
    const [{ data: tiers }, stripe, patreon] = await Promise.all([
      supabase.from('membership_tiers').select('*').order('monthly_price', { ascending: true }),
      stripeSnapshot(),
      patreonSnapshot(),
    ]);
    return NextResponse.json({ tiers: tiers || [], stripe, patreon, capabilities: {
      stripe: ['view_products_prices', 'create_product_and_price', 'archive_product', 'archive_price', 'create_coupon', 'create_promotion_code', 'disable_promotion_code', 'sync_membership_tier_ids'],
      patreon: ['view_campaign_tiers', 'sync_tier_metadata_to_supabase', 'create_mypetid_comp_grants'],
      patreon_dashboard_required: ['create_or_edit_patreon_tiers', 'delete_patreon_tiers', 'native_patreon_coupon_codes'],
    } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Provider lookup failed.' }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase } = await requireAdmin(request);
    const body = await request.json();
    const action = String(body.action || '');

    if (action === 'stripe_create_product_price') {
      const tier = cleanTier(body.tier);
      const name = String(body.name || `${tier[0].toUpperCase()}${tier.slice(1)} Membership`);
      const monthlyCents = Math.max(50, Math.round(Number(body.monthlyCents || 0)));
      if (!monthlyCents) throw new Error('Monthly cents is required.');
      const product = await stripeRequest('/products', {
        name,
        active: true,
        description: body.description ? String(body.description).slice(0, 500) : `MyPetID ${tier} monthly membership`,
        'metadata[tier]': tier,
        'metadata[source]': 'mypetid_admin_provider_control',
      });
      const price = await stripeRequest('/prices', {
        product: product.id,
        unit_amount: monthlyCents,
        currency: 'usd',
        'recurring[interval]': 'month',
        active: true,
        nickname: name,
        'metadata[tier]': tier,
        'metadata[source]': 'mypetid_admin_provider_control',
      });
      const { data: tierRow, error } = await supabase.from('membership_tiers').update({ stripe_product_id: product.id, stripe_price_id: price.id, monthly_price: monthlyCents, checkout_enabled: true }).eq('tier', tier).select('*').single();
      if (error) throw error;
      return NextResponse.json({ product, price, tier: tierRow });
    }

    if (action === 'stripe_archive_product') {
      const productId = String(body.productId || '');
      if (!productId.startsWith('prod_')) throw new Error('Stripe product ID is required.');
      const product = await stripeRequest(`/products/${productId}`, { active: false });
      return NextResponse.json({ product });
    }

    if (action === 'stripe_archive_price') {
      const priceId = String(body.priceId || '');
      if (!priceId.startsWith('price_')) throw new Error('Stripe price ID is required.');
      const price = await stripeRequest(`/prices/${priceId}`, { active: false });
      return NextResponse.json({ price });
    }

    if (action === 'stripe_create_coupon') {
      const name = String(body.name || 'MyPetID admin coupon').slice(0, 120);
      const percentOff = Math.max(1, Math.min(100, Math.round(Number(body.percentOff || 100))));
      const duration = ['once', 'repeating', 'forever'].includes(String(body.duration)) ? String(body.duration) : 'once';
      const durationMonths = duration === 'repeating' ? Math.max(1, Math.min(24, Math.round(Number(body.durationMonths || 1)))) : undefined;
      const coupon = await stripeRequest('/coupons', { percent_off: percentOff, duration, duration_in_months: durationMonths, name, 'metadata[source]': 'mypetid_admin_provider_control' });
      let promotionCode = null;
      if (body.code) {
        promotionCode = await stripeRequest('/promotion_codes', { coupon: coupon.id, code: String(body.code).toUpperCase().trim(), active: true, max_redemptions: Math.max(1, Number(body.maxRedemptions || 1)), 'metadata[source]': 'mypetid_admin_provider_control' });
      }
      return NextResponse.json({ coupon, promotionCode });
    }

    if (action === 'stripe_disable_promotion_code') {
      const promotionCodeId = String(body.promotionCodeId || '');
      if (!promotionCodeId.startsWith('promo_')) throw new Error('Stripe promotion code ID is required.');
      const promotionCode = await stripeRequest(`/promotion_codes/${promotionCodeId}`, { active: false });
      return NextResponse.json({ promotionCode });
    }

    if (action === 'sync_stripe_tier_ids') {
      const tier = cleanTier(body.tier);
      const update: Record<string, unknown> = {};
      if (body.productId) update.stripe_product_id = String(body.productId);
      if (body.priceId) update.stripe_price_id = String(body.priceId);
      if (body.monthlyCents) update.monthly_price = Number(body.monthlyCents);
      if (body.checkoutEnabled !== undefined) update.checkout_enabled = Boolean(body.checkoutEnabled);
      const { data, error } = await supabase.from('membership_tiers').update(update).eq('tier', tier).select('*').single();
      if (error) throw error;
      return NextResponse.json({ tier: data });
    }

    if (action === 'sync_patreon_tiers') {
      const snapshot = await patreonSnapshot();
      const included = Array.isArray(snapshot.included) ? snapshot.included : [];
      const updated = [];
      for (const item of included) {
        if (item.type !== 'tier') continue;
        const attrs = item.attributes || {};
        const tier = tierSlugFromPatreon([item.id], attrs.amount_cents, attrs.title);
        if (!['basic', 'silver', 'gold', 'diamond', 'free'].includes(tier)) continue;
        const { data, error } = await supabase.from('membership_tiers').update({ patreon_tier_id: item.id, patreon_title: attrs.title || null, patreon_enabled: Boolean(attrs.published ?? true) }).eq('tier', tier).select('tier,patreon_tier_id,patreon_title,patreon_enabled').maybeSingle();
        if (!error && data) updated.push(data);
      }
      return NextResponse.json({ updated, patreon: snapshot });
    }

    throw new Error('Unsupported provider action.');
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Provider action failed.' }, { status: 400 });
  }
}
