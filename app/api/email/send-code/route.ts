import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase, userFromBearer } from '../../../../lib/server-integrations';
import { hashVerificationCode, makeVerificationCode, sendVerificationEmail, verificationSender } from '../../../../lib/email-verification';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { user } = await userFromBearer(request.headers.get('authorization'));
    const supabase = serverSupabase();
    const body = await request.json().catch(() => ({}));
    const purpose = String(body.purpose || 'signup');
    if (!['signup', 'email_change', 'account_recovery'].includes(purpose)) throw new Error('Unsupported verification purpose.');
    const { data: profile, error: profileError } = await supabase.from('profiles').select('id,email,email_verified_at').eq('id', user.id).maybeSingle();
    if (profileError) throw profileError;
    const email = String(profile?.email || user.email || '').trim().toLowerCase();
    if (!email) throw new Error('No account email is available to verify.');
    if (purpose === 'signup' && profile?.email_verified_at) return NextResponse.json({ sent: false, alreadyVerified: true, email, sender: verificationSender });

    const since = new Date(Date.now() - 60_000).toISOString();
    const { data: recent, error: recentError } = await supabase.from('email_verification_codes')
      .select('id,created_at')
      .eq('profile_id', user.id)
      .eq('purpose', purpose)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(1);
    if (recentError) throw recentError;
    if ((recent || []).length > 0) throw new Error('Please wait a minute before requesting another verification code.');

    const code = makeVerificationCode();
    const codeHash = hashVerificationCode(user.id, email, code);
    await sendVerificationEmail(email, code);
    const { error: insertError } = await supabase.from('email_verification_codes').insert({
      profile_id: user.id,
      email,
      purpose,
      code_hash: codeHash,
      metadata: { sender: verificationSender, user_agent: request.headers.get('user-agent') || null },
    });
    if (insertError) throw insertError;
    await supabase.from('verification_requests').insert({ profile_id: user.id, provider: 'email', requested_scopes: [purpose], status: 'pending', provider_subject: email, metadata: { sender: verificationSender } });
    return NextResponse.json({ sent: true, email, sender: verificationSender, expiresInMinutes: 15 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Email verification send failed.' }, { status: 400 });
  }
}
