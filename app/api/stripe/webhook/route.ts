import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '../../../../lib/server-integrations';
import { syncProfileTier } from '../../../../lib/membership';
import { applyStripeSubscription, invoicePeriodEnd, invoiceSubscriptionId, refreshStripeSubscription } from '../../../../lib/stripe-membership';

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

// Subscription state always comes from the subscription object itself (fetched from
// Stripe when the event carries a checkout session or invoice), so membership_events
// gets the real status and current_period_end, never a session/invoice status.
async function applySubscriptionReference(subscriptionId: string | null, eventType: string, fallback?: () => Promise<void>) {
  if (!subscriptionId) return;
  try {
    await refreshStripeSubscription(subscriptionId, eventType);
  } catch (error) {
    if (!fallback) throw error;
    await fallback();
  }
}

// Used only when the subscription cannot be fetched: records the invoice's paid period.
async function recordInvoicePayment(invoice: Record<string, any>, eventType: string) {
  const subscriptionId = invoiceSubscriptionId(invoice);
  if (!subscriptionId || eventType !== 'invoice.payment_succeeded') return;
  const supabase = serverSupabase();
  const { data: rows } = await supabase.from('membership_events').select('id,profile_id,tier,metadata').eq('provider', 'stripe').eq('provider_subscription_id', subscriptionId).order('updated_at', { ascending: false }).limit(1);
  const row = rows?.[0];
  if (!row) return;
  await supabase.from('membership_events').update({
    status: 'active',
    metadata: { ...(row.metadata || {}), stripe_event_type: eventType, stripe_invoice_id: invoice.id, current_period_end: invoicePeriodEnd(invoice) },
    updated_at: new Date().toISOString(),
  }).eq('id', row.id);
  await syncProfileTier(supabase, row.profile_id, row.tier || undefined);
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
  if (mode === 'subscription') {
    const subscriptionId = typeof object.subscription === 'string' ? object.subscription : object.subscription?.id || null;
    if (subscriptionId) await applySubscriptionReference(subscriptionId, 'checkout.session');
    else if (object.status === 'expired' && metadata.membership_event_id) {
      await supabase.from('membership_events').update({ status: 'expired', updated_at: new Date().toISOString() }).eq('id', metadata.membership_event_id).eq('status', 'checkout_started');
    }
  }
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
      await applyStripeSubscription(object, event.type);
    } else if (event.type === 'invoice.payment_succeeded' || event.type === 'invoice.paid' || event.type === 'invoice.payment_failed') {
      await applySubscriptionReference(invoiceSubscriptionId(object), event.type, () => recordInvoicePayment(object, event.type === 'invoice.paid' ? 'invoice.payment_succeeded' : event.type));
    } else if (event.type === 'charge.refunded') {
      const paymentIntent = object.payment_intent;
      if (paymentIntent) await serverSupabase().from('tag_orders').update({ status: 'refunded', updated_at: new Date().toISOString() }).eq('provider_payment_id', paymentIntent);
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Webhook failed' }, { status: 400 });
  }
}
