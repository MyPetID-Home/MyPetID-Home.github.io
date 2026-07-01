import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase, userFromBearer } from '../../../../lib/server-integrations';
import { hashVerificationCode } from '../../../../lib/email-verification';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { user } = await userFromBearer(request.headers.get('authorization'));
    const body = await request.json();
    const code = String(body.code || '').replace(/\D/g, '');
    const purpose = String(body.purpose || 'signup');
    if (!/^\d{6}$/.test(code)) throw new Error('Enter the 6-digit verification code.');
    if (!['signup', 'email_change', 'account_recovery'].includes(purpose)) throw new Error('Unsupported verification purpose.');
    const supabase = serverSupabase();
    const { data: profile, error: profileError } = await supabase.from('profiles').select('id,email').eq('id', user.id).maybeSingle();
    if (profileError) throw profileError;
    const email = String(profile?.email || user.email || '').trim().toLowerCase();
    if (!email) throw new Error('No account email is available to verify.');
    const { data: rows, error: codeError } = await supabase.from('email_verification_codes')
      .select('*')
      .eq('profile_id', user.id)
      .eq('email', email)
      .eq('purpose', purpose)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1);
    if (codeError) throw codeError;
    const row = rows?.[0];
    if (!row) throw new Error('No active verification code found. Request a new code.');
    if (Number(row.attempts || 0) >= 5) {
      await supabase.from('email_verification_codes').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('id', row.id);
      throw new Error('Too many attempts. Request a new code.');
    }
    const expected = hashVerificationCode(user.id, email, code);
    if (expected !== row.code_hash) {
      await supabase.from('email_verification_codes').update({ attempts: Number(row.attempts || 0) + 1, updated_at: new Date().toISOString() }).eq('id', row.id);
      throw new Error('Verification code did not match.');
    }
    const now = new Date().toISOString();
    const { error: updateCodeError } = await supabase.from('email_verification_codes').update({ status: 'verified', verified_at: now, attempts: Number(row.attempts || 0) + 1, updated_at: now }).eq('id', row.id);
    if (updateCodeError) throw updateCodeError;
    const { data: updatedProfile, error: updateProfileError } = await supabase.from('profiles').update({ email_verified_at: now, updated_at: now }).eq('id', user.id).select('*').single();
    if (updateProfileError) throw updateProfileError;
    await supabase.from('verification_requests').insert({ profile_id: user.id, provider: 'email', requested_scopes: [purpose], status: 'verified', provider_subject: email, metadata: { verified_from: 'code' }, reviewed_at: now });
    return NextResponse.json({ verified: true, email, profile: updatedProfile });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Email verification failed.' }, { status: 400 });
  }
}
