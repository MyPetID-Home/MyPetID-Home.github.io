"use client";

import { useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Bell, Heart, MapPinned, PawPrint, Stethoscope, User, Sparkles, ShieldCheck } from './icons';
import { GetTheApp } from './pwa-install-client';

const WalkMap3D = dynamic(() => import('./walk-map-3d').then((m) => m.WalkMap3D), { ssr: false, loading: () => <div className="map3dCanvas mapLoading" style={{ height: 300 }}>Loading map…</div> });

/**
 * A dog's profile as a "business card": cover photo, avatar, name and status, then
 * tabs for each kind of info. `mode="public"` is what a finder sees after scanning;
 * `mode="owner"` is the private view (the owner passes edit controls as `ownerTools`).
 */
export type ProfileCardPet = {
  name: string;
  breed?: string | null;
  photoUrl?: string | null;
  coverUrl?: string | null;
  about?: string | null;
  health?: string | null;
  details?: Record<string, string | undefined> | null;
  vet?: Record<string, string | undefined> | null;
  care?: Record<string, string | undefined> | null;
  phone?: string | null;
  email?: string | null;
  lost?: boolean;
  lastSeen?: { lat: number; lng: number; at?: string | null } | null;
  tagCode?: string | null;
};

type TabKey = 'about' | 'health' | 'vet' | 'contact' | 'seen' | 'app';
const LABELS: Record<string, string> = { sex: 'Sex', age: 'Age', birthday: 'Birthday', size: 'Size', weight: 'Weight', coat: 'Coat', colors: 'Colors', pattern: 'Pattern', eyes: 'Eyes', ears: 'Ears', tail: 'Tail', markings: 'Markings', microchip: 'Microchip', status: 'Status', clinic: 'Clinic', doctor: 'Vet', phone: 'Phone', address: 'Address', emergency: 'Emergency clinic', feeding: 'Feeding', allergies: 'Allergies', medications: 'Medications', notes: 'Notes' };

function Rows({ data }: { data?: Record<string, string | undefined> | null }) {
  const entries = Object.entries(data || {}).filter(([, v]) => v && String(v).trim());
  if (!entries.length) return null;
  return <dl className="profileRows">{entries.map(([k, v]) => <div key={k}><dt>{LABELS[k] || k.replace(/_/g, ' ')}</dt><dd>{v}</dd></div>)}</dl>;
}

export function PetProfileCard({ pet, mode, finderHref, ownerTools, onAlert }: { pet: ProfileCardPet; mode: 'public' | 'owner'; finderHref?: string; ownerTools?: React.ReactNode; onAlert?: () => void }) {
  const tabs = useMemo(() => {
    const list: { key: TabKey; label: string }[] = [{ key: 'about', label: 'About' }];
    if (mode === 'owner' || pet.health) list.push({ key: 'health', label: 'Health' });
    if (mode === 'owner' || (pet.vet && Object.values(pet.vet).some(Boolean))) list.push({ key: 'vet', label: 'Vet' });
    list.push({ key: 'contact', label: 'Contact' });
    if (pet.lost && pet.lastSeen) list.push({ key: 'seen', label: 'Last seen' });
    if (mode === 'public') list.push({ key: 'app', label: 'Get MyPetID' });
    return list;
  }, [mode, pet.health, pet.vet, pet.lost, pet.lastSeen]);
  const [tab, setTab] = useState<TabKey>(pet.lost && pet.lastSeen ? 'seen' : 'about');
  const photo = pet.photoUrl || '/images/logo/MyPetID-Logo_Resized.jpg';

  return (
    <article className={`petCard ${pet.lost ? 'isLost' : ''}`}>
      <div className="petCover" style={pet.coverUrl ? { backgroundImage: `url(${pet.coverUrl})` } : undefined}>
        <span className="coverPaws" aria-hidden="true" />
        {pet.lost && <span className="lostFlag"><Bell /> Lost — please help</span>}
      </div>
      <div className="petIdentity">
        <div className="petAvatarRing"><img src={photo} alt={pet.name} /></div>
        <div className="petTitle">
          <p className="eyebrow">{mode === 'owner' ? 'Your dog' : 'Hi, my name is'}{pet.tagCode ? ` · tag ${pet.tagCode}` : ''}</p>
          <h1>{pet.name}</h1>
          <div className="chipCloud">{[pet.breed, pet.details?.age, pet.details?.size, pet.details?.sex].filter(Boolean).map((chip) => <span key={chip}>{chip}</span>)}</div>
        </div>
        <div className="petActions">
          {mode === 'public' && pet.phone && <a className="button primary" href={`tel:${pet.phone}`}>Call my owner</a>}
          {mode === 'public' && finderHref && <Link className={`button ${pet.phone ? '' : 'primary'}`} href={finderHref}><MapPinned /> I found this dog</Link>}
          {mode === 'public' && onAlert && <button className={pet.phone || finderHref ? '' : 'primary'} type="button" onClick={onAlert}><Bell /> Alert the owner</button>}
          {ownerTools}
        </div>
      </div>

      <nav className="profileTabs" role="tablist" aria-label={`${pet.name}'s profile`}>
        {tabs.map((t) => <button key={t.key} role="tab" aria-selected={tab === t.key} className={tab === t.key ? 'active' : ''} type="button" onClick={() => setTab(t.key)}>{t.label}</button>)}
      </nav>

      <div className="profileTabBody" key={tab}>
        {tab === 'about' && <>
          <div className="statusLine" data-lost={pet.lost ? 'yes' : 'no'}>{pet.lost ? <><Bell /> I’m lost. If you see me, please tap “I found this dog”.</> : <><Heart /> I’m safe at home. Thanks for checking on me!</>}</div>
          {pet.about ? <p className="lead">{pet.about}</p> : <p className="formHint">{mode === 'owner' ? 'Add a personality note so finders know how to approach your dog.' : 'My owner hasn’t written about me yet.'}</p>}
          <Rows data={pet.details} />
        </>}
        {tab === 'health' && <>
          <h3><Stethoscope /> Health notes</h3>
          {pet.health ? <p>{pet.health}</p> : <p className="formHint">No health notes shared.</p>}
          <Rows data={pet.care} />
        </>}
        {tab === 'vet' && <>
          <h3><ShieldCheck /> Vet</h3>
          {pet.vet && Object.values(pet.vet).some(Boolean) ? <Rows data={pet.vet} /> : <p className="formHint">{mode === 'owner' ? 'Add your vet so a finder or sitter can call them in an emergency.' : 'No vet details shared.'}</p>}
        </>}
        {tab === 'contact' && <>
          <h3><User /> Contact my owner</h3>
          {pet.phone || pet.email ? <div className="actions">{pet.phone && <a className="button primary" href={`tel:${pet.phone}`}>Call {pet.phone}</a>}{pet.phone && <a className="button" href={`sms:${pet.phone}`}>Text</a>}{pet.email && <a className="button" href={`mailto:${pet.email}`}>Email</a>}</div>
            : <p className="formHint">{mode === 'owner' ? 'Add a phone or email under Contact so finders can reach you.' : 'Tap “I found this dog” and my owner is alerted with your location.'}</p>}
        </>}
        {tab === 'seen' && pet.lastSeen && <>
          <h3><MapPinned /> Last seen{pet.lastSeen.at ? ` · ${new Date(pet.lastSeen.at).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}` : ''}</h3>
          <p className="formHint">The last place someone scanned my tag (rounded to about 100 m).</p>
          <WalkMap3D current={{ lat: pet.lastSeen.lat, lng: pet.lastSeen.lng }} height={300} />
        </>}
        {tab === 'app' && <>
          <h3><Sparkles /> Keep your dog safe too</h3>
          <p>MyPetID is a free app with an NFC ID card for your dog: anyone who finds them can scan it and get them home.</p>
          <div className="actions"><Link className="button primary" href="/"><PawPrint /> Learn about MyPetID</Link></div>
          <GetTheApp compact />
        </>}
      </div>
    </article>
  );
}
