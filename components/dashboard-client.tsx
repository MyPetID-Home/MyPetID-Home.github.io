"use client";

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { hasSupabaseConfig } from '../lib/supabase';

const defaultPet = {
  name: 'Demo Dog',
  tagId: 'demo-tag-001',
  species: 'Dog',
  breed: 'Mixed breed',
  medicalNotes: 'No live medical record yet. Add Supabase to save this securely.',
  behaviorNotes: 'Friendly demo profile. Real notes should be owner-approved for public display.',
};

export function DashboardClient() {
  const [pet, setPet] = useState(defaultPet);
  const [tier, setTier] = useState('admin');
  const publicUrl = useMemo(() => {
    if (typeof window === 'undefined') return `/pet/?tag=${pet.tagId}`;
    return `${window.location.origin}/pet/?tag=${encodeURIComponent(pet.tagId)}`;
  }, [pet.tagId]);

  return (
    <main className="shell">
      <header className="pageHeader">
        <div>
          <p className="eyebrow">Owner dashboard</p>
          <h1>Build, link, preview.</h1>
        </div>
        <Link className="button" href="/">Home</Link>
      </header>

      {!hasSupabaseConfig && (
        <p className="notice">Supabase is not configured yet, so this dashboard is running in local demo mode. Add public Supabase env values, then wire the tables/RLS from docs/supabase-schema.sql.</p>
      )}

      <section className="grid2">
        <form className="formPanel">
          <h2>Account</h2>
          <label>Testing tier
            <select value={tier} onChange={(event) => setTier(event.target.value)}>
              <option value="free">Free: 1 user / 1 pet, scanning disabled</option>
              <option value="basic">Basic: 1 NFC tag / 1 user</option>
              <option value="silver">Silver: 1 NFC tag / 2 users</option>
              <option value="gold">Gold: 2 NFC tags / 1 user</option>
              <option value="diamond">Diamond: 2 tags + 2 users, or 3 tags + 1 user</option>
              <option value="admin">Admin: unrestricted testing</option>
            </select>
          </label>
          <p>Admin mode keeps every gated feature open for CAK3D while subscription rules are being tested.</p>
          <button className="primary" type="button">Sign in with Supabase — next wiring step</button>
        </form>

        <form className="formPanel">
          <h2>Pet profile</h2>
          <label>Pet name <input value={pet.name} onChange={(e) => setPet({ ...pet, name: e.target.value })} /></label>
          <label>Tag ID <input value={pet.tagId} onChange={(e) => setPet({ ...pet, tagId: e.target.value })} /></label>
          <label>Breed <input value={pet.breed} onChange={(e) => setPet({ ...pet, breed: e.target.value })} /></label>
          <label>Medical notes <textarea value={pet.medicalNotes} onChange={(e) => setPet({ ...pet, medicalNotes: e.target.value })} /></label>
          <label>Behavior notes <textarea value={pet.behaviorNotes} onChange={(e) => setPet({ ...pet, behaviorNotes: e.target.value })} /></label>
          <div className="actions">
            <Link className="button primary" href={`/pet/?tag=${encodeURIComponent(pet.tagId)}`}>Preview public page</Link>
          </div>
        </form>
      </section>

      <section className="splitPanel">
        <div>
          <h2>QR for this tag</h2>
          <p>NFC tags should point to the same public URL. The owner dashboard route will be chosen later by saved trusted device/session checks, not by exposing private data on the scan URL.</p>
        </div>
        <div className="formPanel" style={{ textAlign: 'center' }}>
          <QRCodeSVG value={publicUrl} size={180} bgColor="transparent" fgColor="#f5f7ef" />
          <p className="tiny">{publicUrl}</p>
        </div>
      </section>
    </main>
  );
}
