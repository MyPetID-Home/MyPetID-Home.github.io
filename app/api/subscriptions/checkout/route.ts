import { NextRequest, NextResponse } from 'next/server';
import { appBaseUrl, serverSupabase, stripeRequest, userFromBearer } from '../../../../lib/server-integrations';

export const dynamic = 'force-dynamic';

type SubscriptionCheckoutBody = { tier?: string; priceId?: string };

const allowedTiers = new Set(['basic', 'silver', 'gold', 'diamond']);

export async function POST(request: NextRequest) {
  try {
    const { user } = await userFromBearer(request.headers.get('authorization'));
    const body = await request.json() as SubscriptionCheckoutBody;
    const requestedTier = String(body.tier || '').toLowerCase();
    if (!allowedTiers.has(requestedTier)) throw new Error('Choose a valid subscription tier.');
    const supabase = serverSupabase();
    const { data: tier, error: tierError } = await supabase
      .from('membership_tiers')
      .select('*')
      .eq('tier', requestedTier)
      .eq('checkout_enabled', true)
      .maybeSingle();
    if (tierError) throw tierError;
    if (!tier?.stripe_price_id) throw new Error('Stripe subscription price is not configured for this tier.');
    if (body.priceId && body.priceId !== tier.stripe_price_id) throw new Error('Tier/price mismatch.');

    const { data: event, error: eventError } = await supabase.from('membership_events').insert({
      profile_id: user.id,
      provider: 'stripe',
      tier: tier.tier,
      status: 'checkout_started',
      metadata: { source: 'subscription_checkout', monthly_price: tier.monthly_price, max_tags: tier.max_tags, max_users: tier.max_users },
    }).select('*').single();
    if (eventError) throw eventError;

    const session = await stripeRequest('/checkout/sessions', {
      mode: 'subscription',
      success_url: `${appBaseUrl}/subscribe/success/?membership=${event.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appBaseUrl}/subscribe/cancel/?membership=${event.id}`,
      'line_items[0][price]': tier.stripe_price_id,
      'line_items[0][quantity]': 1,
      client_reference_id: event.id,
      customer_email: user.email || undefined,
      allow_promotion_codes: true,
      'metadata[membership_event_id]': event.id,
      'metadata[profile_id]': user.id,
      'metadata[tier]': tier.tier,
      'subscription_data[metadata][membership_event_id]': event.id,
      'subscription_data[metadata][profile_id]': user.id,
      'subscription_data[metadata][tier]': tier.tier,
    });

    await supabase.from('membership_events').update({
      provider_customer_id: typeof session.customer === 'string' ? session.customer : null,
      provider_subscription_id: typeof session.subscription === 'string' ? session.subscription : null,
      metadata: { ...(event.metadata || {}), stripe_checkout_id: session.id, stripe_url_created: true },
    }).eq('id', event.id);

    return NextResponse.json({ url: session.url, membershipEventId: event.id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Subscription checkout failed' }, { status: 400 });
  }
}
