"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabase';

type Pet = {
  id: string;
  name: string;
  breed: string | null;
  photo_url: string | null;
  medical_public: string | null;
  behavior_public: string | null;
  lost_mode: boolean;
};

const fallbackPet: Pet = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Clyde',
  breed: 'Good boy mix',
  photo_url: '/images/dog/Clyde.png',
  medical_public: 'Sensitive stomach. Avoid rich treats unless needed for safety.',
  behavior_public: 'Friendly, loves tug, nervous around loud trucks.',
  lost_mode: false,
};

function readTag() {
  if (typeof window === 'undefined') return 'demo-tag-001';
  return new URLSearchParams(window.location.search).get('tag') || 'demo-tag-001';
}

export function PublicPetProfile() {
  const tag = readTag();
  const [pet, setPet] = useState<Pet>(fallbackPet);
  const [contactStatus, setContactStatus] = useState('Choose a contact action. Nothing writes location data from this public view.');
  const demoMap = useMemo(() => 'https://maps.google.com/maps?q=44.097371370963934,-70.16535158888728&z=13&output=embed', []);

  useEffect(() => {
    async function loadPet() {
      if (!supabase) return;
      const { data, error } = await supabase
        .from('tags')
        .select('pet:pets(id,name,breed,photo_url,medical_public,behavior_public,lost_mode)')
        .eq('tag_code', tag)
        .maybeSingle();
      const loaded = data?.pet;
      if (!error && loaded) setPet(Array.isArray(loaded) ? loaded[0] : loaded);
    }
    loadPet();
  }, [tag]);

  return (
    <main className="publicShell">
      <section className="publicHero">
        <Link className="brandLockup" href="/"><img src="/images/logo/MyPetID-Logo_Resized.jpg" alt="MyPetID" /><span>MyPetID</span></Link>
        <div className="scanCard">
          <div className="scanPhotoWrap"><img src={pet.photo_url || '/images/dog/Clyde.png'} alt={pet.name} /><span className="scanPulse" /></div>
          <div>
            <p className="eyebrow">Public pet profile • tag {tag}</p>
            <h1>{pet.name}</h1>
            <p className="lead">{pet.behavior_public}</p>
            <div className="lostRibbon">{pet.lost_mode ? 'Marked lost — contact owner now' : 'Not marked lost — public profile view'}</div>
          </div>
        </div>
      </section>

      <section className="publicGrid">
        <article className="panel">
          <h2>Owner-approved info</h2>
          <dl className="infoList"><dt>Medical</dt><dd>{pet.medical_public}</dd><dt>Behavior</dt><dd>{pet.behavior_public}</dd><dt>Contact</dt><dd>Owner contact buttons will appear here once contact preferences are enabled.</dd></dl>
          <div className="actions"><button className="primary" type="button" onClick={() => setContactStatus('Owner contact request staged. Production will open the owner-approved phone/email/SMS route.')}>Contact owner</button><button type="button" onClick={() => setContactStatus('Lost sighting reports belong on the NFC scan gate so consent + GPS are explicit.')}>Report lost sighting</button></div>
          <p className="notice">{contactStatus}</p>
        </article>

        <article className="panel">
          <h2>Need to update the scan trail?</h2>
          <p>The NFC/QR tag should open the separate scan gate. That page looks like this profile, but asks for explicit location permission before writing any scan event.</p>
          <div className="actions"><Link className="button primary" href={`/scan/?tag=${encodeURIComponent(tag)}`}>Open scan gate</Link><Link className="button" href={`/dashboard/?tag=${encodeURIComponent(tag)}`}>Owner dashboard</Link></div>
        </article>

        <article className="panel wide">
          <h2>Last eligible scan map</h2>
          <div className="mapBox"><iframe title="Demo last scan map" src={demoMap} loading="lazy" /></div>
          <p>This view shows the previous eligible scan. It never replaces that location just because someone opened, refreshed, previewed, or accidentally scanned the profile.</p>
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
