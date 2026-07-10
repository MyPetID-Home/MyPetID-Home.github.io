import { NextResponse } from 'next/server';
import { appBaseUrl } from '../../../../lib/server-integrations';
import { googleMyPetIdScopes } from '../../../../lib/google-services';

export const dynamic = 'force-dynamic';

export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
  const redirectUri = `${appBaseUrl}/api/google/oauth/callback`;
  return NextResponse.json({
    ok: true,
    configured: Boolean(clientId && clientSecret),
    missing: {
      clientId: !clientId,
      clientSecret: !clientSecret,
    },
    redirectUri,
    scopes: googleMyPetIdScopes,
    targets: {
      photos: 'Google Photos for pet photo originals',
      drive: 'Google Drive for files, medical docs, attachments, tag/card assets',
      docs: 'Google Docs for editable notes/care documents',
      calendar: 'Google Calendar for reminders and care events',
    },
    supabaseRequiredForUserConnection: true,
    note: 'This readiness check does not touch Supabase. User-level Google token storage still resumes when Supabase is available.',
  });
}
