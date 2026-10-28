import { NextRequest, NextResponse } from 'next/server';
import { safeEqual, sendPushToProfile } from '../../../../lib/push-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Called by a Supabase Database Webhook on public.notifications INSERT (see docs/push-setup.md).
// Every new notifications row (scan alerts, lost-dog alerts, announcements, reminders...) is
// pushed to all of that profile's saved devices.
//
// Auth: header x-push-secret must equal PUSH_WEBHOOK_SECRET (compared in constant time).
type WebhookBody = {
  type?: string;
  table?: string;
  schema?: string;
  record?: { id?: string; profile_id?: string; kind?: string; title?: string; body?: string | null; link?: string | null } | null;
};

export async function POST(request: NextRequest) {
  const secret = process.env.PUSH_WEBHOOK_SECRET || '';
  const given = request.headers.get('x-push-secret') || '';
  if (!secret || !given || !safeEqual(given, secret)) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({})) as WebhookBody;
    if (body.type !== 'INSERT' || body.table !== 'notifications' || !body.record?.profile_id) {
      return NextResponse.json({ ok: true, skipped: 'not a notifications insert' });
    }
    const note = body.record;
    // Only same-site paths are passed on; the service worker resolves them against its own origin.
    const link = typeof note.link === 'string' && note.link.startsWith('/') && !note.link.startsWith('//') ? note.link : '/dashboard/';
    const result = await sendPushToProfile(String(note.profile_id), { title: note.title || 'MyPetID', body: note.body, url: link, kind: note.kind, id: note.id });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    // 200 with ok:false for configuration problems so the webhook does not retry forever.
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Push failed' });
  }
}
