import { NextRequest, NextResponse } from 'next/server';
import { appBaseUrl, serverSupabase } from '../../../../../lib/server-integrations';
import { applyPatreonMembership, patreonGet, patreonToken, tierSlugFromPatreon, verifyPatreonState } from '../../../../../lib/patreon';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  try {
    const code = params.get('code');
    const state = params.get('state');
    if (!code || !state) throw new Error('Missing Patreon OAuth code/state.');
    const parsedState = verifyPatreonState(state);
    const redirectUri = `${appBaseUrl}/api/patreon/oauth/callback/`;
    const token = await patreonToken({ grant_type: 'authorization_code', code, redirect_uri: redirectUri });
    const identity = await patreonGet('/identity?fields%5Buser%5D=full_name,email&include=memberships,memberships.currently_entitled_tiers&fields%5Bmember%5D=patron_status,last_charge_status,currently_entitled_amount_cents&fields%5Btier%5D=title,amount_cents,description,published', token.access_token);
    const userId = identity?.data?.id as string;
    const included = Array.isArray(identity?.included) ? identity.included : [];
    const member = included.find((item: any) => item.type === 'member');
    const tiers = included.filter((item: any) => item.type === 'tier');
    const tierIds = tiers.map((tier: any) => String(tier.id));
    const maxTier = tiers.sort((a: any, b: any) => Number(b?.attributes?.amount_cents || 0) - Number(a?.attributes?.amount_cents || 0))[0];
    const patronStatus = member?.attributes?.patron_status || 'linked';
    const active = patronStatus === 'active_patron' || Number(member?.attributes?.currently_entitled_amount_cents || 0) > 0;
    const tier = tierSlugFromPatreon(tierIds, maxTier?.attributes?.amount_cents, maxTier?.attributes?.title);
    const supabase = serverSupabase();
    await supabase.from('provider_credentials').upsert({
      profile_id: parsedState.profile_id,
      provider: 'patreon',
      provider_subject: userId,
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      scopes: String(token.scope || 'identity identity[email] identity.memberships').split(/\s+/).filter(Boolean),
      expires_at: token.expires_in ? new Date(Date.now() + Number(token.expires_in) * 1000).toISOString() : null,
      status: 'active',
      metadata: { patreon_user: identity.data?.attributes || {}, member_id: member?.id || null, patron_status: patronStatus, tier_ids: tierIds },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'profile_id,provider' });
    await applyPatreonMembership(parsedState.profile_id, userId, active ? tier : 'free', active ? 'active' : patronStatus, { source: 'oauth_callback', patreon_user_id: userId, member_id: member?.id || null, tier_ids: tierIds, patron_status: patronStatus });
    return NextResponse.redirect(`${appBaseUrl}/verify/patreon/?status=connected&tier=${encodeURIComponent(active ? tier : 'free')}`);
  } catch (error) {
    return NextResponse.redirect(`${appBaseUrl}/verify/patreon/?status=error&message=${encodeURIComponent(error instanceof Error ? error.message : 'Patreon callback failed')}`);
  }
}
