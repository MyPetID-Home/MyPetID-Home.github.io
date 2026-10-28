import { NextRequest, NextResponse } from 'next/server';
import { isAdminEmail } from '../../../../lib/supabase';
import { serverSupabase, userFromBearer } from '../../../../lib/server-integrations';
import { sendPushToProfile } from '../../../../lib/push-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Admin check for push: sends a test message straight to the caller's own devices
// (without creating a notifications row), so setup can be verified end to end.
export async function POST(request: NextRequest) {
  try {
    const { user } = await userFromBearer(request.headers.get('authorization'));
    const supabase = serverSupabase();
    const { data: me } = await supabase.from('profiles').select('is_admin,tier').eq('id', user.id).maybeSingle();
    if (!me?.is_admin && me?.tier !== 'admin' && !isAdminEmail(user.email)) throw new Error('Admin access required.');
    const result = await sendPushToProfile(user.id, { title: 'MyPetID test alert', body: 'Push alerts work on this device.', url: '/dashboard/', kind: 'system', id: null });
    const message = result.devices === 0 ? 'No devices are subscribed for your account yet. Turn on push alerts first.' : `Sent to ${result.sent} of ${result.devices} device${result.devices === 1 ? '' : 's'}${result.removed ? `, removed ${result.removed} expired` : ''}.`;
    return NextResponse.json({ ok: true, ...result, message });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Test push failed' }, { status: 400 });
  }
}
