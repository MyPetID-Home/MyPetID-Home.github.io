import { NextRequest, NextResponse } from 'next/server';
import { isAdminEmail } from '../../../../lib/supabase';
import { appBaseUrl, serverSupabase, userFromBearer } from '../../../../lib/server-integrations';
import { assertSafeEmailAddress, sendEmail } from '../../../../lib/email-verification';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Emails an announcement to its audience (the in-app notifications are created by the database).
// Capped per run because the Yahoo SMTP account has a daily sending limit.
const MAX_PER_RUN = 300;

function htmlEscape(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char));
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await userFromBearer(request.headers.get('authorization'));
    const supabase = serverSupabase();
    const { data: me } = await supabase.from('profiles').select('is_admin,tier').eq('id', user.id).maybeSingle();
    if (!me?.is_admin && me?.tier !== 'admin' && !isAdminEmail(user.email)) throw new Error('Admin access required.');

    const { announcementId } = await request.json() as { announcementId?: string };
    if (!announcementId) throw new Error('Missing announcement.');
    const { data: note, error } = await supabase.from('announcements').select('*').eq('id', announcementId).single();
    if (error || !note) throw new Error('Announcement not found.');
    if (note.emailed_at) return NextResponse.json({ ok: true, sent: 0, message: 'This announcement was already emailed.' });

    let query = supabase.from('profiles').select('email,tier,is_admin').not('email', 'is', null);
    if (note.audience === 'admins') query = query.or('is_admin.eq.true,tier.eq.admin');
    if (note.audience === 'members') query = query.neq('tier', 'free');
    if (note.audience === 'free') query = query.eq('tier', 'free');
    const { data: people, error: peopleError } = await query.limit(MAX_PER_RUN);
    if (peopleError) throw peopleError;

    const link = note.link ? new URL(note.link, appBaseUrl).href : `${appBaseUrl}/dashboard/`;
    const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#14211b"><h2 style="color:#238a42">${htmlEscape(note.title)}</h2><p style="white-space:pre-wrap;line-height:1.6">${htmlEscape(note.body)}</p><p><a href="${htmlEscape(link)}" style="display:inline-block;background:#238a42;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none">Open MyPetID</a></p><p style="color:#6a776b;font-size:12px">You're getting this because you have a MyPetID account.</p></div>`;
    let sent = 0;
    for (const person of people || []) {
      try { assertSafeEmailAddress(person.email); await sendEmail(person.email, note.title, `${note.title}\n\n${note.body}\n\n${link}`, html); sent += 1; } catch { /* skip bad address */ }
    }
    await supabase.from('announcements').update({ emailed_at: new Date().toISOString() }).eq('id', announcementId);
    return NextResponse.json({ ok: true, sent, message: `Emailed ${sent} ${sent === 1 ? 'person' : 'people'}.` });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Email failed' }, { status: 400 });
  }
}
