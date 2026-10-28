import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase, userFromBearer } from '../../../../lib/server-integrations';
import { isAllowedPushEndpoint } from '../../../../lib/push-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Saves (or removes) this browser's push subscription for the signed-in user.
// Body: { subscription: { endpoint, keys: { p256dh, auth } }, userAgent? }
//   or: { action: 'unsubscribe', endpoint }
// POST only (the CORS config for the GitHub Pages copy does not allow DELETE).
type Body = {
  action?: 'subscribe' | 'unsubscribe';
  endpoint?: string;
  userAgent?: string;
  subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
};

export async function POST(request: NextRequest) {
  try {
    const { user } = await userFromBearer(request.headers.get('authorization'));
    const body = await request.json().catch(() => ({})) as Body;
    const supabase = serverSupabase();

    if (body.action === 'unsubscribe') {
      const endpoint = String(body.endpoint || '');
      if (!endpoint) throw new Error('Missing endpoint.');
      const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint).eq('profile_id', user.id);
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true, message: 'Push alerts are off on this device.' });
    }

    const endpoint = String(body.subscription?.endpoint || '');
    const p256dh = String(body.subscription?.keys?.p256dh || '');
    const auth = String(body.subscription?.keys?.auth || '');
    if (!endpoint || !p256dh || !auth) throw new Error('That browser subscription is incomplete.');
    if (!isAllowedPushEndpoint(endpoint)) throw new Error('That push service is not supported.');
    if (p256dh.length > 200 || auth.length > 100) throw new Error('That browser subscription looks wrong.');

    // Upsert by endpoint: if someone else signed in on this browser before, the device moves to this account.
    const { error } = await supabase.from('push_subscriptions').upsert({
      profile_id: user.id,
      endpoint,
      p256dh,
      auth,
      user_agent: String(body.userAgent || request.headers.get('user-agent') || '').slice(0, 300) || null,
      failures: 0,
    }, { onConflict: 'endpoint' });
    if (error) throw new Error(/push_subscriptions|42P01|schema cache/i.test(error.message) ? 'Push alerts switch on after the latest database update.' : error.message);
    return NextResponse.json({ ok: true, message: 'Push alerts are on for this device.' });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Could not save push settings.' }, { status: 400 });
  }
}
