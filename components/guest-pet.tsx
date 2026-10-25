"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AuthPanel } from './auth-panel';
import { PetProfileCard } from './pet-profile-card';
import { GetTheApp } from './pwa-install-client';
import { guestCreate, guestLoad, guestLogin, guestLogout, guestUpdate, type GuestPet } from '../lib/guest-pet';
import { BREED_NAMES } from '../lib/breeds';
import { Check, Heart, Lock, PawPrint, ShieldCheck, Sparkles } from './icons';

/** Six digits, not all the same and not a simple run. */
function pinProblem(pin: string) {
  if (!/^\d{6}$/.test(pin)) return 'The PIN must be exactly 6 digits.';
  if (/^(\d)\1{5}$/.test(pin) || ['123456', '654321', '012345', '543210'].includes(pin)) return 'Pick a less guessable PIN.';
  return '';
}

function PinInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <label>{label}<input className="pinInput" inputMode="numeric" autoComplete="off" maxLength={6} value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="••••••" required /></label>;
}

/** Create a dog-only profile, or log back into one, with the dog's name + PIN. */
export function GuestAccess({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<'create' | 'login'>('create');
  const [name, setName] = useState('');
  const [breed, setBreed] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const problem = pinProblem(pin);
    if (problem) return setMessage(problem);
    if (mode === 'create' && pin !== pin2) return setMessage('The two PINs don’t match.');
    setBusy(true);
    const result = mode === 'create' ? await guestCreate(name.trim(), pin, breed) : await guestLogin(name.trim(), pin);
    setBusy(false);
    if (!result.ok) return setMessage(result.error);
    onDone();
  }

  return (
    <form className="authPanel guestPanel" onSubmit={submit}>
      <div><p className="eyebrow"><PawPrint /> No account needed</p><h3>{mode === 'create' ? 'Just make a dog profile' : 'Open your dog’s profile'}</h3><p className="formHint">{mode === 'create' ? 'Only your dog’s name and a 6-digit PIN. You can upgrade to a full account any time.' : 'Use your dog’s name and the 6-digit PIN you picked.'}</p></div>
      <div className="authTabs" role="tablist">
        <button type="button" role="tab" aria-selected={mode === 'create'} className={mode === 'create' ? 'active' : ''} onClick={() => { setMode('create'); setMessage(''); }}>New dog</button>
        <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setMessage(''); }}>I have a PIN</button>
      </div>
      <label>Dog’s name<input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="e.g. Clyde" required /></label>
      {mode === 'create' && <label>Breed<input list="guest-breeds" value={breed} onChange={(e) => setBreed(e.target.value)} placeholder="Start typing…" /><datalist id="guest-breeds">{BREED_NAMES.map((b) => <option key={b} value={b} />)}</datalist></label>}
      <PinInput label="6-digit PIN" value={pin} onChange={setPin} />
      {mode === 'create' && <PinInput label="Type the PIN again" value={pin2} onChange={setPin2} />}
      <button className="primary" type="submit" disabled={busy}>{busy ? 'One moment…' : mode === 'create' ? 'Create dog profile' : 'Open profile'}</button>
      {message && <p className="authMessage" role="status">{message}</p>}
      <small className="formHint"><Lock /> Write your PIN down. For your dog’s safety, five wrong tries locks the name for 15 minutes.</small>
    </form>
  );
}

/** What someone sees in the app before signing in: three clear ways in. */
export function AppGate({ onGuest }: { onGuest: () => void }) {
  return (
    <main className="appGate">
      <div className="shell">
        <Link className="brandLockup" href="/"><img src="/images/logo/MyPetID-Logo_Resized.jpg" alt="" /><span>MyPet<b>ID</b></span></Link>
        <div className="gateHead"><h1>Welcome to MyPetID</h1><p className="lead">Your dog’s ID card, health, walks and Dog Pack in one place.</p></div>
        <div className="gateGrid">
          <div className="gateCol"><AuthPanel /><ul className="gatePerks"><li><Check /> Your own profile plus profiles for each dog</li><li><Check /> Walks with the 3D map, Dog Pack and meetups</li><li><Check /> NFC ID card with plans from $3/month</li></ul></div>
          <div className="gateCol"><GuestAccess onDone={onGuest} /><ul className="gatePerks"><li><Heart /> One dog profile with a public page</li><li><ShieldCheck /> No email or password</li><li><Sparkles /> Upgrade later without losing anything</li></ul></div>
        </div>
        <section className="gateApp"><GetTheApp /></section>
      </div>
    </main>
  );
}

/** The guest's single dog profile: view it as finders do and edit the basics. */
export function GuestPetHome({ onExit }: { onExit: () => void }) {
  const [pet, setPet] = useState<GuestPet | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ name: '', breed: '', about: '', health: '', phone: '', email: '', photo: '' });
  const [message, setMessage] = useState('');

  useEffect(() => {
    guestLoad().then((loaded) => {
      setPet(loaded); setLoading(false);
      if (!loaded) onExit();
      else setDraft({ name: loaded.name, breed: loaded.breed || '', about: loaded.behavior_public || '', health: loaded.medical_public || '', phone: loaded.contact_public?.phone || '', email: loaded.contact_public?.email || '', photo: loaded.photo_url || '' });
    });
  }, [onExit]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const { pet: updated, error } = await guestUpdate({ name: draft.name, breed: draft.breed, behavior_public: draft.about, medical_public: draft.health, photo_url: draft.photo, contact_public: { phone: draft.phone || null, email: draft.email || null } });
    if (error) return setMessage(error);
    if (updated) setPet(updated);
    setEditing(false); setMessage('Saved!');
  }
  async function toggleLost() {
    if (!pet) return;
    const { pet: updated, error } = await guestUpdate({ lost_mode: !pet.lost_mode });
    if (error) return setMessage(error);
    if (updated) setPet(updated);
  }

  if (loading || !pet) return <main className="appGate"><div className="shell"><p className="formHint">Loading your dog’s profile…</p></div></main>;
  return (
    <main className="appGate">
      <div className="shell">
        <div className="guestBar"><Link className="brandLockup" href="/"><img src="/images/logo/MyPetID-Logo_Resized.jpg" alt="" /><span>MyPet<b>ID</b></span></Link><button type="button" onClick={() => { guestLogout(); onExit(); }}>Log out</button></div>
        {message && <p className="authMessage" role="status">{message}</p>}
        <PetProfileCard mode="owner" pet={{ name: pet.name, breed: pet.breed, photoUrl: pet.photo_url, coverUrl: pet.cover_url, about: pet.behavior_public, health: pet.medical_public, phone: pet.contact_public?.phone, email: pet.contact_public?.email, lost: pet.lost_mode }}
          ownerTools={<><button className="primary" type="button" onClick={() => setEditing(!editing)}>{editing ? 'Close editor' : 'Edit profile'}</button><button className={pet.lost_mode ? 'dangerButton' : ''} type="button" onClick={toggleLost}>{pet.lost_mode ? 'Mark as found' : 'Mark as lost'}</button></>} />
        {editing && <form className="panel guestEditor" onSubmit={save}>
          <h2>Edit {pet.name}</h2>
          <div className="grid2">
            <label>Name<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={40} /></label>
            <label>Breed<input list="guest-breeds-edit" value={draft.breed} onChange={(e) => setDraft({ ...draft, breed: e.target.value })} /><datalist id="guest-breeds-edit">{BREED_NAMES.map((b) => <option key={b} value={b} />)}</datalist></label>
            <label>Photo link<input value={draft.photo} onChange={(e) => setDraft({ ...draft, photo: e.target.value })} placeholder="https://…" /></label>
            <label>Phone for finders<input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} inputMode="tel" /></label>
            <label>Email for finders<input value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} type="email" /></label>
          </div>
          <label>About {draft.name || 'your dog'}<textarea value={draft.about} onChange={(e) => setDraft({ ...draft, about: e.target.value })} maxLength={1000} placeholder="Friendly, a little shy with strangers, loves treats…" /></label>
          <label>Health notes finders should know<textarea value={draft.health} onChange={(e) => setDraft({ ...draft, health: e.target.value })} maxLength={1000} placeholder="Allergies, medications, conditions…" /></label>
          <div className="actions"><button className="primary" type="submit">Save</button></div>
        </form>}
        <section className="panel upgradePanel">
          <h2>Want the full MyPetID?</h2>
          <p>Create a free account to add your own profile, more details about {pet.name}, walks, Dog Pack and an NFC ID card. {pet.name}’s profile moves over with your name and PIN.</p>
          <div className="actions"><Link className="button primary" href="/dashboard/account/?claim=1">Create an account</Link></div>
        </section>
      </div>
    </main>
  );
}
