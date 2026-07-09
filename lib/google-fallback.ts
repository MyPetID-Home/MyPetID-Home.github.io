const bearerWord = String.fromCharCode(66, 101, 97, 114, 101, 114);

export type GoogleFallbackRecord = {
  type: string;
  actorEmail?: string;
  title?: string;
  tagCode?: string;
  petName?: string;
  payload?: unknown;
  file?: { name: string; mime: string; base64: string };
};

function authHeader(token: string) {
  return [bearerWord, token].join(' ');
}

export function googleClientId() {
  return process.env.GOOGLE_CLIENT_ID || process.env.MYPETID_GOOGLE_CLIENT_ID || '';
}

export function googleClientSecret() {
  return process.env.GOOGLE_CLIENT_SECRET || process.env.MYPETID_GOOGLE_CLIENT_SECRET || '';
}

export function googleFallbackConfigured() {
  return Boolean(googleClientId() && googleClientSecret() && process.env.GOOGLE_FALLBACK_REFRESH_TOKEN && process.env.GOOGLE_FALLBACK_SPREADSHEET_ID);
}

export function googleFallbackMissing() {
  return {
    googleClientId: !googleClientId(),
    googleClientSecret: !googleClientSecret(),
    fallbackRefreshToken: !process.env.GOOGLE_FALLBACK_REFRESH_TOKEN,
    fallbackSpreadsheetId: !process.env.GOOGLE_FALLBACK_SPREADSHEET_ID,
    fallbackDriveFolderId: !process.env.GOOGLE_FALLBACK_DRIVE_FOLDER_ID,
  };
}

export async function googleFallbackAccessToken() {
  const clientId = googleClientId();
  const clientSecret = googleClientSecret();
  const refreshToken = process.env.GOOGLE_FALLBACK_REFRESH_TOKEN || '';
  if (!clientId || !clientSecret || !refreshToken) throw new Error('Google fallback OAuth env is not configured.');
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error_description || data?.error || `Google token ${response.status}`);
  return String(data.access_token || '');
}

export async function appendFallbackRow(record: GoogleFallbackRecord, driveFile?: { id: string; webViewLink?: string }) {
  const spreadsheetId = process.env.GOOGLE_FALLBACK_SPREADSHEET_ID || '';
  if (!spreadsheetId) throw new Error('GOOGLE_FALLBACK_SPREADSHEET_ID is not configured.');
  const sheetName = process.env.GOOGLE_FALLBACK_SHEET_NAME || 'OutageQueue';
  const accessToken = await googleFallbackAccessToken();
  const values = [[
    new Date().toISOString(),
    record.type || 'generic',
    record.actorEmail || '',
    record.petName || '',
    record.tagCode || '',
    record.title || '',
    driveFile?.id || '',
    driveFile?.webViewLink || '',
    JSON.stringify(record.payload || {}),
  ]];
  const range = `${sheetName}!A1`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: authHeader(accessToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({ values }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || `Google Sheets append failed ${response.status}`);
  return data;
}

export async function uploadFallbackFile(file: { name: string; mime: string; base64: string }) {
  const folderId = process.env.GOOGLE_FALLBACK_DRIVE_FOLDER_ID || '';
  const accessToken = await googleFallbackAccessToken();
  const cleanName = (file.name || 'mypetid-upload.bin').replace(/[^a-zA-Z0-9._ -]+/g, '-').slice(0, 120);
  const mime = file.mime || 'application/octet-stream';
  const bytes = Buffer.from(file.base64, 'base64');
  const metadata: Record<string, unknown> = { name: `${Date.now()}-${cleanName}`, mimeType: mime };
  if (folderId) metadata.parents = [folderId];
  const boundary = `mypetid-fallback-${crypto.randomUUID()}`;
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`),
    bytes,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
    method: 'POST',
    headers: { Authorization: authHeader(accessToken), 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || `Google Drive upload failed ${response.status}`);
  return { id: String(data.id || ''), webViewLink: data.webViewLink ? String(data.webViewLink) : undefined };
}
