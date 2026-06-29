import { createHmac } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { appBaseUrl, userFromBearer } from '../../../../../lib/server-integrations';

export const dynamic = 'force-dynamic';

function signState(profileId: string) {
  const secret = process.env.PATREON_CLIENT_SECRET;
  if (!secret) throw new Error('Patreon client secret is not configured.');
  const payload = { profile_id: profileId, nonce: crypto.randomUUID(), created_at: Date.now() };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await userFromBearer(request.headers.get('authorization'));
    const clientId = process.env.PATREON_CLIENT_ID;
    if (!clientId) throw new Error('Patreon client ID is not configured.');
    const redirectUri = `${appBaseUrl}/api/patreon/oauth/callback/`;
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      state: signState(user.id),
      scope: 'identity identity[email] identity.memberships',
    });
    return NextResponse.json({ url: `https://www.patreon.com/oauth2/authorize?${params.toString()}` });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Patreon OAuth start failed' }, { status: 400 });
  }
}
