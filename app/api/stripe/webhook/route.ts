import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '../../../../lib/server-integrations';

export const dynamic = 'force-dynamic';

type StripeEvent = { id: string; type: string; data: { object: Record<string, any> } };

function verifyStripeSignature(payload: string, signatureHeader: string | null) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error('Stripe webhook secret is not configured.');
  if (!signatureHeader) throw new Error('Missing Stripe signature.');
  const parts = Object.fromEntries(signatureHeader.split(',').map((part) => {
    const [key, value] = part.split('=');
    return [key, value];
  }));
  const timestamp = parts.t;
  const expected = parts.v1;
  if (!timestamp || !expected) throw new Error('Invalid Stripe signature header.');
  const signedPayload = `${timestamp}.${payload}`;
  const digest = createHmac('sha256', secret).update(signedPayload, 'utf8').digest('hex');
  const a = Buffer.from(digest, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error('Stripe signature verification failed.');
}

function statusFromSubscription(stripeStatus?: string) {
  if (stripeStatus === 'active' || stripeStatus === 'trialing') return 'active';
  if (stripeStatus === 'past_due' || stripeStatus === 'unpaid') return 'payment_attention';
  if (stripeStatus === 'canceled' || stripeStatus === 'incomplete_expired') return 'cancelled';
  return stripeStatus || 'pending';
}

async function upsertMembershipFromStripe(object: Record<string, any>, eventType: string) {
  const supabase = serverSupabase();
  const metadata = object.metadata || {};
  const profileId = metadata.profile_id || null;
  const tier = metadata.tier || null;
  const subscriptionId = typeof object.subscription === 'string' ? object.subscription : object.id?.startsWith?.('sub_') ? object.id : null;
  const customerId = typeof object.customer === 'string' ? object.customer : null;
  const status = statusFromSubscription(object.status || object.payment_status);
  const eventId = metadata.membership_event_id;

  if (eventId) {
    await supabase.from('membership_events').update({
      profile_id: profileId,
      provider_customer_id: customerId,
      provider_subscription_id: subscriptionId,
      tier,
      status,
      metadata: { stripe_event_type: eventType, stripe_object_id: object.id, stripe_status: object.status || null, stripe_payment_status: object.payment_status || null },
      updated_at: new Date().toISOString(),
    }).eq('id', eventId);
  } else if (profileId || subscriptionId || customerId) {
    await supabase.from('membership_events').insert({
      profile_id: profileId,
      provider: 'stripe',
      provider_customer_id: customerId,
      provider_subscription_id: subscriptionId,
      tier,
      status,
      metadata: { stripe_event_type: eventType, stripe_object_id: object.id, stripe_status: object.status || null, stripe_payment_status: object.payment_status || null },
    });
  }

  if (profileId && tier && (status === 'active' || status === 'trialing')) {
    await supabase.from('profiles').update({ tier }).eq('id', profileId).neq('tier', 'admin');
  }
  if (profileId && ['cancelled', 'payment_attention'].includes(status)) {
    await supabase.from('profiles').update({ tier: 'free' }).eq('id', profileId).neq('tier', 'admin');
  }
}

async function reconcileCheckoutSession(object: Record<string, any>) {
  const supabase = serverSupabase();
  const metadata = object.metadata || {};
  const mode = object.mode;
  if (mode === 'payment') {
    const orderId = metadata.order_id || object.client_reference_id;
    if (!orderId) return;
    const paid = object.payment_status === 'paid' || object.status === 'complete';
    await supabase.from('tag_orders').update({
      provider_checkout_id: object.id,
      provider_payment_id: typeof object.payment_intent === 'string' ? object.payment_intent : null,
      status: paid ? 'paid' : object.status === 'expired' ? 'cancelled' : 'manual_review',
      amount_cents: object.amount_total ?? null,
      currency: object.currency || 'usd',
      ship_to: object.shipping_details || {},
      metadata: { stripe_event_type: 'checkout.session', stripe_status: object.status, stripe_payment_status: object.payment_status, customer_details: object.customer_details || null },
      updated_at: new Date().toISOString(),
    }).eq('id', orderId);
    return;
  }
  if (mode === 'subscription') await upsertMembershipFromStripe(object, 'checkout.session');
}

export async function POST(request: NextRequest) {
  const payload = await request.text();
  try {
    verifyStripeSignature(payload, request.headers.get('stripe-signature'));
    const event = JSON.parse(payload) as StripeEvent;
    const object = event.data.object;
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded' || event.type === 'checkout.session.expired') {
      await reconcileCheckoutSession(object);
    } else if (event.type.startsWith('customer.subscription.')) {
      await upsertMembershipFromStripe(object, event.type);
    } else if (event.type === 'invoice.payment_succeeded' || event.type === 'invoice.payment_failed') {
      await upsertMembershipFromStripe(object, event.type);
    } else if (event.type === 'charge.refunded') {
      const paymentIntent = object.payment_intent;
      if (paymentIntent) await serverSupabase().from('tag_orders').update({ status: 'refunded', updated_at: new Date().toISOString() }).eq('provider_payment_id', paymentIntent);
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Webhook failed' }, { status: 400 });
  }
}
