import { NextRequest, NextResponse } from 'next/server';
import { appBaseUrl } from '../../../../../../lib/server-integrations';
import { googleClientId, googleClientSecret } from '../../../../../../lib/google-fallback';

export const dynamic = 'force-dynamic';

function htmlEscape(value: string) {
  return value.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char] || char));
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    if (!code) throw new Error('Missing Google authorization code.');
    const redirectUri = `${appBaseUrl}/api/fallback/google/oauth/callback`;
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: googleClientId(),
        client_secret: googleClientSecret(),
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    const tokenData = await response.json();
    if (!response.ok) throw new Error(tokenData?.error_description || tokenData?.error || 'Google token exchange failed.');
    const refreshToken = String(tokenData.refresh_token || '');
    if (!refreshToken) throw new Error('Google did not return a refresh token. Revoke previous consent for this app or retry with prompt=consent.');
    const body = `<!doctype html><html><head><meta charset="utf-8"><title>MyPetID Google fallback token</title><style>body{font-family:system-ui;margin:32px;max-width:900px}code,textarea{width:100%;font-family:ui-monospace,monospace}.ok{color:#197b30}.warn{color:#9a5a00}textarea{min-height:120px}</style></head><body><h1 class="ok">Google fallback authorization complete</h1><p>Copy this refresh token into Vercel as <code>GOOGLE_FALLBACK_REFRESH_TOKEN</code>. Do not paste it in Discord or commit it.</p><textarea readonly>${htmlEscape(refreshToken)}</textarea><p class="warn">After saving it in Vercel, also configure <code>GOOGLE_FALLBACK_SPREADSHEET_ID</code>, optional <code>GOOGLE_FALLBACK_DRIVE_FOLDER_ID</code>, and redeploy.</p><p><a href="/outage/">Return to outage save mode</a></p></body></html>`;
    return new NextResponse(body, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  } catch (error) {
    return NextResponse.redirect(`${appBaseUrl}/outage/?google=failed&reason=${encodeURIComponent(error instanceof Error ? error.message : 'Google fallback OAuth failed')}`);
  }
}
