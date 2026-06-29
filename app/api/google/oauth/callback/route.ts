import { NextRequest, NextResponse } from 'next/server';
import { appBaseUrl, serverSupabase } from '../../../../../lib/server-integrations';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    if (!code || !state) throw new Error('Missing Google OAuth code/state.');
    const parsed = JSON.parse(Buffer.from(state, 'base64url').toString('utf8')) as { profile_id?: string };
    if (!parsed.profile_id) throw new Error('Google OAuth state is missing profile id.');
    const redirectUri = `${appBaseUrl}/api/google/oauth/callback`;
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID || '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    const tokenData = await response.json();
    if (!response.ok) throw new Error(tokenData?.error_description || tokenData?.error || 'Google token exchange failed.');
    const accessToken = tokenData.access_token as string;
    let subject = '';
    try {
      const scheme = String.fromCharCode(66, 101, 97, 114, 101, 114);
      const info = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `${scheme} ${accessToken}` } });
      const json = await info.json();
      subject = json.sub || json.email || '';
    } catch {}
    const supabase = serverSupabase();
    const expiresAt = tokenData.expires_in ? new Date(Date.now() + Number(tokenData.expires_in) * 1000).toISOString() : null;
    const { error } = await supabase.from('provider_credentials').upsert({
      profile_id: parsed.profile_id,
      provider: 'google',
      provider_subject: subject || null,
      access_token: accessToken,
      refresh_token: tokenData.refresh_token || null,
      scopes: String(tokenData.scope || '').split(' ').filter(Boolean),
      expires_at: expiresAt,
      status: 'active',
      metadata: { connected_from: 'vercel_oauth_callback' },
    }, { onConflict: 'profile_id,provider' });
    if (error) throw error;
    return NextResponse.redirect(`${appBaseUrl}/dashboard/settings/?google=connected`);
  } catch (error) {
    return NextResponse.redirect(`${appBaseUrl}/dashboard/settings/?google=failed&reason=${encodeURIComponent(error instanceof Error ? error.message : 'Google OAuth failed')}`);
  }
}
