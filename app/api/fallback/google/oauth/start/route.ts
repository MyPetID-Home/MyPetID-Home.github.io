import { NextResponse } from 'next/server';
import { appBaseUrl } from '../../../../../../lib/server-integrations';
import { googleClientId } from '../../../../../../lib/google-fallback';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const clientId = googleClientId();
    if (!clientId) throw new Error('Google client ID is not configured.');
    const redirectUri = `${appBaseUrl}/api/google/oauth/callback`;
    const state = Buffer.from(JSON.stringify({ purpose: 'mypetid-google-fallback', nonce: crypto.randomUUID() })).toString('base64url');
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/spreadsheets',
    ].join(' '));
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('state', state);
    return NextResponse.redirect(url.toString());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Google fallback OAuth start failed.' }, { status: 400 });
  }
}
