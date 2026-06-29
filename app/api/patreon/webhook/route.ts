import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { applyPatreonMembership, tierSlugFromPatreon } from '../../../../lib/patreon';

export const dynamic = 'force-dynamic';

function verifyPatreonWebhook(payload: string, signature: string | null) {
  const secret = process.env.PATREON_WEBHOOK_SECRET;
  if (!secret) throw new Error('Patreon webhook secret is not configured yet.');
  if (!signature) throw new Error('Missing Patreon webhook signature.');
  const digest = createHmac('md5', secret).update(payload, 'utf8').digest('hex');
  const a = Buffer.from(digest, 'hex');
  const b = Buffer.from(signature, 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error('Patreon webhook signature verification failed.');
}

function extractMember(payload: any) {
  const data = payload?.data || {};
  const included = Array.isArray(payload?.included) ? payload.included : [];
  const member = data.type === 'member' ? data : included.find((item: any) => item.type === 'member') || data;
  const userId = member?.relationships?.user?.data?.id || included.find((item: any) => item.type === 'user')?.id || null;
  const tierRefs = member?.relationships?.currently_entitled_tiers?.data || [];
  const tierIds = tierRefs.map((tier: any) => String(tier.id));
  const includedTiers = included.filter((item: any) => item.type === 'tier' && tierIds.includes(String(item.id)));
  const maxTier = includedTiers.sort((a: any, b: any) => Number(b?.attributes?.amount_cents || 0) - Number(a?.attributes?.amount_cents || 0))[0];
  const attrs = member?.attributes || {};
  const active = attrs.patron_status === 'active_patron' || Number(attrs.currently_entitled_amount_cents || 0) > 0;
  const tier = tierSlugFromPatreon(tierIds, maxTier?.attributes?.amount_cents || attrs.currently_entitled_amount_cents, maxTier?.attributes?.title);
  return { userId, memberId: member?.id || null, active, tier: active ? tier : 'free', status: active ? 'active' : attrs.patron_status || 'inactive', tierIds, attrs };
}

export async function POST(request: NextRequest) {
  const payload = await request.text();
  try {
    verifyPatreonWebhook(payload, request.headers.get('x-patreon-signature'));
    const eventType = request.headers.get('x-patreon-event') || 'patreon.webhook';
    const parsed = JSON.parse(payload);
    const member = extractMember(parsed);
    await applyPatreonMembership(null, member.userId, member.tier, member.status, { source: 'patreon_webhook', event_type: eventType, member_id: member.memberId, tier_ids: member.tierIds, patron_status: member.attrs?.patron_status || null });
    return NextResponse.json({ received: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Patreon webhook failed' }, { status: 400 });
  }
}
