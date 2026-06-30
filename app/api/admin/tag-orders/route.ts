import { NextRequest, NextResponse } from 'next/server';
import { isAdminEmail } from '../../../../lib/supabase';
import { serverSupabase, userFromBearer } from '../../../../lib/server-integrations';

export const dynamic = 'force-dynamic';

const fulfillmentStatuses = new Set(['paid', 'queued', 'printing', 'shipped', 'delivered', 'cancelled', 'refunded', 'manual_review']);

async function requireAdmin(request: NextRequest) {
  const { user } = await userFromBearer(request.headers.get('authorization'));
  const supabase = serverSupabase();
  const { data: profile, error } = await supabase.from('profiles').select('id,email,tier,is_admin').eq('id', user.id).maybeSingle();
  if (error) throw error;
  const admin = Boolean(profile?.is_admin || profile?.tier === 'admin' || isAdminEmail(user.email));
  if (!admin) throw new Error('Admin access required.');
  return { user, supabase };
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter(Boolean) as string[]));
}

export async function GET(request: NextRequest) {
  try {
    const { supabase } = await requireAdmin(request);
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const search = (url.searchParams.get('search') || '').trim().toLowerCase();
    let query = supabase.from('tag_orders').select('*').order('created_at', { ascending: false }).limit(100);
    if (status && status !== 'all') query = query.eq('status', status);
    const { data: orders, error } = await query;
    if (error) throw error;
    const rows = orders || [];

    const productIds = unique(rows.map((row) => row.tag_product_id));
    const profileIds = unique(rows.map((row) => row.profile_id));
    const petIds = unique(rows.map((row) => row.pet_id));

    const [productsRes, profilesRes, petsRes] = await Promise.all([
      productIds.length ? supabase.from('tag_products').select('id,slug,name,tag_type,price_cents,currency').in('id', productIds) : Promise.resolve({ data: [], error: null }),
      profileIds.length ? supabase.from('profiles').select('id,email,display_name,phone,tier,is_admin').in('id', profileIds) : Promise.resolve({ data: [], error: null }),
      petIds.length ? supabase.from('pets').select('id,owner_id,name,species,breed,photo_url,lost_mode').in('id', petIds) : Promise.resolve({ data: [], error: null }),
    ]);
    if (productsRes.error) throw productsRes.error;
    if (profilesRes.error) throw profilesRes.error;
    if (petsRes.error) throw petsRes.error;

    const productById = new Map((productsRes.data || []).map((item: any) => [item.id, item]));
    const profileById = new Map((profilesRes.data || []).map((item: any) => [item.id, item]));
    const petById = new Map((petsRes.data || []).map((item: any) => [item.id, item]));

    const enriched = rows.map((row: any) => ({
      ...row,
      product: row.tag_product_id ? productById.get(row.tag_product_id) || null : null,
      profile: row.profile_id ? profileById.get(row.profile_id) || null : null,
      pet: row.pet_id ? petById.get(row.pet_id) || null : null,
    })).filter((row: any) => {
      if (!search) return true;
      const haystack = [row.id, row.status, row.provider_checkout_id, row.provider_payment_id, row.public_pet_url, row.qr_payload, row.product?.name, row.product?.slug, row.profile?.email, row.profile?.display_name, row.profile?.phone, row.pet?.name, JSON.stringify(row.ship_to || {})].join(' ').toLowerCase();
      return haystack.includes(search);
    });

    const counts = enriched.reduce((acc: Record<string, number>, row: any) => {
      acc[row.status] = (acc[row.status] || 0) + 1;
      return acc;
    }, {});
    return NextResponse.json({ orders: enriched, counts, statuses: Array.from(fulfillmentStatuses) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Admin orders load failed.' }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { user, supabase } = await requireAdmin(request);
    const body = await request.json();
    const id = String(body.id || '');
    const status = String(body.status || '');
    const note = String(body.note || '').trim();
    const trackingUrl = String(body.trackingUrl || '').trim();
    if (!id) throw new Error('Missing order id.');
    if (!fulfillmentStatuses.has(status)) throw new Error('Unsupported fulfillment status.');
    const metadataPatch: Record<string, unknown> = {
      fulfillment_status_updated_by: user.email || user.id,
      fulfillment_status_updated_at: new Date().toISOString(),
    };
    if (note) metadataPatch.fulfillment_note = note;
    if (trackingUrl) metadataPatch.tracking_url = trackingUrl;
    const { data: existing, error: readError } = await supabase.from('tag_orders').select('metadata').eq('id', id).maybeSingle();
    if (readError) throw readError;
    const { data, error } = await supabase.from('tag_orders').update({
      status,
      metadata: { ...(existing?.metadata || {}), ...metadataPatch },
      updated_at: new Date().toISOString(),
    }).eq('id', id).select('*').single();
    if (error) throw error;
    return NextResponse.json({ order: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Admin order update failed.' }, { status: 400 });
  }
}
