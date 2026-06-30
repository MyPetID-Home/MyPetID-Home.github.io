import { NextRequest, NextResponse } from 'next/server';
import { appBaseUrl, serverSupabase, stripeRequest, userFromBearer } from '../../../../lib/server-integrations';
import { getMembershipSummary } from '../../../../lib/membership';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { user } = await userFromBearer(request.headers.get('authorization'));
    const supabase = serverSupabase();
    const membership = await getMembershipSummary(supabase, user.id);
    const customerId = membership.provider === 'stripe' ? membership.provider_customer_id : null;
    if (!customerId) throw new Error('No Stripe customer is linked to this account yet. Start a Stripe subscription first, or use Patreon for membership.');
    const session = await stripeRequest('/billing_portal/sessions', {
      customer: customerId,
      return_url: `${appBaseUrl}/dashboard/account/`,
    });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Billing portal failed' }, { status: 400 });
  }
}
