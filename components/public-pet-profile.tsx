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
  contact_public?: Record<string, unknown> | null;
  lost_mode: boolean;
  birthday?: string | null;
  eye_color?: string | null;
  coat_color?: string | null;
  coat_type?: string | null;
  weight?: string | null;
  vet_name?: string | null;
};

const fallbackPet: Pet = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Clyde',
  breed: 'Good boy mix',
  photo_url: '/images/dog/Clyde.png',
  medical_public: 'Sensitive stomach. Avoid rich treats unless needed for safety.',
  behavior_public: 'Friendly, loves tug, nervous around loud trucks.',
  contact_public: { phone: '', email: '' },
  lost_mode: false,
  birthday: '2021-06-01',
  eye_color: 'Brown',
  coat_color: 'Black / white',
  coat_type: 'Short',
  weight: '58 lb',
  vet_name: 'MyPetID Family Vet',
};

function ageFromBirthday(value?: string | null) {
  if (!value) return 'Age private';
  const birth = new Date(`${value}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return 'Age private';
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  if (now.getDate() < birth.getDate()) months -= 1;
  if (months < 0) { years -= 1; months += 12; }
  return years > 0 ? `${years} yr ${months} mo` : `${Math.max(0, months)} mo`;
}

function localDashboardPet(): Partial<Pet> | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = JSON.parse(localStorage.getItem('mypetid.dashboard') || '{}');
    if (!saved.pet) return null;
    return {
      name: saved.pet.name,
      breed: saved.pet.breed,
      photo_url: saved.pet.photoUrl,
      medical_public: saved.pet.medicalNotes,
      behavior_public: saved.pet.behaviorNotes,
      contact_public: { phone: saved.account?.phone, email: saved.account?.email },
      birthday: saved.pet.birthday,
      eye_color: saved.pet.eyeColor,
      coat_color: saved.pet.coatColor,
      coat_type: saved.pet.coatType,
      weight: saved.pet.weight,
      vet_name: saved.pet.vetName,
    };
  } catch {
    return null;
  }
}

function readTag() {
  if (typeof window === 'undefined') return 'demo-tag-001';
  return new URLSearchParams(window.location.search).get('tag') || 'demo-tag-001';
}

function readPetId() {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('pet') || '';
}

function readMode() {
  if (typeof window === 'undefined') return 'owner';
  return new URLSearchParams(window.location.search).get('mode') || 'owner';
}

export function PublicPetProfile() {
  const tag = readTag();
  const petId = readPetId();
  const mode = readMode();
  const [pet, setPet] = useState<Pet>(fallbackPet);
  const [contactStatus, setContactStatus] = useState('Choose a contact action. Nothing writes location data from this public view.');
  const demoMap = useMemo(() => 'https://maps.google.com/maps?q=44.097371370963934,-70.16535158888728&z=13&output=embed', []);

  useEffect(() => {
    const localPet = localDashboardPet();
    if (localPet) setPet((current) => ({ ...current, ...localPet }));
    async function loadPet() {
      if (!supabase) return;
      if (petId) {
        const { data: directPet, error: directError } = await supabase
          .from('pets')
          .select('id,name,breed,photo_url,medical_public,behavior_public,contact_public,lost_mode')
          .eq('id', petId)
          .maybeSingle();
        if (!directError && directPet) {
          setPet((current) => ({ ...current, ...directPet }));
          return;
        }
      }
      const { data, error } = await supabase
        .from('tags')
        .select('pet:pets(id,name,breed,photo_url,medical_public,behavior_public,contact_public,lost_mode)')
        .eq('tag_code', tag)
        .maybeSingle();
      const loaded = data?.pet;
      if (!error && loaded) setPet((current) => ({ ...current, ...(Array.isArray(loaded) ? loaded[0] : loaded) }));
    }
    loadPet();
  }, [tag, petId]);

  const publicPhone = typeof pet.contact_public?.phone === 'string' ? pet.contact_public.phone : '';
  const publicEmail = typeof pet.contact_public?.email === 'string' ? pet.contact_public.email : '';

  return (
    <main className="publicShell">
      <section className="publicHero">
        <Link className="brandLockup" href="/"><img src="/images/logo/MyPetID-Logo_Resized.jpg" alt="MyPetID" /><span>MyPetID</span></Link>
        <div className="scanCard">
          <div className="scanPhotoWrap"><img src={pet.photo_url || '/images/dog/Clyde.png'} alt={pet.name} /><span className="scanPulse" /></div>
          <div>
            <p className="eyebrow">{mode === 'owner' ? 'Owner-safe public profile' : 'Public pet profile'} • tag {tag}</p>
            <h1>{pet.name}</h1>
            <p className="lead">{pet.behavior_public}</p>
            <div className="chipCloud"><span>{ageFromBirthday(pet.birthday)}</span><span>{pet.weight}</span><span>{pet.eye_color} eyes</span><span>{pet.coat_color} {pet.coat_type} coat</span></div>
            <div className="lostRibbon">{mode === 'owner' ? 'Owner link — no location prompt on load' : pet.lost_mode ? 'Marked lost — contact owner now' : 'Not marked lost — public profile view'}</div><div className="publicProfileActions">{publicPhone ? <a className="button primary" href={`tel:${publicPhone}`}>Call owner</a> : <button className="primary" type="button" onClick={() => setContactStatus('Owner has not published a phone route yet.')}>Contact owner</button>}<Link className="button" href={`/scan/?tag=${encodeURIComponent(tag)}&mode=finder`}>Finder scan / share location</Link></div>
          </div>
        </div>
      </section>

      <section className="publicGrid">
        <article className="panel publicInfoCard">
          <div className="panelTitleRow"><h2>Owner-approved info</h2><span>🐾</span></div>
          <dl className="infoList"><dt>Medical</dt><dd>{pet.medical_public}</dd><dt>Behavior</dt><dd>{pet.behavior_public}</dd><dt>Vet route</dt><dd>{pet.vet_name || 'Vet hidden until owner shares it.'}</dd><dt>Contact</dt><dd>{publicPhone || publicEmail ? [publicPhone, publicEmail].filter(Boolean).join(' • ') : 'Owner contact buttons will appear here once contact preferences are enabled.'}</dd></dl>
          <div className="actions">{publicPhone ? <a className="button primary" href={`tel:${publicPhone}`}>Call owner</a> : <button className="primary" type="button" onClick={() => setContactStatus('Owner has not published a phone route yet.')}>Contact owner</button>}{publicEmail && <a className="button" href={`mailto:${publicEmail}`}>Email owner</a>}<button type="button" onClick={() => setContactStatus('Lost sighting reports belong on the NFC scan gate so consent + GPS are explicit.')}>Report lost sighting</button></div>
          <p className="notice">{contactStatus}</p>
        </article>

        <article className="panel">
          <h2>Two safe links</h2>
          <p>The finder tag URL asks for location consent. This owner/profile URL never requests GPS on load; owner location prompts belong behind dashboard actions like walks and lost reporting.</p>
          <div className="actions"><Link className="button primary" href={`/scan/?tag=${encodeURIComponent(tag)}&mode=finder`}>Open finder scan gate</Link><Link className="button" href={`/dashboard/?tag=${encodeURIComponent(tag)}`}>Owner dashboard</Link></div>
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
