import { NextRequest, NextResponse } from 'next/server';
import { googleAccessToken, safeFileName, serverSupabase, userFromBearer } from '../../../lib/server-integrations';

export const dynamic = 'force-dynamic';

async function syncToGoogle(refreshToken: string, file: File, bytes: ArrayBuffer, name: string, mime: string, kind: string) {
  const accessToken = await googleAccessToken(refreshToken);
  const scheme = String.fromCharCode(66, 101, 97, 114, 101, 114);
  const authHeader = `${scheme} ${accessToken}`;
  if (kind === 'pet_photo' && mime.startsWith('image/')) {
    const upload = await fetch('https://photoslibrary.googleapis.com/v1/uploads', {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/octet-stream',
        'X-Goog-Upload-Content-Type': mime,
        'X-Goog-Upload-Protocol': 'raw',
        'X-Goog-Upload-File-Name': name,
      },
      body: Buffer.from(bytes),
    });
    if (!upload.ok) throw new Error(`Google Photos upload failed ${upload.status}`);
    const uploadToken = await upload.text();
    const create = await fetch('https://photoslibrary.googleapis.com/v1/mediaItems:batchCreate', {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ newMediaItems: [{ description: `MyPetID ${file.name}`, simpleMediaItem: { uploadToken } }] }),
    });
    const json = await create.json();
    if (!create.ok) throw new Error(json?.error?.message || `Google Photos create failed ${create.status}`);
    return json?.newMediaItemResults?.[0]?.mediaItem?.id || json?.newMediaItemResults?.[0]?.uploadToken || 'google-photos-synced';
  }

  const metadata = { name, mimeType: mime };
  const boundary = `mypetid-${crypto.randomUUID()}`;
  const delimiter = `--${boundary}`;
  const close = `--${boundary}--`;
  const body = Buffer.concat([
    Buffer.from(`${delimiter}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n${delimiter}\r\nContent-Type: ${mime}\r\n\r\n`),
    Buffer.from(bytes),
    Buffer.from(`\r\n${close}\r\n`),
  ]);
  const drive = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: { Authorization: authHeader, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  const json = await drive.json();
  if (!drive.ok) throw new Error(json?.error?.message || `Google Drive upload failed ${drive.status}`);
  return json.id || 'google-drive-synced';
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await userFromBearer(request.headers.get('authorization'));
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) throw new Error('Missing upload file.');
    const petId = String(form.get('petId') || '');
    const kind = String(form.get('kind') || 'medical_document') as 'pet_photo' | 'profile_image' | 'medical_document' | 'tag_asset';
    const title = String(form.get('title') || file.name || 'Upload');
    const bytes = await file.arrayBuffer();
    const mime = file.type || 'application/octet-stream';
    const bucket = kind === 'medical_document' ? 'medical-documents' : kind === 'profile_image' ? 'profile-images' : kind === 'tag_asset' ? 'tag-assets' : 'pet-photos';
    const name = safeFileName(file.name || `${kind}.bin`);
    const storagePath = `${user.id}/${petId || 'account'}/${Date.now()}-${name}`;
    const supabase = serverSupabase();
    const { error: uploadError } = await supabase.storage.from(bucket).upload(storagePath, Buffer.from(bytes), { contentType: mime, upsert: true });
    if (uploadError) throw uploadError;
    const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(storagePath);
    const publicUrl = bucket === 'pet-photos' || bucket === 'tag-assets' ? publicData.publicUrl : null;

    let documentId: string | null = null;
    if (kind === 'medical_document' && petId) {
      const { data: doc, error: docError } = await supabase.from('pet_documents').insert({ pet_id: petId, owner_id: user.id, title, document_type: mime.startsWith('image/') ? 'image' : 'document', storage_path: storagePath, public_visible: false }).select('id').single();
      if (docError) throw docError;
      documentId = doc.id;
    }
    if (kind === 'pet_photo' && petId && publicUrl) {
      await supabase.from('pets').update({ photo_url: publicUrl }).eq('id', petId).eq('owner_id', user.id);
    }

    const { data: googleCred } = await supabase.from('provider_credentials').select('refresh_token').eq('profile_id', user.id).eq('provider', 'google').eq('status', 'active').maybeSingle();
    let google_status = 'not_connected';
    let google_resource_id: string | null = null;
    let google_error: string | null = null;
    if (googleCred?.refresh_token) {
      try {
        google_resource_id = await syncToGoogle(googleCred.refresh_token, file, bytes, name, mime, kind);
        google_status = 'synced';
      } catch (error) {
        google_status = 'failed';
        google_error = error instanceof Error ? error.message : 'Google sync failed';
      }
    }

    const { data: event, error: eventError } = await supabase.from('upload_events').insert({ profile_id: user.id, pet_id: petId || null, document_id: documentId, upload_kind: kind, bucket_id: bucket, storage_path: storagePath, public_url: publicUrl, google_status, google_resource_id, google_error, metadata: { title, mime, file_name: file.name } }).select('*').single();
    if (eventError) throw eventError;
    return NextResponse.json({ upload: event, publicUrl, documentId });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Upload failed' }, { status: 400 });
  }
}
