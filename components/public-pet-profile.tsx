"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabase';

function readTag() {
  if (typeof window === 'undefined') return 'demo-tag-001';
  return new URLSearchParams(window.location.search).get('tag') || 'demo-tag-001';
}

export function PublicPetProfile() {
  const tag = readTag();
  const [locationStatus, setLocationStatus] = useState('Last scan shown until the current scanner chooses to share location.');
  const [scanEnabled, setScanEnabled] = useState(true);
  const [pet, setPet] = useState({
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Clyde',
    breed: 'Good boy mix',
    photo_url: '/images/dog/Clyde.png',
    medical_public: 'Sensitive stomach. Avoid rich treats unless needed for safety.',
    behavior_public: 'Friendly, loves tug, nervous around loud trucks.',
    lost_mode: false,
  });
  const demoMap = useMemo(() => 'https://maps.google.com/maps?q=44.097371370963934,-70.16535158888728&z=13&output=embed', []);

  useEffect(() => {
    async function loadPet() {
      if (!supabase) return;
      const { data, error } = await supabase
        .from('tags')
        .select('pet:pets(id,name,breed,photo_url,medical_public,behavior_public,lost_mode)')
        .eq('tag_code', tag)
        .maybeSingle();
      if (!error && data?.pet) setPet(Array.isArray(data.pet) ? data.pet[0] : data.pet);
    }
    loadPet();
  }, [tag]);

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
      (position) => {
        const msg = `Ready to save scan: ${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)}.`;
        setLocationStatus(msg);
        if (supabase) {
          supabase.from('scan_events').insert({
            pet_id: pet.id,
            actor: 'stranger',
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy_meters: position.coords.accuracy,
            note: 'Public scan location consented from tag page',
          }).then(({ error }) => {
            if (error) setLocationStatus(`${msg} Supabase save blocked: ${error.message}`);
            else setLocationStatus(`${msg} Scan location saved.`);
          });
        }
      },
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
            <h1>{pet.name}</h1>
            <p className="lead">{pet.behavior_public}</p>
            <div className="lostRibbon">{pet.lost_mode ? 'Marked lost — contact owner now' : 'Not marked lost — demo status'}</div>
          </div>
        </div>
      </section>

      <section className="publicGrid">
        <article className="panel">
          <h2>Owner-approved info</h2>
          <dl className="infoList"><dt>Medical</dt><dd>{pet.medical_public}</dd><dt>Behavior</dt><dd>{pet.behavior_public}</dd><dt>Contact</dt><dd>Owner contact buttons will appear here once contact preferences are enabled.</dd></dl>
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
