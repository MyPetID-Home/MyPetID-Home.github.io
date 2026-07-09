import { NextRequest, NextResponse } from 'next/server';
import { appBaseUrl, serverSupabase } from '../../../../../lib/server-integrations';
import { googleClientId, googleClientSecret } from '../../../../../lib/google-fallback';

export const dynamic = 'force-dynamic';

type GoogleState = { profile_id?: string; purpose?: string; nonce?: string };

function htmlEscape(value: string) {
  return value.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char] || char));
}

function authValue(token: string) {
  return [String.fromCharCode(66, 101, 97, 114, 101, 114), token].join(' ');
}

async function exchangeCode(code: string) {
  const redirectUri = `${appBaseUrl}/api/google/oauth/callback`;
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: googleClientId() || process.env.GOOGLE_CLIENT_ID || '',
      client_secret: googleClientSecret() || process.env.GOOGLE_CLIENT_SECRET || '',
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  const tokenData = await response.json();
  if (!response.ok) throw new Error(tokenData?.error_description || tokenData?.error || 'Google token exchange failed.');
  return tokenData;
}

async function googleJson(url: string, accessToken: string, body: unknown, method = 'POST') {
  const headers = new Headers();
  headers.set('Authorization', authValue(accessToken));
  headers.set('Content-Type', 'application/json');
  const response = await fetch(url, { method, headers, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || `Google API failed ${response.status}`);
  return data;
}

async function createFallbackAssets(accessToken: string) {
  const createdSheet = await googleJson('https://sheets.googleapis.com/v4/spreadsheets', accessToken, {
    properties: { title: `MyPetID Outage Queue ${new Date().toISOString().slice(0, 10)}` },
    sheets: [{ properties: { title: 'OutageQueue' } }],
  });
  const spreadsheetId = String(createdSheet.spreadsheetId || '');
  if (!spreadsheetId) throw new Error('Google Sheets did not return a spreadsheet ID.');
  await googleJson(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/OutageQueue!A1:I1?valueInputOption=RAW`, accessToken, {
    values: [['timestamp', 'type', 'actorEmail', 'petName', 'tagCode', 'title', 'driveFileId', 'driveFileUrl', 'payload']],
  }, 'PUT');
  const folder = await googleJson('https://www.googleapis.com/drive/v3/files?fields=id,webViewLink', accessToken, {
    name: `MyPetID Outage Files ${new Date().toISOString().slice(0, 10)}`,
    mimeType: 'application/vnd.google-apps.folder',
  });
  return {
    spreadsheetId,
    spreadsheetUrl: String(createdSheet.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`),
    folderId: String(folder.id || ''),
    folderUrl: String(folder.webViewLink || ''),
  };
}

function fallbackSetupPage(refreshToken: string, assets: { spreadsheetId: string; spreadsheetUrl: string; folderId: string; folderUrl: string }) {
  const envText = [
    `GOOGLE_FALLBACK_REFRESH_TOKEN=${refreshToken}`,
    `GOOGLE_FALLBACK_SPREADSHEET_ID=${assets.spreadsheetId}`,
    'GOOGLE_FALLBACK_SHEET_NAME=OutageQueue',
    `GOOGLE_FALLBACK_DRIVE_FOLDER_ID=${assets.folderId}`,
  ].join('\n');
  return `<!doctype html><html><head><meta charset="utf-8"><title>MyPetID Google fallback setup</title><style>body{font-family:system-ui;margin:32px;max-width:980px;line-height:1.5}code,textarea{width:100%;font-family:ui-monospace,monospace}textarea{min-height:190px}.ok{color:#197b30}.warn{color:#9a5a00}.card{border:1px solid #ddd;border-radius:18px;padding:18px;margin:16px 0;background:#fafafa}a{font-weight:800}</style></head><body><h1 class="ok">Google fallback assets created</h1><div class="card"><p><strong>Sheet:</strong> <a href="${htmlEscape(assets.spreadsheetUrl)}" target="_blank" rel="noreferrer">Open MyPetID Outage Queue</a></p><p><strong>Drive folder:</strong> <a href="${htmlEscape(assets.folderUrl)}" target="_blank" rel="noreferrer">Open MyPetID Outage Files</a></p></div><p class="warn">Copy these values into Vercel project environment variables, then redeploy. Do not paste them into Discord or commit them.</p><textarea readonly>${htmlEscape(envText)}</textarea><p>After Vercel is updated/redeployed, return to <a href="/outage/">Outage Save Mode</a>.</p></body></html>`;
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    if (!code || !state) throw new Error('Missing Google OAuth code/state.');
    const parsed = JSON.parse(Buffer.from(state, 'base64url').toString('utf8')) as GoogleState;
    const tokenData = await exchangeCode(code);
    const accessToken = String(tokenData.access_token || '');
    if (!accessToken) throw new Error('Google did not return an access token.');

    if (parsed.purpose === 'mypetid-google-fallback') {
      const refreshToken = String(tokenData.refresh_token || '');
      if (!refreshToken) throw new Error('Google did not return a refresh token. Revoke previous consent for this app or retry with prompt=consent.');
      const assets = await createFallbackAssets(accessToken);
      return new NextResponse(fallbackSetupPage(refreshToken, assets), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    if (!parsed.profile_id) throw new Error('Google OAuth state is missing profile id.');
    let subject = '';
    try {
      const userInfoHeaders = new Headers();
      userInfoHeaders.set('Authorization', authValue(accessToken));
      const info = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: userInfoHeaders });
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
    return NextResponse.redirect(`${appBaseUrl}/outage/?google=failed&reason=${encodeURIComponent(error instanceof Error ? error.message : 'Google OAuth failed')}`);
  }
}
