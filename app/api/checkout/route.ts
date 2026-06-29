import { NextRequest, NextResponse } from 'next/server';
import { appBaseUrl, serverSupabase, stripeRequest, userFromBearer } from '../../../lib/server-integrations';

export const dynamic = 'force-dynamic';

type CheckoutBody = { priceId?: string; productSlug?: string; petId?: string; quantity?: number; provider?: 'stripe' | 'patreon' };

export async function POST(request: NextRequest) {
  try {
    const { user } = await userFromBearer(request.headers.get('authorization'));
    const body = await request.json() as CheckoutBody;
    const supabase = serverSupabase();
    const productQuery = body.productSlug
      ? supabase.from('tag_products').select('*').eq('slug', body.productSlug).maybeSingle()
      : supabase.from('tag_products').select('*').eq('stripe_price_id', body.priceId || '').maybeSingle();
    const { data: product, error: productError } = await productQuery;
    if (productError) throw productError;
    if (!product?.stripe_price_id) throw new Error('Tag product is not configured for Stripe checkout.');

    const publicPetUrl = body.petId ? `${appBaseUrl}/pet/?pet=${encodeURIComponent(body.petId)}` : `${appBaseUrl}/dashboard/pet/`;
    const { data: order, error: orderError } = await supabase.from('tag_orders').insert({
      profile_id: user.id,
      pet_id: body.petId || null,
      tag_product_id: product.id,
      provider: 'stripe',
      status: 'checkout_started',
      amount_cents: product.price_cents,
      currency: product.currency,
      public_pet_url: publicPetUrl,
      qr_payload: publicPetUrl,
      metadata: { product_slug: product.slug, product_name: product.name },
    }).select('*').single();
    if (orderError) throw orderError;

    const session = await stripeRequest('/checkout/sessions', {
      mode: 'payment',
      success_url: `${appBaseUrl}/payment/success/?order=${order.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appBaseUrl}/payment/cancel/?order=${order.id}`,
      'line_items[0][price]': product.stripe_price_id,
      'line_items[0][quantity]': body.quantity || 1,
      client_reference_id: order.id,
      customer_email: user.email || undefined,
      'metadata[order_id]': order.id,
      'metadata[profile_id]': user.id,
      'metadata[pet_id]': body.petId || '',
      'metadata[tag_product_slug]': product.slug,
      allow_promotion_codes: true,
      'shipping_address_collection[allowed_countries][0]': 'US',
    });

    await supabase.from('tag_orders').update({ provider_checkout_id: session.id, metadata: { ...(order.metadata || {}), stripe_url_created: true } }).eq('id', order.id);
    return NextResponse.json({ url: session.url, orderId: order.id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Checkout failed' }, { status: 400 });
  }
}
