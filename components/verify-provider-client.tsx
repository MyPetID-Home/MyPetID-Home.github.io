"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { apiFetch, bearer } from '../lib/api-client';

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
    body: 'Connect your Google account so MyPetID can save dog photos, care documents and reminders to your own Google Photos, Drive and Calendar.',
    permissions: ['Google Photos: dog galleries and user-selected dog photos', 'Google Drive: owner-approved care exports and shared app files', 'Google Calendar: planned walks, feeding, training, play, vet events', 'Supabase remains source of truth for profile pictures and important documents'],
    approve: 'Connect Google',
  },
};

export function VerifyProviderClient({ provider }: { provider: Provider }) {
  const copy = providerCopy[provider];
  const [status, setStatus] = useState('Waiting for your decision. Nothing has been connected yet.');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const state = params.get('status');
    if (provider === 'patreon' && state === 'connected') setStatus(`Patreon connected. Tier: ${params.get('tier') || 'verified'}. You can return to the dashboard.`);
    if (provider === 'patreon' && state === 'error') setStatus(`Patreon connection failed: ${params.get('message') || 'unknown error'}`);
    if (provider === 'google' && params.get('google') === 'connected') setStatus('Google connected. You can return to the dashboard.');
  }, [provider]);

  async function approve() {
    if (!supabase) return setStatus('Sign-in isn’t available in this build.');
    const { data } = await supabase.auth.getSession();
    if (!data.session) return setStatus(`Sign in first, then connect ${provider === 'google' ? 'Google' : 'Patreon'} from this page.`);
    setStatus(`Opening ${provider === 'google' ? 'Google' : 'Patreon'}…`);
    try {
      // Both connections run on the Vercel server, which holds the provider secrets.
      const response = provider === 'google'
        ? await apiFetch('/api/google/oauth/start/', { headers: { Authorization: bearer(data.session.access_token) } })
        : await apiFetch('/api/patreon/oauth/start/', { method: 'POST', headers: { Authorization: bearer(data.session.access_token) } });
      const json = await response.json();
      if (!response.ok) return setStatus(json.error || 'Could not start the connection.');
      window.location.href = json.url;
    } catch {
      setStatus('We couldn’t reach the MyPetID server. Please try again in a moment.');
    }
  }

  return (
    <main className="publicShell verifyShell">
      <section className="panel wide verifyCard">
        <p className="eyebrow">Connect an account</p>
        <h1>{copy.title}</h1>
        <p className="lead">{copy.body}</p>
        <div className="permissionList">
          {copy.permissions.map((permission) => <span key={permission}>{permission}</span>)}
        </div>
        <div className="actions">
          <button className="primary" type="button" onClick={approve}>{copy.approve}</button>
          <button type="button" onClick={() => setStatus('Denied. No connection was made and no permissions were granted.')}>Deny</button>
          <Link className="button" href="/dashboard/">Back to dashboard</Link>
        </div>
        <p className="authMessage" role="status">{status}</p>
      </section>
    </main>
  );
}
