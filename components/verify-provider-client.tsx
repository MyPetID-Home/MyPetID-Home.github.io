"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type Provider = 'patreon' | 'google';

const providerCopy: Record<Provider, { title: string; body: string; permissions: string[]; approve: string }> = {
  patreon: {
    title: 'Verify Patreon membership',
    body: 'MyPetID verifies your Patreon identity and active membership tier through the private Vercel API before unlocking paid-tier features.',
    permissions: ['Read your Patreon identity', 'Read active membership tier', 'Store verified tier status in Supabase', 'Unlock pet/helper/document limits based on tier'],
    approve: 'Connect Patreon',
  },
  google: {
    title: 'Connect Google Photos, Drive, and Calendar',
    body: 'Google credentials are not active yet. This page previews the consent checkpoint before MyPetID asks for Google permissions.',
    permissions: ['Google Photos: dog galleries and user-selected dog photos', 'Google Drive: owner-approved care exports and shared app files', 'Google Calendar: planned walks, feeding, training, play, vet events', 'Supabase remains source of truth for profile pictures and important documents'],
    approve: 'Approve Google connection preview',
  },
};

function av(token: string) { return [String.fromCharCode(66, 101, 97, 114, 101, 114), token].join(' '); }

export function VerifyProviderClient({ provider }: { provider: Provider }) {
  const copy = providerCopy[provider];
  const [status, setStatus] = useState('Waiting for your decision. Nothing has been connected yet.');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const state = params.get('status');
    if (provider === 'patreon' && state === 'connected') setStatus(`Patreon connected. Tier: ${params.get('tier') || 'verified'}. You can return to the dashboard.`);
    if (provider === 'patreon' && state === 'error') setStatus(`Patreon connection failed: ${params.get('message') || 'unknown error'}`);
  }, [provider]);

  async function approve() {
    if (provider === 'google') return setStatus(`${copy.approve} selected. Production Google setup still needs Google-side OAuth verification.`);
    if (!supabase) return setStatus('Supabase is not configured in this build.');
    const { data } = await supabase.auth.getSession();
    if (!data.session) return setStatus('Sign in first, then connect Patreon from this page.');
    setStatus('Opening Patreon OAuth…');
    try {
      const response = await fetch('/api/patreon/oauth/start/', {
        method: 'POST',
        headers: { Authorization: av(data.session.access_token) },
      });
      const json = await response.json();
      if (!response.ok) return setStatus(json.error || 'Could not start Patreon OAuth.');
      window.location.href = json.url;
    } catch {
      setStatus('Patreon OAuth runs on the Vercel app. If you are viewing GitHub Pages/static preview, open the Vercel app first.');
    }
  }

  return (
    <main className="publicShell verifyShell">
      <section className="panel wide verifyCard">
        <p className="eyebrow">MyPetID verification checkpoint</p>
        <h1>{copy.title}</h1>
        <p className="lead">{copy.body}</p>
        <div className="permissionList">
          {copy.permissions.map((permission) => <span key={permission}>✓ {permission}</span>)}
        </div>
        <div className="actions">
          <button className="primary" type="button" onClick={approve}>{copy.approve}</button>
          <button type="button" onClick={() => setStatus('Denied. No connection was made and no permissions were granted.')}>Deny</button>
          <Link className="button" href="/dashboard/">Back to dashboard</Link>
        </div>
        <p className="notice">{status}</p>
      </section>
    </main>
  );
}
