import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase, stripeRetrieve } from '../../../../lib/server-integrations';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('session_id');
    const orderId = url.searchParams.get('order');
    if (!sessionId || !orderId) throw new Error('Missing Stripe session or order id.');
    const session = await stripeRetrieve(`/checkout/sessions/${encodeURIComponent(sessionId)}`);
    const paid = session.payment_status === 'paid' || session.status === 'complete';
    const supabase = serverSupabase();
    const update = {
      provider_checkout_id: session.id,
      provider_payment_id: typeof session.payment_intent === 'string' ? session.payment_intent : null,
      status: paid ? 'paid' : 'manual_review',
      amount_cents: session.amount_total ?? null,
      currency: session.currency || 'usd',
      ship_to: session.shipping_details || {},
      metadata: {
        stripe_status: session.status,
        stripe_payment_status: session.payment_status,
        customer_details: session.customer_details || null,
        confirmed_from: 'success_return',
      },
    };
    const { data, error } = await supabase.from('tag_orders').update(update).eq('id', orderId).eq('provider_checkout_id', session.id).select('*').single();
    if (error) throw error;
    return NextResponse.json({ order: data, paid });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Payment confirmation failed' }, { status: 400 });
  }
}
