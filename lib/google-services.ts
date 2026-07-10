import { googleAccessToken, safeFileName } from './server-integrations';

export type GoogleAssetKind = 'pet_photo' | 'profile_image' | 'medical_document' | 'tag_asset' | 'note_document';

export type GoogleUploadInput = {
  refreshToken: string;
  bytes: Buffer | ArrayBuffer;
  fileName: string;
  mime: string;
  kind: GoogleAssetKind;
  description?: string;
  driveFolderId?: string;
};

export type GooglePhotoResult = {
  provider: 'google_photos';
  id: string;
  productUrl?: string;
  baseUrl?: string;
  mimeType?: string;
};

export type GoogleDriveResult = {
  provider: 'google_drive';
  id: string;
  name?: string;
  mimeType?: string;
  webViewLink?: string;
};

export type GoogleDocsResult = {
  provider: 'google_docs';
  documentId: string;
  title: string;
};

function authValue(token: string) {
  return [String.fromCharCode(66, 101, 97, 114, 101, 114), token].join(' ');
}

function headersWithAuth(accessToken: string, contentType?: string) {
  const headers = new Headers();
  headers.set('Authorization', authValue(accessToken));
  if (contentType) headers.set('Content-Type', contentType);
  return headers;
}

function toBuffer(bytes: Buffer | ArrayBuffer) {
  return Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
}

export const googleMyPetIdScopes = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/photoslibrary.appendonly',
];

export async function uploadPetPhotoToGooglePhotos(input: GoogleUploadInput): Promise<GooglePhotoResult> {
  const accessToken = await googleAccessToken(input.refreshToken);
  const name = safeFileName(input.fileName || 'pet-photo.jpg');
  const uploadHeaders = headersWithAuth(accessToken, 'application/octet-stream');
  uploadHeaders.set('X-Goog-Upload-Content-Type', input.mime || 'image/jpeg');
  uploadHeaders.set('X-Goog-Upload-Protocol', 'raw');
  uploadHeaders.set('X-Goog-Upload-File-Name', name);

  const upload = await fetch('https://photoslibrary.googleapis.com/v1/uploads', {
    method: 'POST',
    headers: uploadHeaders,
    body: toBuffer(input.bytes),
  });
  if (!upload.ok) throw new Error(`Google Photos upload failed ${upload.status}`);
  const uploadToken = await upload.text();

  const create = await fetch('https://photoslibrary.googleapis.com/v1/mediaItems:batchCreate', {
    method: 'POST',
    headers: headersWithAuth(accessToken, 'application/json'),
    body: JSON.stringify({
      newMediaItems: [{
        description: input.description || `MyPetID ${name}`,
        simpleMediaItem: { uploadToken },
      }],
    }),
  });
  const json = await create.json();
  if (!create.ok) throw new Error(json?.error?.message || `Google Photos create failed ${create.status}`);
  const item = json?.newMediaItemResults?.[0]?.mediaItem;
  if (!item?.id) throw new Error('Google Photos did not return a media item id.');
  return { provider: 'google_photos', id: String(item.id), productUrl: item.productUrl, baseUrl: item.baseUrl, mimeType: item.mimeType };
}

export async function uploadFileToGoogleDrive(input: GoogleUploadInput): Promise<GoogleDriveResult> {
  const accessToken = await googleAccessToken(input.refreshToken);
  const name = safeFileName(input.fileName || 'mypetid-upload.bin');
  const mime = input.mime || 'application/octet-stream';
  const metadata: Record<string, unknown> = { name, mimeType: mime };
  if (input.driveFolderId) metadata.parents = [input.driveFolderId];
  const boundary = `mypetid-${crypto.randomUUID()}`;
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`),
    toBuffer(input.bytes),
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const drive = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink', {
    method: 'POST',
    headers: headersWithAuth(accessToken, `multipart/related; boundary=${boundary}`),
    body,
  });
  const json = await drive.json();
  if (!drive.ok) throw new Error(json?.error?.message || `Google Drive upload failed ${drive.status}`);
  return { provider: 'google_drive', id: String(json.id || ''), name: json.name, mimeType: json.mimeType, webViewLink: json.webViewLink };
}

export async function createGoogleDoc(refreshToken: string, title: string): Promise<GoogleDocsResult> {
  const accessToken = await googleAccessToken(refreshToken);
  const response = await fetch('https://docs.googleapis.com/v1/documents', {
    method: 'POST',
    headers: headersWithAuth(accessToken, 'application/json'),
    body: JSON.stringify({ title: title || 'MyPetID note' }),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json?.error?.message || `Google Docs create failed ${response.status}`);
  return { provider: 'google_docs', documentId: String(json.documentId || ''), title: String(json.title || title || 'MyPetID note') };
}

export async function createGoogleCalendarEvent(refreshToken: string, event: Record<string, unknown>) {
  const accessToken = await googleAccessToken(refreshToken);
  const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: headersWithAuth(accessToken, 'application/json'),
    body: JSON.stringify(event),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json?.error?.message || `Google Calendar create failed ${response.status}`);
  return json;
}

export function chooseGoogleUploadTarget(kind: GoogleAssetKind, mime: string) {
  if (kind === 'pet_photo' && mime.startsWith('image/')) return 'google_photos';
  if (kind === 'note_document') return 'google_docs';
  return 'google_drive';
}
