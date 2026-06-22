"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { hasSupabaseConfig, isAdminEmail, supabase } from '../lib/supabase';

type Profile = {
  id: string;
  email: string | null;
  display_name: string | null;
  phone: string | null;
  tier: 'free' | 'basic' | 'silver' | 'gold' | 'diamond' | 'admin';
  is_admin: boolean;
  patreon_linked?: boolean;
  patreon_tier?: string | null;
  public_contact?: Record<string, unknown> | null;
};

type PetRow = {
  id: string;
  owner_id: string;
  name: string;
  species: string;
  breed: string | null;
  photo_url: string | null;
  medical_public: string | null;
  behavior_public: string | null;
  contact_public: Record<string, unknown> | null;
  lost_mode: boolean;
  feeding_plan?: string | null;
  care_notes?: string | null;
  public_fields?: string[] | null;
};

type TagRow = {
  id: string;
  tag_code: string;
  pet_id: string | null;
  created_by: string | null;
  claimed_at: string | null;
  created_at: string;
};

type ScanRow = {
  id: string;
  tag_id: string | null;
  pet_id: string | null;
  actor: 'owner' | 'linked_user' | 'stranger';
  scanner_profile_id: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracy_meters: number | null;
  note: string | null;
  reported_lost: boolean;
  created_at: string;
};

type DeviceRow = {
  id: string;
  profile_id: string;
  device_fingerprint: string;
  trusted: boolean;
  label: string | null;
  created_at: string;
};

type PetDraft = {
  id?: string;
  name: string;
  species: string;
  breed: string;
  photoUrl: string;
  medicalPublic: string;
  behaviorPublic: string;
  publicPhone: string;
  publicEmail: string;
  lostMode: boolean;
};

const emptyPetDraft: PetDraft = {
  name: 'Clyde',
  species: 'dog',
  breed: 'Good boy mix',
  photoUrl: '/images/dog/Clyde-Nice.jpg',
  medicalPublic: 'Sensitive stomach. Avoid rich treats unless needed for safety.',
  behaviorPublic: 'Friendly, loves tug, nervous around loud trucks.',
  publicPhone: '',
  publicEmail: '',
  lostMode: false,
};

function installId() {
  if (typeof window === 'undefined') return 'server';
  const key = 'mypetid.installId';
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const next = `web-${crypto.randomUUID()}`;
  window.localStorage.setItem(key, next);
  return next;
}

function petToDraft(pet: PetRow): PetDraft {
  const contact = pet.contact_public || {};
  return {
    id: pet.id,
    name: pet.name,
    species: pet.species,
    breed: pet.breed || '',
    photoUrl: pet.photo_url || '',
    medicalPublic: pet.medical_public || '',
    behaviorPublic: pet.behavior_public || '',
    publicPhone: typeof contact.phone === 'string' ? contact.phone : '',
    publicEmail: typeof contact.email === 'string' ? contact.email : '',
    lostMode: pet.lost_mode,
  };
}

function fmtDate(value?: string | null) {
  if (!value) return 'not set';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

async function ensureProfile(user: User) {
  if (!supabase) throw new Error('Supabase unavailable');
  const { data: existing, error: readError } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (readError) throw readError;
  if (existing) return existing as Profile;

  const admin = isAdminEmail(user.email);
  const fallback = {
    id: user.id,
    email: user.email ?? null,
    display_name: user.user_metadata?.display_name ?? user.email?.split('@')[0] ?? 'MyPetID User',
    tier: admin ? 'admin' : 'free',
    is_admin: admin,
  };

  const { data, error } = await supabase
    .from('profiles')
    .insert(fallback)
    .select('*')
    .single();
  if (error) throw error;
  return data as Profile;
}

export function SupabaseWorkspace() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [pets, setPets] = useState<PetRow[]>([]);
  const [tags, setTags] = useState<TagRow[]>([]);
  const [scans, setScans] = useState<ScanRow[]>([]);
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [adminProfiles, setAdminProfiles] = useState<Profile[]>([]);
  const [petDraft, setPetDraft] = useState<PetDraft>(emptyPetDraft);
  const [tagCode, setTagCode] = useState('demo-tag-001');
  const [newTagCode, setNewTagCode] = useState('');
  const [deviceLabel, setDeviceLabel] = useState('This browser');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Supabase workspace ready. Sign in to sync real account, pet, tag, scan, trusted-device, and admin data.');

  const isAdmin = Boolean(profile?.is_admin || isAdminEmail(session?.user.email));
  const selectedPet = useMemo(() => pets.find((pet) => pet.id === petDraft.id) || pets[0] || null, [petDraft.id, pets]);
  const selectedPetTags = useMemo(() => tags.filter((tag) => tag.pet_id === selectedPet?.id), [selectedPet?.id, tags]);
  const selectedPetScans = useMemo(() => scans.filter((scan) => !selectedPet?.id || scan.pet_id === selectedPet.id).slice(0, 6), [scans, selectedPet?.id]);
  const tierLine = profile ? `${profile.tier}${profile.is_admin ? ' • unrestricted admin bypass' : ''}` : 'not signed in';

  const loadWorkspace = useCallback(async (activeSession: Session | null = session) => {
    if (!supabase || !activeSession?.user) return;
    setBusy(true);
    try {
      const nextProfile = await ensureProfile(activeSession.user);
      setProfile(nextProfile);
      const adminMode = Boolean(nextProfile.is_admin || isAdminEmail(activeSession.user.email));
      const petQuery = supabase.from('pets').select('*').order('created_at', { ascending: false });
      const { data: petData, error: petError } = adminMode ? await petQuery.limit(100) : await petQuery.eq('owner_id', activeSession.user.id).limit(25);
      if (petError) throw petError;
      const nextPets = (petData || []) as PetRow[];
      setPets(nextPets);
      if (nextPets[0]) setPetDraft(petToDraft(nextPets[0]));

      const { data: tagData, error: tagError } = await supabase.from('tags').select('*').order('created_at', { ascending: false }).limit(100);
      if (tagError) throw tagError;
      setTags((tagData || []) as TagRow[]);

      const scanQuery = supabase.from('scan_events').select('*').order('created_at', { ascending: false });
      const { data: scanData, error: scanError } = adminMode || !nextPets[0]
        ? await scanQuery.limit(100)
        : await scanQuery.in('pet_id', nextPets.map((pet) => pet.id)).limit(50);
      if (scanError) throw scanError;
      setScans((scanData || []) as ScanRow[]);

      const { data: deviceData, error: deviceError } = await supabase.from('devices').select('*').eq('profile_id', activeSession.user.id).order('created_at', { ascending: false });
      if (deviceError) throw deviceError;
      setDevices((deviceData || []) as DeviceRow[]);

      if (adminMode) {
        const { data: profileData, error: profileError } = await supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(100);
        if (profileError) throw profileError;
        setAdminProfiles((profileData || []) as Profile[]);
      } else {
        setAdminProfiles([]);
      }
      setMessage(`Loaded Supabase workspace for ${activeSession.user.email}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Supabase load failed.');
    } finally {
      setBusy(false);
    }
  }, [session]);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) loadWorkspace(data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) loadWorkspace(nextSession);
      else {
        setProfile(null);
        setPets([]);
        setTags([]);
        setScans([]);
        setDevices([]);
        setAdminProfiles([]);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, [loadWorkspace]);

  async function saveProfile() {
    if (!supabase || !session?.user || !profile) return;
    setBusy(true);
    const { data, error } = await supabase
      .from('profiles')
      .update({ display_name: profile.display_name, phone: profile.phone, public_contact: { phone: profile.phone, email: profile.email } })
      .eq('id', session.user.id)
      .select('*')
      .single();
    setBusy(false);
    if (error) return setMessage(error.message);
    setProfile(data as Profile);
    setMessage('Account profile saved to Supabase.');
  }

  async function savePet() {
    if (!supabase || !session?.user) return setMessage('Sign in first.');
    setBusy(true);
    const payload = {
      ...(petDraft.id ? { id: petDraft.id } : {}),
      owner_id: session.user.id,
      name: petDraft.name.trim() || 'Unnamed pet',
      species: petDraft.species.trim() || 'dog',
      breed: petDraft.breed || null,
      photo_url: petDraft.photoUrl || null,
      medical_public: petDraft.medicalPublic || null,
      behavior_public: petDraft.behaviorPublic || null,
      contact_public: { phone: petDraft.publicPhone || null, email: petDraft.publicEmail || null },
      lost_mode: petDraft.lostMode,
      public_fields: ['name', 'photo', 'contact', 'medical_public', 'behavior_public', 'lost_mode', 'last_scan'],
    };
    const { data, error } = await supabase.from('pets').upsert(payload).select('*').single();
    setBusy(false);
    if (error) return setMessage(error.message);
    const saved = data as PetRow;
    setPets((current) => [saved, ...current.filter((pet) => pet.id !== saved.id)]);
    setPetDraft(petToDraft(saved));
    setMessage(`Saved ${saved.name} to Supabase. Public scan pages can now load this pet when a tag is linked.`);
  }

  async function claimTag() {
    if (!supabase || !session?.user || !selectedPet) return setMessage('Save/select a pet before claiming a tag.');
    const code = tagCode.trim();
    if (!code) return setMessage('Enter a tag code to claim.');
    setBusy(true);
    const { data: existing, error: findError } = await supabase.from('tags').select('*').eq('tag_code', code).maybeSingle();
    if (findError) {
      setBusy(false);
      return setMessage(findError.message);
    }
    if (!existing) {
      setBusy(false);
      return setMessage('That tag code is not minted yet. Admin can create physical tag codes in the admin panel first.');
    }
    const { data, error } = await supabase
      .from('tags')
      .update({ pet_id: selectedPet.id, created_by: session.user.id, claimed_at: new Date().toISOString() })
      .eq('tag_code', code)
      .select('*')
      .single();
    setBusy(false);
    if (error) return setMessage(error.message);
    const saved = data as TagRow;
    setTags((current) => [saved, ...current.filter((tag) => tag.id !== saved.id)]);
    setMessage(`Claimed tag ${saved.tag_code} for ${selectedPet.name}.`);
  }

  async function mintTag() {
    if (!supabase || !session?.user || !isAdmin) return setMessage('Only unrestricted admins can mint tag IDs from the static admin UI.');
    const code = (newTagCode || `tag-${crypto.randomUUID().slice(0, 8)}`).trim();
    setBusy(true);
    const { data, error } = await supabase
      .from('tags')
      .insert({ tag_code: code, created_by: session.user.id })
      .select('*')
      .single();
    setBusy(false);
    if (error) return setMessage(error.message);
    const saved = data as TagRow;
    setTags((current) => [saved, ...current]);
    setNewTagCode('');
    setTagCode(saved.tag_code);
    setMessage(`Minted physical tag code ${saved.tag_code}. Link it to a pet when the QR/NFC tag is assigned.`);
  }

  async function trustDevice() {
    if (!supabase || !session?.user) return setMessage('Sign in first.');
    setBusy(true);
    const fingerprint = installId();
    const { data, error } = await supabase
      .from('devices')
      .upsert({ profile_id: session.user.id, device_fingerprint: fingerprint, trusted: true, label: deviceLabel || 'Trusted browser' }, { onConflict: 'profile_id,device_fingerprint' })
      .select('*')
      .single();
    setBusy(false);
    if (error) return setMessage(error.message);
    const saved = data as DeviceRow;
    setDevices((current) => [saved, ...current.filter((device) => device.id !== saved.id)]);
    setMessage('Trusted this browser for owner scan detection. Stronger passkey/PWA trust can layer on later.');
  }

  async function markOwnerScan() {
    if (!supabase || !session?.user || !selectedPet) return setMessage('Sign in and select a pet first.');
    const tag = selectedPetTags[0];
    setBusy(true);
    const { data, error } = await supabase
      .from('scan_events')
      .insert({ tag_id: tag?.id ?? null, pet_id: selectedPet.id, actor: 'owner', scanner_profile_id: session.user.id, note: `Owner/trusted device scan install=${installId()}` })
      .select('*')
      .single();
    setBusy(false);
    if (error) return setMessage(error.message);
    setScans((current) => [data as ScanRow, ...current]);
    setMessage(`Owner scan logged for ${selectedPet.name} without GPS. Finder GPS still requires explicit consent on /scan/.`);
  }

  if (!hasSupabaseConfig) {
    return (
      <section className="panel wide supabaseWorkspace">
        <p className="eyebrow">Real Supabase workspace</p>
        <h2>Cloud sync waiting on public build env</h2>
        <p>This static build does not include browser-safe Supabase public values. Add only <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in local/GitHub Actions to activate real account, pet, tag, scan, trusted-device, and admin flows.</p>
      </section>
    );
  }

  if (!session?.user) {
    return (
      <section className="panel wide supabaseWorkspace">
        <p className="eyebrow">Real Supabase workspace</p>
        <h2>Sign in above to sync the live app</h2>
        <p>The dashboard demo still works locally, but the production flow now waits for a Supabase session before writing account profiles, pets, physical tag claims, owner scans, trusted browser records, or admin inventory.</p>
      </section>
    );
  }

  return (
    <section className="supabaseWorkspace">
      <div className="workspaceTitle">
        <div>
          <p className="eyebrow">Real Supabase workspace</p>
          <h2>Account, pets, tags, scans, devices, admin</h2>
          <p>{session.user.email} • {tierLine}</p>
        </div>
        <div className="actions compact"><button type="button" disabled={busy} onClick={() => loadWorkspace()}>{busy ? 'Syncing…' : 'Refresh Supabase'}</button></div>
      </div>
      <p className="notice">{message}</p>

      <div className="dashboardGrid supabaseGrid">
        <article className="panel wide">
          <h3>Account profile</h3>
          <div className="grid2">
            <label>Display name<input value={profile?.display_name || ''} onChange={(event) => setProfile(profile ? { ...profile, display_name: event.target.value } : profile)} /></label>
            <label>Public/owner phone<input value={profile?.phone || ''} onChange={(event) => setProfile(profile ? { ...profile, phone: event.target.value } : profile)} /></label>
          </div>
          <div className="actions"><button className="primary" type="button" disabled={busy || !profile} onClick={saveProfile}>Save account</button><button type="button" disabled={busy} onClick={trustDevice}>Trust this browser</button></div>
        </article>

        <article className="panel">
          <h3>Trusted devices</h3>
          {devices.length === 0 ? <p>No trusted browser records yet.</p> : devices.map((device) => <p key={device.id}><strong>{device.label || 'Browser'}</strong><br /><small>{device.trusted ? 'trusted' : 'not trusted'} • {fmtDate(device.created_at)}</small></p>)}
          <label>Device label<input value={deviceLabel} onChange={(event) => setDeviceLabel(event.target.value)} /></label>
        </article>

        <article className="panel wide">
          <h3>Pet profile in Supabase</h3>
          <div className="grid2">
            <label>Name<input value={petDraft.name} onChange={(event) => setPetDraft({ ...petDraft, name: event.target.value })} /></label>
            <label>Species<input value={petDraft.species} onChange={(event) => setPetDraft({ ...petDraft, species: event.target.value })} /></label>
            <label>Breed<input value={petDraft.breed} onChange={(event) => setPetDraft({ ...petDraft, breed: event.target.value })} /></label>
            <label>Photo URL<input value={petDraft.photoUrl} onChange={(event) => setPetDraft({ ...petDraft, photoUrl: event.target.value })} /></label>
            <label>Public phone<input value={petDraft.publicPhone} onChange={(event) => setPetDraft({ ...petDraft, publicPhone: event.target.value })} /></label>
            <label>Public email<input value={petDraft.publicEmail} onChange={(event) => setPetDraft({ ...petDraft, publicEmail: event.target.value })} /></label>
          </div>
          <label>Behavior note<textarea value={petDraft.behaviorPublic} onChange={(event) => setPetDraft({ ...petDraft, behaviorPublic: event.target.value })} /></label>
          <label>Medical note<textarea value={petDraft.medicalPublic} onChange={(event) => setPetDraft({ ...petDraft, medicalPublic: event.target.value })} /></label>
          <label className="toggleRow"><input type="checkbox" checked={petDraft.lostMode} onChange={(event) => setPetDraft({ ...petDraft, lostMode: event.target.checked })} /> Lost mode</label>
          <div className="actions"><button className="primary" type="button" disabled={busy} onClick={savePet}>{petDraft.id ? 'Update pet' : 'Create pet'}</button><button type="button" onClick={() => setPetDraft(emptyPetDraft)}>New pet draft</button></div>
        </article>

        <article className="panel">
          <h3>Your pets</h3>
          {pets.length === 0 ? <p>No Supabase pets yet.</p> : pets.map((pet) => <button className={pet.id === petDraft.id ? 'activeMini' : ''} key={pet.id} type="button" onClick={() => setPetDraft(petToDraft(pet))}>{pet.name}<br /><small>{pet.species} • {pet.lost_mode ? 'lost mode' : 'safe'}</small></button>)}
        </article>

        <article className="panel wide">
          <h3>Physical tag claim</h3>
          <p>Admins mint tag codes before a $10 physical NFC/QR tag ships. Owners claim an existing code and attach it to a saved pet.</p>
          <div className="grid2"><label>Claim existing tag<input value={tagCode} onChange={(event) => setTagCode(event.target.value)} /></label><label>Selected pet<input value={selectedPet?.name || 'Save a pet first'} readOnly /></label></div>
          <div className="actions"><button className="primary" type="button" disabled={busy || !selectedPet} onClick={claimTag}>Claim tag for pet</button><button type="button" disabled={busy || !selectedPet} onClick={markOwnerScan}>Log owner scan</button></div>
          <div className="tagList">{selectedPetTags.length === 0 ? <span>No tags linked to this pet.</span> : selectedPetTags.map((tag) => <span key={tag.id}>#{tag.tag_code}</span>)}</div>
        </article>

        <article className="panel">
          <h3>Recent scans</h3>
          {selectedPetScans.length === 0 ? <p>No scan events loaded yet.</p> : selectedPetScans.map((scan) => <p key={scan.id}><strong>{scan.actor}{scan.reported_lost ? ' • lost sighting' : ''}</strong><br /><small>{fmtDate(scan.created_at)}{scan.latitude ? ` • ${scan.latitude.toFixed(4)}, ${scan.longitude?.toFixed(4)}` : ' • no GPS'}</small></p>)}
        </article>

        {isAdmin && <article className="panel wide adminLivePanel">
          <h3>Admin dashboard: live inventory</h3>
          <p>Admin bypass remains unrestricted for CAK3D testing. Private admin-only work such as invite emails, Patreon sync, and service-role operations still belongs behind Edge Functions/server code.</p>
          <div className="grid2"><label>New physical tag code<input placeholder="tag-cak3d-001" value={newTagCode} onChange={(event) => setNewTagCode(event.target.value)} /></label><label>Admin count<input readOnly value={`${adminProfiles.length} profiles • ${tags.length} tags • ${scans.length} scans`} /></label></div>
          <div className="actions"><button className="primary" type="button" disabled={busy} onClick={mintTag}>Mint admin tag</button></div>
          <div className="adminMiniGrid">
            <div><strong>Profiles</strong>{adminProfiles.slice(0, 5).map((row) => <small key={row.id}>{row.email || row.id} • {row.tier}</small>)}</div>
            <div><strong>Tags</strong>{tags.slice(0, 5).map((row) => <small key={row.id}>{row.tag_code} • {row.pet_id ? 'claimed' : 'unclaimed'}</small>)}</div>
          </div>
        </article>}
      </div>
    </section>
  );
}
