"use client";

import Link from 'next/link';
import { useState } from 'react';

type Provider = 'patreon' | 'google';

const providerCopy: Record<Provider, { title: string; body: string; permissions: string[]; approve: string }> = {
  patreon: {
    title: 'Verify Patreon membership',
    body: 'MyPetID will verify your Patreon account and membership tier through a private Supabase Edge Function before unlocking paid-tier features.',
    permissions: ['Read your Patreon identity', 'Read active membership tier', 'Store verified tier status in Supabase', 'Unlock pet/helper/document limits based on tier'],
    approve: 'Approve Patreon verification',
  },
  google: {
    title: 'Connect Google Photos, Drive, and Calendar',
    body: 'Google credentials are not active yet. This page previews the consent checkpoint before MyPetID asks for Google permissions.',
    permissions: ['Google Photos: dog galleries and user-selected dog photos', 'Google Drive: owner-approved care exports and shared app files', 'Google Calendar: planned walks, feeding, training, play, vet events', 'Supabase remains source of truth for profile pictures and important documents'],
    approve: 'Approve Google connection preview',
  },
};

export function VerifyProviderClient({ provider }: { provider: Provider }) {
  const copy = providerCopy[provider];
  const [status, setStatus] = useState('Waiting for your decision. Nothing has been connected yet.');

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
          <button className="primary" type="button" onClick={() => setStatus(`${copy.approve} selected. Production will redirect through OAuth/Edge Function, then return here with success or denial.`)}>{copy.approve}</button>
          <button type="button" onClick={() => setStatus('Denied. No connection was made and no permissions were granted.')}>Deny</button>
          <Link className="button" href="/dashboard/">Back to dashboard</Link>
        </div>
        <p className="notice">{status}</p>
      </section>
    </main>
  );
}
