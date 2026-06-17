"use client";

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { hasSupabaseConfig } from '../lib/supabase';

const tierRules = {
  free: { label: 'Free', pets: '1 profile preview', users: '1 user', scans: 'Location scans locked', accent: 'muted' },
  basic: { label: 'Basic', pets: '1 NFC tag', users: '1 user', scans: 'Scan tracking enabled', accent: 'green' },
  silver: { label: 'Silver', pets: '1 NFC tag', users: '2 users', scans: 'Shared care enabled', accent: 'blue' },
  gold: { label: 'Gold', pets: '2 NFC tags', users: '1 user', scans: 'Two pets tracked', accent: 'gold' },
  diamond: { label: 'Diamond', pets: '2 tags + 2 users or 3 tags + 1 user', users: 'Flexible household', scans: 'Full family mode', accent: 'violet' },
  admin: { label: 'Admin', pets: 'Unlimited', users: 'Unlimited', scans: 'Everything unlocked', accent: 'red' },
};

const timeline = [
  { time: '7:00 AM', type: 'Feed', note: 'Breakfast: 1 cup kibble + medicine', animation: '🍖' },
  { time: '8:15 AM', type: 'Walk', note: 'Morning walk around Lisbon Street loop', animation: '🐕‍🦺' },
  { time: '12:30 PM', type: 'Play', note: 'Tug toy and backyard sniff break', animation: '🎾' },
  { time: '4:00 PM', type: 'Appointment', note: 'Vet follow-up reminder', animation: '🩺' },
  { time: '6:30 PM', type: 'Play date', note: 'Meet linked friend at the park', animation: '🐾' },
];

const docs = [
  { title: 'Rabies certificate', status: 'Expires Aug 2026', kind: 'Vaccine' },
  { title: 'Microchip registration', status: 'Verified', kind: 'ID' },
  { title: 'Medication sheet', status: 'Owner private', kind: 'Medical' },
  { title: 'Insurance PDF', status: 'Upload planned', kind: 'Document' },
];

const walkStats = [
  { label: 'This week', value: '8.4 mi' },
  { label: 'Avg walk', value: '24 min' },
  { label: 'Scans', value: '17' },
  { label: 'Helpers', value: '3' },
];

const healthMetrics = [
  ['Weight', '58 lb', 'steady'],
  ['Meals', '2 / day', 'on track'],
  ['Meds', '1 active', 'due tonight'],
  ['Mood', 'Playful', 'tail up'],
];

const tabs = ['overview', 'walks', 'care', 'documents', 'appointments', 'data', 'admin'] as const;
type Tab = typeof tabs[number];

export function DashboardClient() {
  const [tier, setTier] = useState<keyof typeof tierRules>('admin');
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [pet, setPet] = useState({
    name: 'Clyde',
    tagId: 'demo-tag-001',
    species: 'Dog',
    breed: 'Good boy mix',
    medicalNotes: 'Sensitive stomach. If lost, avoid rich treats unless necessary.',
    behaviorNotes: 'Friendly, loves tug, nervous around loud trucks.',
    feeding: 'Breakfast 7 AM, dinner 6 PM. Fresh water always.',
    publicFields: ['Photo', 'Owner contact button', 'Medical notes', 'Behavior notes', 'Lost mode', 'Last safe scan map'],
  });

  const publicUrl = useMemo(() => {
    if (typeof window === 'undefined') return `/pet/?tag=${pet.tagId}`;
    return `${window.location.origin}/pet/?tag=${encodeURIComponent(pet.tagId)}`;
  }, [pet.tagId]);

  const selectedTier = tierRules[tier];

  return (
    <main className="appShell">
      <aside className="sidebar">
        <Link className="brandLockup" href="/">
          <img src="/images/logo/MyPetID-Logo_Resized.jpg" alt="MyPetID logo" />
          <span>MyPetID</span>
        </Link>
        <nav className="sideNav" aria-label="Dashboard sections">
          {tabs.map((tab) => (
            <button key={tab} className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)} type="button">
              {tab}
            </button>
          ))}
        </nav>
        <div className={`tierBadge ${selectedTier.accent}`}>
          <span>{selectedTier.label}</span>
          <strong>{selectedTier.scans}</strong>
        </div>
      </aside>

      <section className="workspace">
        <header className="appHeader">
          <div>
            <p className="eyebrow">Owner command center</p>
            <h1>{pet.name}'s care dashboard</h1>
            <p>Manage public scan info, walks, care routines, documents, appointments, location events, tags, users, and Patreon tier access.</p>
          </div>
          <div className="petAvatarCard">
            <img src="/images/dog/Clyde-Nice.jpg" alt="Clyde" />
            <span className="pulseDot" />
          </div>
        </header>

        {!hasSupabaseConfig && (
          <p className="notice">Demo mode: the new Supabase project exists, but public env values and live tables still need to be wired into GitHub Pages/Vercel before this saves real data.</p>
        )}

        {activeTab === 'overview' && (
          <div className="dashboardGrid">
            <section className="panel heroPanel">
              <div>
                <p className="eyebrow">Scan profile preview</p>
                <h2>{pet.name}</h2>
                <p>{pet.breed} • Tag {pet.tagId}</p>
                <div className="actions"><Link className="button primary" href={`/pet/?tag=${encodeURIComponent(pet.tagId)}`}>Open public page</Link><button type="button">Toggle lost mode</button></div>
              </div>
              <QRCodeSVG value={publicUrl} size={160} bgColor="transparent" fgColor="#f5f7ef" />
            </section>

            <section className="panel animatedCare">
              <div className="dogWalker"><span className="walker">🚶</span><span className="leash" /><span className="doggo">🐕</span></div>
              <h3>Next up: Walk time</h3>
              <p>Animated reminders can fire for feeding, play, walks, appointments, and play dates.</p>
            </section>

            <section className="panel publicControls">
              <h3>Public scan fields</h3>
              <div className="chipCloud">{pet.publicFields.map((field) => <span key={field}>{field}</span>)}</div>
              <p>Owners choose exactly what strangers can see after scanning the NFC/QR tag.</p>
            </section>

            <section className="panel tierMatrix">
              <h3>Membership limits</h3>
              <select value={tier} onChange={(event) => setTier(event.target.value as keyof typeof tierRules)}>
                {Object.entries(tierRules).map(([key, rule]) => <option value={key} key={key}>{rule.label}: {rule.pets} / {rule.users}</option>)}
              </select>
              <p>Patreon-linked accounts unlock scanning and tag/user capacity. Admin stays unrestricted.</p>
            </section>
          </div>
        )}

        {activeTab === 'walks' && (
          <div className="dashboardGrid">
            <section className="panel wide"><h2>Walk tracker</h2><div className="walkMap"><div className="routeLine" /><span className="movingPaw">🐾</span></div><p>Track walk starts, linked walker scans, distance, duration, route notes, and safe return check-ins.</p></section>
            {walkStats.map((stat) => <section className="panel stat" key={stat.label}><p>{stat.label}</p><strong>{stat.value}</strong></section>)}
          </div>
        )}

        {activeTab === 'care' && (
          <div className="dashboardGrid">
            <section className="panel wide"><h2>Daily diary and care routine</h2>{timeline.map((item) => <div className="timelineRow" key={item.time}><span className="time">{item.time}</span><span className="bouncer">{item.animation}</span><div><strong>{item.type}</strong><p>{item.note}</p></div></div>)}</section>
            <section className="panel"><h3>Feeding plan</h3><textarea value={pet.feeding} onChange={(event) => setPet({ ...pet, feeding: event.target.value })} /></section>
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="dashboardGrid">
            <section className="panel wide"><h2>Documents and health records</h2><div className="docGrid">{docs.map((doc) => <article className="docCard" key={doc.title}><span>{doc.kind}</span><h3>{doc.title}</h3><p>{doc.status}</p></article>)}</div></section>
            <section className="panel"><img className="medicalPreview" src="/images/medical/Clyde-Medical-1.jpg" alt="Medical document preview" /><p>Real uploads will live in Supabase Storage.</p></section>
          </div>
        )}

        {activeTab === 'appointments' && (
          <div className="dashboardGrid">
            <section className="panel wide"><h2>Appointments and reminders</h2>{timeline.filter((item) => ['Appointment', 'Play date', 'Feed', 'Walk'].includes(item.type)).map((item) => <div className="appointment" key={item.type}><span>{item.animation}</span><div><strong>{item.type}</strong><p>{item.time} — {item.note}</p></div><button type="button">Remind me</button></div>)}</section>
          </div>
        )}

        {activeTab === 'data' && (
          <div className="dashboardGrid">{healthMetrics.map(([label, value, sub]) => <section className="panel stat" key={label}><p>{label}</p><strong>{value}</strong><span>{sub}</span></section>)}<section className="panel wide"><h2>Scan/location data</h2><p>Charts will combine scan records, profile views, lost reports, location consent, linked-user walks, and device trust. Free users can see profile data; subscription users unlock scan history.</p></section></div>
        )}

        {activeTab === 'admin' && (
          <div className="dashboardGrid">
            <section className="panel wide"><h2>Admin console</h2><p>Create user accounts, enter physical tag IDs, assign/unassign tags, grant admin bypass, review Patreon status, generate coupons, and audit scan events.</p><div className="adminActions"><button className="primary" type="button">Create tag ID</button><button type="button">Invite user</button><button type="button">Review lost reports</button><button type="button">Sync Patreon</button></div></section>
          </div>
        )}
      </section>
    </main>
  );
}
