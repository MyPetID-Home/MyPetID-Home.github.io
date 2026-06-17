"use client";

import { useMemo, useState } from 'react';
import Link from 'next/link';

function readTag() {
  if (typeof window === 'undefined') return 'demo-tag-001';
  return new URLSearchParams(window.location.search).get('tag') || 'demo-tag-001';
}

export function PublicPetProfile() {
  const tag = readTag();
  const [locationStatus, setLocationStatus] = useState('Not shared');
  const demoMap = useMemo(() => 'https://maps.google.com/maps?q=44.097371370963934,-70.16535158888728&z=13&output=embed', []);

  async function shareLocation() {
    if (!navigator.geolocation) {
      setLocationStatus('Geolocation is not available on this device.');
      return;
    }
    setLocationStatus('Requesting permission…');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocationStatus(`Ready to save scan: ${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)}`);
      },
      () => setLocationStatus('Location permission denied or unavailable.'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <main className="shell">
      <header className="pageHeader">
        <div>
          <p className="eyebrow">Public scan profile</p>
          <h1>Pet tag: {tag}</h1>
        </div>
        <Link className="button" href="/dashboard/">Owner dashboard</Link>
      </header>

      <section className="grid2">
        <article className="petPublic">
          <div className="petPhoto">🐶</div>
          <h2>Demo Dog</h2>
          <p><strong>Breed:</strong> Mixed breed</p>
          <p><strong>Medical:</strong> Demo medical notes. Live data will come from Supabase public-safe profile fields.</p>
          <p><strong>Behavior:</strong> Friendly but nervous around loud roads.</p>
          <p><strong>Contact:</strong> Owner-approved phone/email buttons will appear here.</p>
          <div className="actions">
            <button className="primary" type="button" onClick={shareLocation}>I found this pet — share scan location</button>
            <button type="button">Report lost sighting</button>
          </div>
          <p className="notice">{locationStatus}</p>
        </article>

        <article className="petPublic">
          <h2>Last scan map</h2>
          <div className="mapBox"><iframe title="Demo last scan map" src={demoMap} loading="lazy" /></div>
          <p>When Supabase is wired, consenting scans will create location rows and update this map. The prior scan location can stay visible while the current scanner decides whether to share their position.</p>
        </article>
      </section>
    </main>
  );
}
