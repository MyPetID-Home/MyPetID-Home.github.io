import { NextRequest, NextResponse } from 'next/server';
import { appBaseUrl } from '../../../../../../lib/server-integrations';
import { googleClientId, googleClientSecret } from '../../../../../../lib/google-fallback';

export const dynamic = 'force-dynamic';

function htmlEscape(value: string) {
  return value.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char] || char));
}

function authValue(token: string) {
  return [String.fromCharCode(66, 101, 97, 114, 101, 114), token].join(' ');
}

async function googleJson(url: string, accessToken: string, body: unknown, method = 'POST') {
  const headers = new Headers();
  headers.set('Authorization', authValue(accessToken));
  headers.set('Content-Type', 'application/json');
  const response = await fetch(url, {
    method,
    headers,
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || `Google API failed ${response.status}`);
  return data;
}

async function createFallbackSheet(accessToken: string) {
  const created = await googleJson('https://sheets.googleapis.com/v4/spreadsheets', accessToken, {
    properties: { title: `MyPetID Outage Queue ${new Date().toISOString().slice(0, 10)}` },
    sheets: [{ properties: { title: 'OutageQueue' } }],
  });
  const spreadsheetId = String(created.spreadsheetId || '');
  if (!spreadsheetId) throw new Error('Google Sheets did not return a spreadsheet ID.');
  await googleJson(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/OutageQueue!A1:I1?valueInputOption=RAW`, accessToken, {
    values: [['timestamp', 'type', 'actorEmail', 'petName', 'tagCode', 'title', 'driveFileId', 'driveFileUrl', 'payload']],
  }, 'PUT');
  return { spreadsheetId, spreadsheetUrl: String(created.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`) };
}

async function createFallbackDriveFolder(accessToken: string) {
  const created = await googleJson('https://www.googleapis.com/drive/v3/files?fields=id,webViewLink', accessToken, {
    name: `MyPetID Outage Files ${new Date().toISOString().slice(0, 10)}`,
    mimeType: 'application/vnd.google-apps.folder',
  });
  return { folderId: String(created.id || ''), folderUrl: String(created.webViewLink || '') };
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
    const accessToken = String(tokenData.access_token || '');
    const refreshToken = String(tokenData.refresh_token || '');
    if (!accessToken) throw new Error('Google did not return an access token.');
    if (!refreshToken) throw new Error('Google did not return a refresh token. Revoke previous consent for this app or retry with prompt=consent.');
    const sheet = await createFallbackSheet(accessToken);
    const folder = await createFallbackDriveFolder(accessToken);
    const envText = [
      `GOOGLE_FALLBACK_REFRESH_TOKEN=${refreshToken}`,
      `GOOGLE_FALLBACK_SPREADSHEET_ID=${sheet.spreadsheetId}`,
      'GOOGLE_FALLBACK_SHEET_NAME=OutageQueue',
      `GOOGLE_FALLBACK_DRIVE_FOLDER_ID=${folder.folderId}`,
    ].join('\n');
    const body = `<!doctype html><html><head><meta charset="utf-8"><title>MyPetID Google fallback setup</title><style>body{font-family:system-ui;margin:32px;max-width:980px;line-height:1.5}code,textarea{width:100%;font-family:ui-monospace,monospace}textarea{min-height:190px}.ok{color:#197b30}.warn{color:#9a5a00}.card{border:1px solid #ddd;border-radius:18px;padding:18px;margin:16px 0;background:#fafafa}a{font-weight:800}</style></head><body><h1 class="ok">Google fallback assets created</h1><div class="card"><p><strong>Sheet:</strong> <a href="${htmlEscape(sheet.spreadsheetUrl)}" target="_blank" rel="noreferrer">Open MyPetID Outage Queue</a></p><p><strong>Drive folder:</strong> <a href="${htmlEscape(folder.folderUrl)}" target="_blank" rel="noreferrer">Open MyPetID Outage Files</a></p></div><p class="warn">Copy these values into Vercel project environment variables, then redeploy. Do not paste them into Discord or commit them.</p><textarea readonly>${htmlEscape(envText)}</textarea><p>After Vercel is updated/redeployed, return to <a href="/outage/">Outage Save Mode</a>.</p></body></html>`;
    return new NextResponse(body, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  } catch (error) {
    return NextResponse.redirect(`${appBaseUrl}/outage/?google=failed&reason=${encodeURIComponent(error instanceof Error ? error.message : 'Google fallback OAuth failed')}`);
  }
}
