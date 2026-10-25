"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { isAdminEmail, normalizeLoginEmail, supabase } from '../lib/supabase';
import { Google } from './icons';
import { createFallbackAccount, getFallbackQueueStats, getFallbackSession, isServiceRestrictionMessage, signInFallback, signOutFallback, type FallbackSession } from '../lib/fallback-local';

type Profile = {
  id: string;
  email: string | null;
  display_name: string | null;
  tier: string;
  is_admin: boolean;
  patreon_linked?: boolean;
  patreon_tier?: string | null;
};

export function AuthPanel() {
  const [session, setSession] = useState<Session | null>(null);
  const [fallbackSession, setFallbackSession] = useState<FallbackSession | null>(null);
  const [queueStats, setQueueStats] = useState(() => getFallbackQueueStats());
  const [profile, setProfile] = useState<Profile | null>(null);
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [onDashboard, setOnDashboard] = useState(false);

  useEffect(() => {
    setOnDashboard(window.location.pathname.startsWith('/dashboard'));
    setFallbackSession(getFallbackSession());
    setQueueStats(getFallbackQueueStats());
    const refresh = () => { setFallbackSession(getFallbackSession()); setQueueStats(getFallbackQueueStats()); };
    window.addEventListener('storage', refresh);
    return () => window.removeEventListener('storage', refresh);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    async function loadProfile(user: User) {
      if (!supabase) return;
      const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      if (error) {
        setMessage(error.message);
        return;
      }
      if (data) {
        setProfile(data as Profile);
        return;
      }
      const fallback = {
        id: user.id,
        email: user.email ?? null,
        display_name: user.user_metadata?.display_name ?? user.email?.split('@')[0] ?? 'MyPetID User',
        // tier/is_admin are not sent: the database forces new self-created profiles
        // to free/non-admin (2026-10-security-hardening.sql).
      };
      // The account workspace may create the same row at the same moment, so ignore a duplicate and re-read.
      const { error: insertError } = await supabase.from('profiles').upsert(fallback, { onConflict: 'id', ignoreDuplicates: true });
      if (insertError) return setMessage(insertError.message);
      const { data: created } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      if (created) setProfile(created as Profile);
    }
    if (session?.user) loadProfile(session.user);
    else setProfile(null);
  }, [session]);

  async function submit() {
    if (mode === 'sign-up' && !acceptedTerms) {
      setMessage('Please read and agree to the Terms of Service and Privacy Policy before creating an account.');
      return;
    }
    setMessage('Working…');
    const loginEmail = normalizeLoginEmail(email);
    if (supabase) {
      try {
        const result = mode === 'sign-in'
          ? await supabase.auth.signInWithPassword({ email: loginEmail, password })
          : await supabase.auth.signUp({ email: loginEmail, password, options: { data: { display_name: loginEmail.split('@')[0] } } });
        if (!result.error) {
          setMessage(mode === 'sign-up' ? 'Account created! Check your email if we asked you to confirm it.' : 'Signed in. Opening your dashboard…');
          if (mode === 'sign-in' && window.location.pathname === '/') window.location.assign('/dashboard/');
          return;
        }
        if (!isServiceRestrictionMessage(result.error.message)) {
          setMessage(result.error.message);
          return;
        }
      } catch (error) {
        const text = error instanceof Error ? error.message : String(error);
        if (!isServiceRestrictionMessage(text)) {
          setMessage(text);
          return;
        }
      }
    }
    try {
      const localSession = mode === 'sign-up'
        ? await createFallbackAccount(loginEmail, password, loginEmail.split('@')[0])
        : await signInFallback(loginEmail, password);
      setFallbackSession(localSession);
      setQueueStats(getFallbackQueueStats());
      setMessage(`${mode === 'sign-up' ? 'Account created' : 'Signed in'} on this device. We couldn’t reach the cloud, so your changes are saved here for now.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Local fallback sign-in failed.');
    }
  }

  async function google() {
    if (!supabase) return setMessage('Supabase env is not configured in this build yet.');
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/dashboard/' } });
    if (error) setMessage(error.message);
  }

  async function signOut() {
    if (supabase && session?.user) await supabase.auth.signOut();
    signOutFallback();
    setFallbackSession(null);
    setQueueStats(getFallbackQueueStats());
    setMessage('Signed out.');
  }

  if (session?.user) {
    return (
      <section className="authPanel signedIn">
        <div>
          <p className="eyebrow">Signed in</p>
          <h3>{profile?.display_name || session.user.email}</h3>
          <p className="mutedLine">{session.user.email} · {profile?.is_admin ? 'admin' : `${profile?.tier ?? 'free'} plan`}</p>
        </div>
        <div className="actions compact">
          {!onDashboard && <Link className="button primary" href="/dashboard/">Open app</Link>}
          <button type="button" onClick={signOut}>Sign out</button>
        </div>
      </section>
    );
  }

  if (fallbackSession) {
    return (
      <section className="authPanel signedIn">
        <div>
          <p className="eyebrow">Offline mode</p>
          <h3>{fallbackSession.displayName || fallbackSession.email}</h3>
          <p className="mutedLine">{fallbackSession.email} · signed in on this device · {queueStats.pending} change{queueStats.pending === 1 ? '' : 's'} saved here</p>
          <small className="formHint">We couldn’t reach the cloud, so you’re signed in on this device only.</small>
        </div>
        <div className="actions compact">
          {!onDashboard && <Link className="button primary" href="/dashboard/">Open app</Link>}
          <button type="button" onClick={signOut}>Sign out</button>
        </div>
      </section>
    );
  }

  return (
    <form className="authPanel" onSubmit={(event) => { event.preventDefault(); submit(); }}>
      <div>
        <p className="eyebrow">Your MyPetID account</p>
        <h3>{mode === 'sign-in' ? 'Welcome back' : 'Create your free account'}</h3>
      </div>
      <div className="authTabs" role="tablist" aria-label="Account">
        <button type="button" role="tab" aria-selected={mode === 'sign-in'} className={mode === 'sign-in' ? 'active' : ''} onClick={() => { setMode('sign-in'); setMessage(''); }}>Sign in</button>
        <button type="button" role="tab" aria-selected={mode === 'sign-up'} className={mode === 'sign-up' ? 'active' : ''} onClick={() => { setMode('sign-up'); setMessage(''); }}>Create account</button>
      </div>
      <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" placeholder="you@example.com" required /></label>
      <label>Password<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} placeholder="••••••••" required /></label>
      {mode === 'sign-up' && <label className="toggleRow termsAgree"><input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} /> <span>I agree to the <Link href="/terms/">Terms</Link> and <Link href="/privacy/">Privacy Policy</Link>.</span></label>}
      <button className="primary" type="submit" disabled={mode === 'sign-up' && !acceptedTerms}>{mode === 'sign-in' ? 'Sign in' : 'Create account'}</button>
      <div className="authDivider">or</div>
      <button className="googleButton" type="button" onClick={google}><Google /> Continue with Google</button>
      {message && <p className="authMessage" role="status">{message}</p>}
      <small className="formHint">Have a Patreon membership? <Link href="/verify/patreon/">Link it here</Link>.</small>
    </form>
  );
}
