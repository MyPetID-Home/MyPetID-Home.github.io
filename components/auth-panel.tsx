"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { isAdminEmail, supabase } from '../lib/supabase';

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
  const [profile, setProfile] = useState<Profile | null>(null);
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

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
        tier: isAdminEmail(user.email) ? 'admin' : 'free',
        is_admin: isAdminEmail(user.email),
      };
      const { data: inserted, error: insertError } = await supabase.from('profiles').insert(fallback).select('*').single();
      if (insertError) setMessage(insertError.message);
      else setProfile(inserted as Profile);
    }
    if (session?.user) loadProfile(session.user);
    else setProfile(null);
  }, [session]);

  async function submit() {
    if (!supabase) {
      setMessage('Supabase env is not configured in this build yet.');
      return;
    }
    setMessage('Working…');
    const result = mode === 'sign-in'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { data: { display_name: email.split('@')[0] } } });
    if (result.error) setMessage(result.error.message);
    else setMessage(mode === 'sign-up' ? 'Signup created. Check email if confirmation is required.' : 'Signed in.');
  }

  async function google() {
    if (!supabase) return setMessage('Supabase env is not configured in this build yet.');
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/dashboard/' } });
    if (error) setMessage(error.message);
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setMessage('Signed out.');
  }

  if (session?.user) {
    return (
      <section className="authPanel signedIn">
        <div>
          <p className="eyebrow">Signed in</p>
          <strong>{profile?.display_name || session.user.email}</strong>
          <p>{session.user.email} • {profile?.tier ?? 'free'} {profile?.is_admin ? '• admin bypass' : ''}</p>
        </div>
        <button type="button" onClick={signOut}>Sign out</button>
      </section>
    );
  }

  return (
    <section className="authPanel">
      <div>
        <p className="eyebrow">MyPetID account</p>
        <h3>{mode === 'sign-in' ? 'Log in to your account' : 'Create your account'}</h3>
      </div>
      <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@example.com" /></label>
      <label>Password<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="••••••••" /></label>
      <div className="actions">
        <button className="primary" type="button" onClick={submit}>{mode === 'sign-in' ? 'Sign in' : 'Sign up'}</button>
        <button type="button" onClick={google}>Continue with Google</button>
        <button type="button" onClick={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}>{mode === 'sign-in' ? 'Need account?' : 'Have account?'}</button>
        <Link className="button" href="/verify/patreon/">Link Patreon</Link>
      </div>
      {message && <p className="notice">{message}</p>}
    </section>
  );
}
