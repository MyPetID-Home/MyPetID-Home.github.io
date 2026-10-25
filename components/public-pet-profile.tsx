"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabase';
import { fetchPublicPet } from '../lib/public-pet';
import { PawPrint } from './icons';
import { PetProfileCard } from './pet-profile-card';

type Pet = {
  id: string;
  name: string;
  breed: string | null;
  photo_url: string | null;
  medical_public: string | null;
  behavior_public: string | null;
  contact_public?: Record<string, unknown> | null;
  lost_mode: boolean;
  tag_code?: string | null;
  is_owner?: boolean;
  cover_url?: string | null;
  public_extra?: { details?: Record<string, string>; vet?: Record<string, string>; care?: Record<string, string>; status_tags?: string[]; species?: string } | null;
  last_seen_at?: string | null;
  last_seen_lat?: number | null;
  last_seen_lng?: number | null;
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

const DEMO_TAG = 'demo-tag-001';

const emptyPet: Pet = { id: '', name: '', breed: null, photo_url: null, medical_public: null, behavior_public: null, contact_public: null, lost_mode: false };

type LoadStatus = 'loading' | 'demo' | 'local' | 'cloud' | 'missing';

// The owner's own dashboard draft (saved in this browser) is only a preview for
// the tag it belongs to. It must never be overlaid on someone else's pet: a
// finder who also uses MyPetID would otherwise see their own dog and phone
// number on every tag they scan.
function localDashboardPet(tag: string): Partial<Pet> | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = JSON.parse(localStorage.getItem('mypetid.dashboard') || '{}');
    if (!saved.pet || !tag || saved.pet.tagId !== tag) return null;
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

export function PublicPetProfile() {
  // Query params are read after mount. Reading window.location during render
  // made the static HTML (built without a query string) differ from the first
  // client render, which threw React hydration error #418 on every visit.
  const [query, setQuery] = useState<{ tag: string; petId: string; mode: string } | null>(null);
  const tag = query?.tag ?? DEMO_TAG;
  const mode = query?.mode ?? 'public';
  const [pet, setPet] = useState<Pet>(fallbackPet);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading');
  const [contactStatus, setContactStatus] = useState('Choose a contact action. Nothing writes location data from this public view.');
  const demoMap = useMemo(() => 'https://maps.google.com/maps?q=44.097371370963934,-70.16535158888728&z=13&output=embed', []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const petId = params.get('pet') || '';
    setQuery({ tag: params.get('tag') || (petId ? '' : DEMO_TAG), petId, mode: params.get('mode') || 'public' });
  }, []);

  useEffect(() => {
    if (!query) return;
    const { tag: queryTag, petId } = query;
    let cancelled = false;
    const isDemo = queryTag === DEMO_TAG && !petId;
    const localPet = localDashboardPet(queryTag);
    async function loadCloudPet(): Promise<Pet | null> {
      if (!supabase) return null;
      try {
        // pets/tags are not publicly readable; get_public_pet returns only the
        // owner-approved public fields (docs/migrations/2026-10-security-hardening.sql).
        const row = await fetchPublicPet(petId ? { petId } : { tagCode: queryTag });
        return row ? (row as unknown as Pet) : null;
      } catch {
        return null;
      }
    }
    loadCloudPet().then((cloudPet) => {
      if (cancelled) return;
      // Never fall back to the demo dog for a real tag: a finder would see the
      // wrong pet. Show an explicit "not available" state instead.
      if (cloudPet) { setPet({ ...emptyPet, ...cloudPet }); setLoadStatus('cloud'); }
      else if (localPet) { setPet({ ...emptyPet, ...localPet }); setLoadStatus('local'); }
      else if (isDemo) { setPet(fallbackPet); setLoadStatus('demo'); }
      else setLoadStatus('missing');
    });
    return () => { cancelled = true; };
  }, [query]);

  const publicPhone = typeof pet.contact_public?.phone === 'string' ? pet.contact_public.phone : '';
  const publicEmail = typeof pet.contact_public?.email === 'string' ? pet.contact_public.email : '';
  const showDemoExtras = loadStatus === 'demo';
  // A profile opened by pet id (older QR codes) has no tag in the URL; use the tag the lookup returned.
  const finderTag = tag || pet.tag_code || '';
  const finderHref = finderTag ? `/scan/?tag=${encodeURIComponent(finderTag)}&mode=finder` : '';
  const coat = [pet.coat_color, pet.coat_type].filter(Boolean).join(' ');
  const chips = [pet.breed || '', pet.birthday ? ageFromBirthday(pet.birthday) : '', pet.weight || '', pet.eye_color ? `${pet.eye_color} eyes` : '', coat ? `${coat} coat` : ''].filter(Boolean);
  const brand = <Link className="brandLockup" href="/"><img src="/images/logo/MyPetID-Logo_Resized.jpg" alt="" /><span>MyPet<b>ID</b></span></Link>;

  if (loadStatus === 'loading' || loadStatus === 'missing') {
    return (
      <main className="publicShell">
        <section className="publicHero">
          {brand}
          <article className="panel" aria-live="polite" style={{ marginTop: 28, maxWidth: 720 }}>
            {loadStatus === 'loading' ? <><p className="eyebrow">Pet profile</p><h1>Fetching this pet’s profile…</h1><div className="progress"><span style={{ width: '60%' }} /></div></> : <>
              <span className="iconBubble"><PawPrint /></span>
              <p className="eyebrow" style={{ marginTop: 16 }}>Pet profile{finderTag ? ` · tag ${finderTag}` : ''}</p>
              <h1>This profile isn’t available right now.</h1>
              <p className="lead">The tag may not be linked to a pet yet, or we couldn’t reach MyPetID.</p>
              <p>If you found this pet, please keep them safe and contact local animal control, a shelter or a vet. They can also scan for a microchip.</p>
              {finderHref && <div className="actions"><Link className="button primary" href={finderHref}>I found this pet</Link></div>}
            </>}
          </article>
        </section>
      </main>
    );
  }

  return (
    <main className="publicShell">
      <section className="publicHero">{brand}</section>
      <PetProfileCard
        mode={pet.is_owner || mode === 'owner' ? 'owner' : 'public'}
        finderHref={finderHref}
        pet={{
          name: pet.name, breed: pet.breed, photoUrl: pet.photo_url, coverUrl: pet.cover_url, about: pet.behavior_public, health: pet.medical_public,
          details: pet.public_extra?.details, vet: pet.public_extra?.vet, care: pet.public_extra?.care,
          phone: publicPhone, email: publicEmail, lost: pet.lost_mode, tagCode: finderTag, statusTags: pet.public_extra?.status_tags,
          // The demo dog shows sample scan history so visitors can see how it works.
          scans: finderTag === DEMO_TAG ? [{ lat: 44.0974, lng: -70.1654, at: new Date(Date.now() - 2 * 3600e3).toISOString() }, { lat: 44.0928, lng: -70.1749, at: new Date(Date.now() - 22 * 3600e3).toISOString() }] : null,
          lastSeen: pet.last_seen_lat != null && pet.last_seen_lng != null ? { lat: pet.last_seen_lat, lng: pet.last_seen_lng, at: pet.last_seen_at } : null,
        }}
        ownerTools={pet.is_owner ? <Link className="button primary" href="/dashboard/pet/">Edit in the app</Link> : undefined}
      />
      {(showDemoExtras || finderTag === DEMO_TAG) && <p className="formHint" style={{ textAlign: 'center', marginTop: 18 }}>This is a demo profile. <Link href="/">Make one for your dog</Link>.</p>}
    </main>
  );
}
