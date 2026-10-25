import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isAdminEmail } from '../../../../lib/supabase';
import { appBaseUrl, serverSupabase, userFromBearer } from '../../../../lib/server-integrations';
import { assertSafeEmailAddress, sendEmail } from '../../../../lib/email-verification';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type AccountEmailAction = 'verification' | 'password_reset' | 'magic_link';
const ACTIONS: AccountEmailAction[] = ['verification', 'password_reset', 'magic_link'];

async function requireAdmin(request: NextRequest) {
  const { user } = await userFromBearer(request.headers.get('authorization'));
  const supabase = serverSupabase();
  const { data: profile, error } = await supabase.from('profiles').select('id,email,tier,is_admin').eq('id', user.id).maybeSingle();
  if (error) throw error;
  if (!profile?.is_admin && profile?.tier !== 'admin' && !isAdminEmail(user.email)) throw new Error('Admin access required.');
  return { user, supabase };
}

function htmlEscape(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char));
}

const COPY: Record<AccountEmailAction, { subject: string; intro: string; button: string; done: string }> = {
  verification: {
    subject: 'Confirm your MyPetID email',
    intro: 'MyPetID support sent you this link to confirm your email address. Tap below to confirm it and sign in.',
    button: 'Confirm my email',
    done: 'Verification email sent',
  },
  password_reset: {
    subject: 'Reset your MyPetID password',
    intro: 'MyPetID support sent you a password reset link. Tap below to choose a new password.',
    button: 'Reset my password',
    done: 'Password reset email sent',
  },
  magic_link: {
    subject: 'Your MyPetID sign-in link',
    intro: 'MyPetID support sent you a one-time sign-in link. Tap below to sign in, no password needed.',
    button: 'Sign in to MyPetID',
    done: 'Sign-in link sent',
  },
};

async function sendBrandedLink(to: string, action: AccountEmailAction, link: string) {
  const copy = COPY[action];
  const text = `${copy.intro}\n\n${copy.button}: ${link}\n\nThis link works once and expires soon. If you did not ask MyPetID support for this, you can ignore this email.`;
  const html = `<p>${htmlEscape(copy.intro)}</p><p><a href="${htmlEscape(link)}" style="display:inline-block;padding:12px 20px;border-radius:999px;background:#87e06f;color:#071008;font-weight:800;text-decoration:none">${htmlEscape(copy.button)}</a></p><p style="color:#666;font-size:13px">This link works once and expires soon. If you did not ask MyPetID support for this, you can ignore this email.</p>`;
  await sendEmail(to, copy.subject, text, html);
}

// Generates the action link with the service role and mails it ourselves (Yahoo
// SMTP). If either step fails, falls back to Supabase's own mailer.
async function deliver(supabase: SupabaseClient, email: string, action: AccountEmailAction, confirmed: boolean) {
  const redirectTo = `${appBaseUrl}/dashboard/`;
  const type = action === 'password_reset' ? 'recovery' : 'magiclink';
  let primaryError = '';
  try {
    const { data, error } = await supabase.auth.admin.generateLink({ type, email, options: { redirectTo } });
    if (error) throw error;
    const link = data?.properties?.action_link;
    if (!link) throw new Error('No action link was generated.');
    await sendBrandedLink(email, action, link);
    return 'branded';
  } catch (error) {
    primaryError = error instanceof Error ? error.message : 'Link generation failed.';
  }

  if (action === 'password_reset') {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw new Error(`${primaryError} / ${error.message}`);
    return 'supabase';
  }
  if (action === 'verification' && !confirmed) {
    const { error } = await supabase.auth.admin.inviteUserByEmail(email, { redirectTo });
    if (!error) return 'supabase';
  }
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo, shouldCreateUser: false } });
  if (error) throw new Error(`${primaryError} / ${error.message}`);
  return 'supabase';
}

export async function POST(request: NextRequest) {
  try {
    const { supabase } = await requireAdmin(request);
    const body: unknown = await request.json().catch(() => ({}));
    const record = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
    const profileId = String(record.profileId || '').trim();
    const action = String(record.action || '') as AccountEmailAction;
    if (!/^[0-9a-f-]{36}$/i.test(profileId)) throw new Error('Choose an account first.');
    if (!ACTIONS.includes(action)) throw new Error('Unsupported account email action.');

    const { data: authData, error: authError } = await supabase.auth.admin.getUserById(profileId);
    let email = authError ? '' : String(authData?.user?.email || '');
    const confirmed = Boolean(authData?.user?.email_confirmed_at);
    if (!email) {
      const { data: profile } = await supabase.from('profiles').select('email').eq('id', profileId).maybeSingle();
      email = String(profile?.email || '');
    }
    email = email.trim().toLowerCase();
    if (!email) throw new Error('This account has no email address (it may be a guest account).');
    assertSafeEmailAddress(email);

    const via = await deliver(supabase, email, action, confirmed);
    const masked = email.replace(/^(.)(.*)(@.*)$/, (_m, first: string, rest: string, domain: string) => `${first}${'*'.repeat(Math.min(rest.length, 6))}${domain}`);
    return NextResponse.json({ ok: true, message: `${COPY[action].done} to ${masked}${via === 'supabase' ? ' (via the Supabase mailer)' : ''}.` });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : 'Account email failed.' }, { status: 400 });
  }
}
