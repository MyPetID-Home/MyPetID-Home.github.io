import { NextRequest, NextResponse } from 'next/server';
import { appBaseUrl, userFromBearer } from '../../../../../lib/server-integrations';
import { googleMyPetIdScopes } from '../../../../../lib/google-services';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { user } = await userFromBearer(request.headers.get('authorization'));
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) throw new Error('Google client ID is not configured.');
    const scope = googleMyPetIdScopes.join(' ');
    const redirectUri = `${appBaseUrl}/api/google/oauth/callback`;
    const state = Buffer.from(JSON.stringify({ profile_id: user.id, nonce: crypto.randomUUID() })).toString('base64url');
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', scope);
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('state', state);
    return NextResponse.json({ url: url.toString(), redirectUri });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Google connect failed' }, { status: 400 });
  }
}
