"use client";

import { useMemo, useState } from 'react';
import Link from 'next/link';

function readTag() {
  if (typeof window === 'undefined') return 'demo-tag-001';
  return new URLSearchParams(window.location.search).get('tag') || 'demo-tag-001';
}

export function PublicPetProfile() {
  const tag = readTag();
  const [locationStatus, setLocationStatus] = useState('Last scan shown until the current scanner chooses to share location.');
  const [scanEnabled, setScanEnabled] = useState(true);
  const demoMap = useMemo(() => 'https://maps.google.com/maps?q=44.097371370963934,-70.16535158888728&z=13&output=embed', []);

  async function shareLocation() {
    if (!scanEnabled) {
      setLocationStatus('Location scan tracking is disabled until this account has an active Patreon membership.');
      return;
    }
    if (!navigator.geolocation) {
      setLocationStatus('Geolocation is not available on this device.');
      return;
    }
    setLocationStatus('Opening app flow and requesting location permission…');
    navigator.geolocation.getCurrentPosition(
      (position) => setLocationStatus(`Ready to save scan: ${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)}. Supabase save comes next.`),
      () => setLocationStatus('Location permission denied or unavailable. You can still contact the owner.'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <main className="publicShell">
      <section className="publicHero">
        <Link className="brandLockup" href="/"><img src="/images/logo/MyPetID-Logo_Resized.jpg" alt="MyPetID" /><span>MyPetID</span></Link>
        <div className="scanCard">
          <div className="scanPhotoWrap"><img src="/images/dog/Clyde.png" alt="Demo pet" /><span className="scanPulse" /></div>
          <div>
            <p className="eyebrow">Scanned tag {tag}</p>
            <h1>Clyde</h1>
            <p className="lead">Friendly good boy mix. Loves tug and treats. Nervous around loud trucks.</p>
            <div className="lostRibbon">Not marked lost — demo status</div>
          </div>
        </div>
      </section>

      <section className="publicGrid">
        <article className="panel">
          <h2>Owner-approved info</h2>
          <dl className="infoList"><dt>Medical</dt><dd>Sensitive stomach. Avoid rich treats unless needed for safety.</dd><dt>Behavior</dt><dd>Approach calmly, crouch low, say “Clyde, home?”</dd><dt>Contact</dt><dd>Owner contact buttons will appear here once Supabase is connected.</dd></dl>
          <div className="actions"><button className="primary" type="button">Contact owner</button><button type="button">Report lost sighting</button></div>
        </article>

        <article className="panel">
          <h2>Open app to share scan location</h2>
          <p>Every scan can prompt the finder to open the app/public flow. If they accept location permission and this pet has active scan tracking, the scan location is saved.</p>
          <label className="toggleRow"><input type="checkbox" checked={scanEnabled} onChange={(e) => setScanEnabled(e.target.checked)} /> Demo subscription scan tracking enabled</label>
          <button className="primary" type="button" onClick={shareLocation}>Open app / share location</button>
          <p className="notice">{locationStatus}</p>
        </article>

        <article className="panel wide">
          <h2>Last known scan map</h2>
          <div className="mapBox"><iframe title="Demo last scan map" src={demoMap} loading="lazy" /></div>
          <p>The previous eligible scan remains visible while the current scanner decides whether to share their own location.</p>
        </article>

        <article className="panel careStrip">
          <span className="bouncer">🍖</span><div><strong>Feeding</strong><p>Breakfast 7 AM • Dinner 6 PM</p></div>
        </article>
        <article className="panel careStrip">
          <span className="bouncer">🐕‍🦺</span><div><strong>Walks</strong><p>Morning loop • evening sniff break</p></div>
        </article>
        <article className="panel careStrip">
          <span className="bouncer">🎾</span><div><strong>Play</strong><p>Tug toy and backyard fetch</p></div>
        </article>
      </section>
    </main>
  );
}
