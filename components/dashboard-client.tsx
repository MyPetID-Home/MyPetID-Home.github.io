"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { hasSupabaseConfig, supabase } from '../lib/supabase';
import { AuthPanel } from './auth-panel';

type Tab = 'onboarding' | 'overview' | 'public' | 'account' | 'pets' | 'walks' | 'diet' | 'medical' | 'lost' | 'pack' | 'goals' | 'settings' | 'admin';
type Theme = 'dark' | 'light';
type Palette = 'forest' | 'ocean' | 'sunset' | 'mono';
type WalkEndMode = 'destination' | 'start' | 'home' | 'custom';
type Coords = { lat: number; lng: number; accuracy?: number; label: string };
type RoutePoint = { x: number; y: number; label?: string; coords?: Coords };

type PetProfile = {
  name: string;
  tagId: string;
  species: string;
  breed: string;
  birthday: string;
  sex: string;
  eyeColor: string;
  coatColor: string;
  coatType: string;
  weight: string;
  height: string;
  length: string;
  microchip: string;
  vetName: string;
  vetPhone: string;
  vetAddress: string;
  homeBase: string;
  photoUrl: string;
  medicalNotes: string;
  behaviorNotes: string;
  allergies: string;
  medications: string;
  feeding: string;
  favoriteTreats: string;
  publicFields: string[];
};

type AccountProfile = {
  username: string;
  displayName: string;
  email: string;
  phone: string;
  address: string;
  avatarUrl: string;
  emergencyContact: string;
  passwordLabel: string;
};

type WalkSession = { id: number; start: string; end?: string; distance: number; duration: number; notes: string; mode?: WalkEndMode; startCoords?: Coords; endCoords?: Coords; route?: RoutePoint[] };
type MealLog = { id: number; time: string; meal: string; amount: string; calories: number; done: boolean };
type MedicalRecord = { id: number; title: string; kind: string; date: string; notes: string; public: boolean };
type LostReport = { id: number; status: string; location: string; note: string; time: string };
type PackMessage = { id: number; author: string; text: string; time: string };
type PackFriend = { id: number; name: string; dog: string; status: string; activity: string };
type ManagedUser = { id: number; role: string; name: string; email: string; plan: keyof typeof tiers; pets: number; status: string };

const tabs: Tab[] = ['onboarding', 'overview', 'public', 'account', 'pets', 'walks', 'diet', 'medical', 'lost', 'pack', 'goals', 'settings', 'admin'];
const eyeColors = ['Brown', 'Amber', 'Hazel', 'Blue', 'Green', 'Heterochromia', 'Unknown'];
const coatColors = ['Black', 'White', 'Brown', 'Tan', 'Golden', 'Gray', 'Red', 'Merle', 'Brindle', 'Black / white', 'Tri-color', 'Custom'];
const coatTypes = ['Short', 'Medium', 'Long', 'Curly', 'Wire', 'Double coat', 'Hairless', 'Custom'];
const sizeBands = ['Toy', 'Small', 'Medium', 'Large', 'Giant', 'Custom'];
const recordKinds = ['Vaccine', 'Medication', 'Vet visit', 'Lab result', 'Insurance', 'ID', 'Document', 'Custom'];

const tiers = {
  free: { label: 'Free', pets: 1, users: 1, scan: false },
  basic: { label: 'Basic', pets: 1, users: 1, scan: true },
  silver: { label: 'Silver', pets: 1, users: 2, scan: true },
  gold: { label: 'Gold', pets: 2, users: 1, scan: true },
  diamond: { label: 'Diamond', pets: 3, users: 2, scan: true },
  admin: { label: 'Admin', pets: 999, users: 999, scan: true },
};

const defaultState = {
  theme: 'dark' as Theme,
  palette: 'forest' as Palette,
  tier: 'admin' as keyof typeof tiers,
  adminMode: false,
  onboardingStep: 0,
  account: {
    username: 'cak3d',
    displayName: 'CAK3D',
    email: 'admin@mypetid.local',
    phone: '(207) 555-0137',
    address: 'Owner address private by default',
    avatarUrl: '/images/logo/MyPetID-Logo_Resized.jpg',
    emergencyContact: 'Secondary contact not set',
    passwordLabel: 'Password managed by Supabase Auth',
  } satisfies AccountProfile,
  pet: {
    name: 'Clyde',
    tagId: 'demo-tag-001',
    species: 'Dog',
    breed: 'Good boy mix',
    birthday: '2021-06-01',
    sex: 'Male',
    eyeColor: 'Brown',
    coatColor: 'Black / white',
    coatType: 'Short',
    weight: '58 lb',
    height: 'Large',
    length: 'Medium',
    microchip: '982000000000000',
    vetName: 'MyPetID Family Vet',
    vetPhone: '(207) 555-0198',
    vetAddress: 'Vet address private unless owner shares it',
    homeBase: 'Home',
    photoUrl: '/images/dog/Clyde-Nice.jpg',
    medicalNotes: 'Sensitive stomach. Avoid rich treats unless necessary.',
    behaviorNotes: 'Friendly, loves tug, nervous around loud trucks.',
    allergies: 'Chicken-heavy treats, unknown pollen sensitivity',
    medications: 'Monthly flea/tick. Probiotic with dinner.',
    feeding: 'Breakfast 7 AM: 1 cup kibble. Dinner 6 PM: 1 cup kibble + probiotic.',
    favoriteTreats: 'Pumpkin biscuits, peanut butter lick mat',
    publicFields: ['Photo', 'Owner contact', 'Medical notes', 'Behavior notes', 'Lost mode', 'Last safe scan map'],
  } satisfies PetProfile,
  walks: [{ id: 1, start: 'Today 8:15 AM', end: 'Today 8:42 AM', distance: 1.42, duration: 27, mode: 'start' as WalkEndMode, notes: 'Morning loop, normal pace.', route: [{ x: 15, y: 70 }, { x: 35, y: 48 }, { x: 58, y: 62 }, { x: 78, y: 42 }] }] as WalkSession[],
  meals: [
    { id: 1, time: '7:00 AM', meal: 'Breakfast', amount: '1 cup kibble', calories: 410, done: true },
    { id: 2, time: '6:00 PM', meal: 'Dinner', amount: '1 cup kibble + probiotic', calories: 430, done: false },
  ] as MealLog[],
  records: [
    { id: 1, title: 'Rabies certificate', kind: 'Vaccine', date: '2026-08-01', notes: 'Certificate on file.', public: true },
    { id: 2, title: 'Microchip registration', kind: 'ID', date: '2026-01-12', notes: 'Verified owner contact.', public: false },
  ] as MedicalRecord[],
  lostReports: [{ id: 1, status: 'Resolved', location: 'Demo park trail', note: 'Finder shared safe location.', time: 'Yesterday 5:12 PM' }] as LostReport[],
  packFriends: [
    { id: 1, name: 'Sam', dog: 'Ranger', status: 'Friend', activity: 'Planning a park day Saturday' },
    { id: 2, name: 'Mia', dog: 'Nova', status: 'Invite sent', activity: 'Evening walk streak: 4 days' },
  ] as PackFriend[],
  packMessages: [
    { id: 1, author: 'Sam', text: 'Ranger is free for the park loop after 4.', time: '10:22 AM' },
    { id: 2, author: 'CAK3D', text: 'Clyde is in. I will start a route and share the plan.', time: '10:25 AM' },
  ] as PackMessage[],
  managedUsers: [
    { id: 1, role: 'Admin', name: 'CAK3D', email: 'admin@mypetid.local', plan: 'admin' as keyof typeof tiers, pets: 1, status: 'Active' },
    { id: 2, role: 'User', name: 'Demo Walker', email: 'walker@example.com', plan: 'basic' as keyof typeof tiers, pets: 1, status: 'Invited' },
  ] as ManagedUser[],
  settings: {
    pushAlerts: true,
    emailAlerts: true,
    publicMedical: true,
    publicBehavior: true,
    publicContact: true,
    shareLastScan: true,
    gamifyCare: true,
    units: 'miles',
    privacyMode: 'balanced',
    mapStyle: 'topographic',
    defaultWalkEnd: 'start' as WalkEndMode,
    customDestination: 'Neighborhood loop',
  },
  goals: { weeklyMiles: 8, mealsPerDay: 2, careTasks: 18, currentXp: 640, level: 4 },
};

function mergeState(raw: Partial<typeof defaultState>) {
  return {
    ...defaultState,
    ...raw,
    account: { ...defaultState.account, ...(raw.account || {}) },
    pet: { ...defaultState.pet, ...(raw.pet || {}) },
    settings: { ...defaultState.settings, ...(raw.settings || {}) },
    goals: { ...defaultState.goals, ...(raw.goals || {}) },
  };
}

function loadState() {
  if (typeof window === 'undefined') return defaultState;
  try {
    return mergeState(JSON.parse(localStorage.getItem('mypetid.dashboard') || '{}'));
  } catch {
    return defaultState;
  }
}

function ageFromBirthday(value: string) {
  if (!value) return 'Birthday not set';
  const birth = new Date(`${value}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return 'Birthday not set';
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  if (now.getDate() < birth.getDate()) months -= 1;
  if (months < 0) { years -= 1; months += 12; }
  return years > 0 ? `${years} yr ${months} mo` : `${Math.max(0, months)} mo`;
}

function formatCoords(coords?: Coords) {
  if (!coords) return 'Waiting for device GPS';
  return `${coords.label}: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}${coords.accuracy ? ` ±${Math.round(coords.accuracy)}m` : ''}`;
}

function Field({ label, value, onChange, type = 'text', hint }: { label: string; value: string; type?: string; hint?: string; onChange: (value: string) => void }) {
  return <label>{label}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} />{hint && <small>{hint}</small>}</label>;
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label>{label}<select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label>{label}<textarea value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

export function DashboardClient() {
  const [state, setState] = useState(defaultState);
  const [activeTab, setActiveTab] = useState<Tab>('onboarding');
  const [message, setMessage] = useState('Ready. Every field saves to this app shell, updates previews, and is ready for Supabase-backed persistence.');
  const [walking, setWalking] = useState(false);
  const [walkSeconds, setWalkSeconds] = useState(0);
  const [walkMiles, setWalkMiles] = useState(0);
  const [walkPath, setWalkPath] = useState<RoutePoint[]>([{ x: 12, y: 70, label: 'Start' }, { x: 20, y: 62 }]);
  const [walkStart, setWalkStart] = useState<Coords | undefined>();
  const [walkEnd, setWalkEnd] = useState<Coords | undefined>();
  const [walkEndMode, setWalkEndMode] = useState<WalkEndMode>('start');
  const [packDraft, setPackDraft] = useState('Who wants to hit the park this afternoon?');
  const [userDraft, setUserDraft] = useState({ name: 'New Owner', email: 'owner@example.com', role: 'User' });

  useEffect(() => setState(loadState()), []);
  useEffect(() => {
    document.documentElement.dataset.theme = state.theme;
    document.documentElement.dataset.palette = state.palette;
    localStorage.setItem('mypetid.dashboard', JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    if (!walking) return;
    const timer = window.setInterval(() => {
      setWalkSeconds((value) => value + 1);
      setWalkMiles((value) => Number((value + 0.018).toFixed(3)));
      setWalkPath((path) => {
        const last = path[path.length - 1];
        const next = { x: Math.min(92, last.x + 3 + Math.random() * 4), y: Math.max(18, Math.min(82, last.y + (Math.random() * 14 - 7))), label: 'Live tracker' };
        return [...path.slice(-15), next];
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [walking]);

  const pet = state.pet;
  const account = state.account;
  const petAge = ageFromBirthday(pet.birthday);
  const weeklyDone = state.walks.reduce((sum, walk) => sum + walk.distance, 0) + walkMiles;
  const weeklyProgress = Math.min(100, Math.round((weeklyDone / Math.max(1, state.goals.weeklyMiles)) * 100));
  const publicUrl = useMemo(() => typeof window === 'undefined' ? `/scan/?tag=${pet.tagId}` : `${window.location.origin}/scan/?tag=${encodeURIComponent(pet.tagId)}`, [pet.tagId]);
  const readOnlyUrl = `/pet/?tag=${encodeURIComponent(pet.tagId)}`;
  const pathPoints = walkPath.map((point) => `${point.x},${point.y}`).join(' ');
  const lastPoint = walkPath[walkPath.length - 1];
  const onboardingComplete = [account.displayName, account.email, pet.name, pet.birthday, pet.vetName, pet.weight, pet.eyeColor, pet.coatColor].filter(Boolean).length;

  function patchAccount(next: Partial<AccountProfile>) { setState({ ...state, account: { ...account, ...next } }); }
  function patchPet(next: Partial<PetProfile>) { setState({ ...state, pet: { ...pet, ...next } }); }
  function patchSettings(next: Partial<typeof state.settings>) { setState({ ...state, settings: { ...state.settings, ...next } }); }
  function awardXp(points: number, reason: string) {
    const currentXp = state.goals.currentXp + points;
    const level = Math.max(state.goals.level, Math.floor(currentXp / 250) + 1);
    setState({ ...state, goals: { ...state.goals, currentXp, level } });
    setMessage(`+${points} XP: ${reason}`);
  }

  function captureLocation(label: string, callback: (coords: Coords) => void) {
    if (!navigator.geolocation) {
      const fallback = { lat: 44.09737 + Math.random() / 100, lng: -70.16535 + Math.random() / 100, label: `${label} demo` };
      callback(fallback);
      setMessage(`${label} saved with demo coordinates because browser GPS is unavailable.`);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = { lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy, label };
        callback(coords);
        setMessage(`${label} saved from this device: ${formatCoords(coords)}.`);
      },
      () => {
        const fallback = { lat: 44.09737 + Math.random() / 100, lng: -70.16535 + Math.random() / 100, label: `${label} demo` };
        callback(fallback);
        setMessage(`${label} saved with demo coordinates because GPS permission was declined.`);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 15000 }
    );
  }

  async function savePetToSupabase() {
    if (!supabase) return setMessage('Supabase is not configured in this build; data is saved locally and routed through previews.');
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return setMessage('Sign in first before saving pet data to Supabase.');
    const { error } = await supabase.from('pets').upsert({
      owner_id: auth.user.id,
      name: pet.name,
      species: pet.species.toLowerCase(),
      breed: pet.breed,
      photo_url: pet.photoUrl,
      medical_public: pet.medicalNotes,
      behavior_public: pet.behaviorNotes,
      feeding_plan: pet.feeding,
      care_notes: `${pet.allergies}\n${pet.medications}\nVet: ${pet.vetName} ${pet.vetPhone}`,
    });
    setMessage(error ? error.message : 'Pet profile saved to Supabase. Public profile and dashboard previews are already updated locally.');
  }

  function startWalk() {
    setWalking(true); setWalkSeconds(0); setWalkMiles(0); setWalkEnd(undefined); setWalkPath([{ x: 12, y: 70, label: 'Start' }, { x: 20, y: 62 }]);
    captureLocation('Walk start', setWalkStart);
  }
  function endWalk(mode = walkEndMode) {
    captureLocation('Walk end', (coords) => {
      const route = [...walkPath, { x: mode === 'start' ? 12 : mode === 'home' ? 22 : mode === 'destination' ? 88 : lastPoint.x, y: mode === 'start' ? 70 : mode === 'home' ? 76 : mode === 'destination' ? 30 : lastPoint.y, label: `End: ${mode}`, coords }];
      const entry = { id: Date.now(), start: 'Just now', end: `Ended by ${mode}`, distance: Number(walkMiles.toFixed(2)), duration: Math.max(1, Math.round(walkSeconds / 60)), mode, notes: `Tracked from ${formatCoords(walkStart)} to ${formatCoords(coords)}.`, startCoords: walkStart, endCoords: coords, route };
      setState({ ...state, walks: [entry, ...state.walks], goals: { ...state.goals, currentXp: state.goals.currentXp + 50, level: Math.max(state.goals.level, Math.floor((state.goals.currentXp + 50) / 250) + 1) } });
      setWalkPath(route); setWalkEnd(coords); setWalking(false); setMessage(`Walk saved: ${entry.distance} mi, ${walkSeconds}s, ended by ${mode}. +50 XP.`);
    });
  }
  function addMeal() { setState({ ...state, meals: [{ id: Date.now(), time: '12:00 PM', meal: 'Snack', amount: 'Custom amount', calories: 120, done: false }, ...state.meals] }); }
  function addRecord() { setState({ ...state, records: [{ id: Date.now(), title: 'New record', kind: 'Medical', date: new Date().toISOString().slice(0, 10), notes: 'Editable notes', public: false }, ...state.records] }); }
  function addLostReport(status = 'Open') { setState({ ...state, lostReports: [{ id: Date.now(), status, location: 'New sighting location', note: 'Editable lost/found note', time: 'Now' }, ...state.lostReports] }); }
  function sendPackMessage() {
    if (!packDraft.trim()) return;
    setState({ ...state, packMessages: [{ id: Date.now(), author: account.displayName, text: packDraft, time: 'Now' }, ...state.packMessages] });
    setPackDraft(''); setMessage('Dog Pack message posted locally. Production chat should persist through Supabase realtime.');
  }
  function addManagedUser() {
    setState({ ...state, managedUsers: [{ id: Date.now(), role: userDraft.role, name: userDraft.name, email: userDraft.email, plan: 'free', pets: 0, status: 'Invited' }, ...state.managedUsers] });
    setMessage(`Admin invite staged for ${userDraft.email}. Production email invite belongs behind Supabase admin/Edge Function.`);
  }

  return (
    <main className="appShell proApp">
      <aside className="sidebar">
        <Link className="brandLockup" href="/"><img src="/images/logo/MyPetID-Logo_Resized.jpg" alt="MyPetID logo" /><span>MyPetID</span></Link>
        <nav className="sideNav" aria-label="Dashboard sections">{tabs.map((tab) => <button key={tab} className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)} type="button">{tab}</button>)}</nav>
        <div className={`tierBadge ${state.tier === 'admin' ? 'red' : 'green'}`}><span>{state.adminMode ? 'Admin view' : tiers[state.tier].label}</span><strong>{tiers[state.tier].pets} pets • {tiers[state.tier].users} users</strong><small>{tiers[state.tier].scan ? 'Scan tracking unlocked' : 'Scan tracking locked'}</small></div>
      </aside>

      <section className="workspace">
        <header className="appHeader">
          <div><p className="eyebrow">Production command center</p><h1>{state.adminMode ? 'Admin app studio' : `${pet.name}'s life tracker`}</h1><p>Step-by-step setup, editable account and pet records, live walking routes, public profile preview, Dog Pack social tools, and admin controls that all update shared app state.</p></div>
          <div className="petAvatarCard"><img src={pet.photoUrl || '/images/dog/Clyde-Nice.jpg'} alt={pet.name} /><span className="pulseDot" /></div>
        </header>
        {!hasSupabaseConfig && <p className="notice">Demo mode: Supabase public env values are missing from this static build, so edits save locally in this browser and flow through the UI.</p>}
        <AuthPanel />
        <div className="dashboardStatus"><span>{message}</span><div className="actions compact"><button type="button" onClick={() => setState({ ...state, adminMode: !state.adminMode })}>{state.adminMode ? 'Use as user' : 'Switch to admin'}</button><button type="button" onClick={() => setState({ ...state, theme: state.theme === 'dark' ? 'light' : 'dark' })}>{state.theme === 'dark' ? 'Light mode' : 'Dark mode'}</button></div></div>

        {activeTab === 'onboarding' && <div className="dashboardGrid">
          <section className="panel wide"><p className="eyebrow">Step-by-step setup</p><h2>Finish the profile without guessing where anything goes</h2><div className="progress"><span style={{ width: `${Math.round((onboardingComplete / 8) * 100)}%` }} /></div><p>{onboardingComplete}/8 starter items complete. Use Next to move through account, pet, vet, walking, privacy, and public preview setup.</p><div className="wizardSteps">{['Account', 'Pet basics', 'Measurements', 'Vet + medical', 'Walk route', 'Public profile'].map((step, index) => <button key={step} type="button" className={state.onboardingStep === index ? 'active' : ''} onClick={() => setState({ ...state, onboardingStep: index })}>{index + 1}. {step}</button>)}</div><div className="actions"><button className="primary" type="button" onClick={() => setState({ ...state, onboardingStep: Math.min(5, state.onboardingStep + 1) })}>Next step</button><button type="button" onClick={() => setActiveTab(['account','pets','pets','medical','walks','public'][state.onboardingStep] as Tab)}>Open this section</button><button type="button" onClick={() => { localStorage.setItem('mypetid.onboardingComplete', 'true'); setMessage('Onboarding marked complete locally.'); }}>Mark setup complete</button></div></section>
          <section className="panel"><h3>Current step</h3><p>{['Create the owner account and contact routes.', 'Enter name, birthday, sex, breed, tag, and photo.', 'Use dropdowns for eyes, coat, size, weight, height, and length.', 'Add vet contact, allergies, medications, and public-safe records.', 'Start a GPS route and choose how walks end.', 'Preview exactly what a finder or friend sees.'][state.onboardingStep]}</p></section>
          <section className="panel"><h3>Live preview</h3><p>{pet.name} • {petAge}</p><p>{pet.eyeColor} eyes • {pet.coatColor} {pet.coatType} coat</p><p>{pet.vetName} • {pet.vetPhone}</p></section>
        </div>}

        {activeTab === 'overview' && <div className="dashboardGrid">
          <section className="panel heroPanel"><div><p className="eyebrow">NFC-ready profile</p><h2>{pet.name}</h2><p>{pet.breed} • {petAge} • {pet.weight} • tag {pet.tagId}</p><div className="actions"><Link className="button primary" href={`/scan/?tag=${encodeURIComponent(pet.tagId)}`}>Open scan gate</Link><Link className="button" href={readOnlyUrl}>Public profile</Link><button type="button" onClick={savePetToSupabase}>Save pet</button></div></div><QRCodeSVG value={publicUrl} size={160} bgColor="transparent" fgColor="currentColor" /></section>
          <section className="panel stat"><p>Weekly walks</p><strong>{weeklyDone.toFixed(1)} mi</strong><div className="progress"><span style={{ width: `${weeklyProgress}%` }} /></div><span>{weeklyProgress}% of {state.goals.weeklyMiles} mi</span></section>
          <section className="panel stat"><p>Care level</p><strong>Lv {state.goals.level}</strong><span>{state.goals.currentXp} XP</span></section>
          <section className="panel stat"><p>Meals today</p><strong>{state.meals.filter((meal) => meal.done).length}/{state.goals.mealsPerDay}</strong><span>diet tracker</span></section>
          <section className="panel wide"><h2>Real-time topographic walk map</h2><div className="liveMap topoMap"><svg viewBox="0 0 100 100" aria-label="Live route"><path className="contour c1" d="M8 78 C24 42 40 94 62 54 S82 24 96 38"/><path className="contour c2" d="M4 26 C30 8 42 48 62 20 S84 72 99 58"/><polyline points={pathPoints} /><circle cx={walkPath[0].x} cy={walkPath[0].y} r="3"/><circle cx={lastPoint.x} cy={lastPoint.y} r="4" /><text x={lastPoint.x + 4} y={lastPoint.y - 4}>🐾</text></svg></div><div className="routeMeta"><span>{formatCoords(walkStart)}</span><span>{formatCoords(walkEnd)}</span></div><div className="actions">{walking ? <button className="primary" type="button" onClick={() => endWalk(walkEndMode)}>End walk</button> : <button className="primary" type="button" onClick={startWalk}>Start walk</button>}<SelectField label="End option" value={walkEndMode} options={['destination', 'start', 'home', 'custom']} onChange={(v) => setWalkEndMode(v as WalkEndMode)} /><span>{walkMiles.toFixed(2)} mi • {walkSeconds}s</span></div></section>
        </div>}

        {activeTab === 'public' && <div className="dashboardGrid"><section className="panel wide"><p className="eyebrow">Public profile preview</p><h2>What finders, friends, and approved viewers see</h2><div className="publicPreview"><img src={pet.photoUrl} alt={pet.name} /><div><h3>{pet.name}</h3><p>{pet.breed} • {petAge}</p><p>{state.settings.publicBehavior ? pet.behaviorNotes : 'Behavior notes hidden'}</p><dl className="infoList"><dt>Owner-approved medical</dt><dd>{state.settings.publicMedical ? pet.medicalNotes : 'Hidden by privacy settings'}</dd><dt>Contact route</dt><dd>{state.settings.publicContact ? `${account.displayName} via ${account.phone}` : 'Contact hidden'}</dd><dt>Last safe scan</dt><dd>{state.settings.shareLastScan ? 'Map visible during owner-approved mode' : 'Hidden'}</dd></dl><div className="actions"><Link className="button primary" href={readOnlyUrl}>Open public route</Link><button type="button" onClick={() => setActiveTab('settings')}>Edit visibility</button></div></div></div></section><section className="panel"><h3>Routes</h3><p>NFC scan writes only after consent:</p><code>{publicUrl}</code><p>Read-only profile:</p><code>{readOnlyUrl}</code></section></div>}

        {activeTab === 'account' && <div className="dashboardGrid"><section className="panel wide"><h2>Account information</h2><p className="formHint">These fields feed the dashboard header, public contact preview, admin user list, and invite/account routes.</p><div className="grid2"><Field label="Username" value={account.username} onChange={(v) => patchAccount({ username: v })} /><Field label="Display name" value={account.displayName} onChange={(v) => patchAccount({ displayName: v })} /><Field label="Email" type="email" value={account.email} onChange={(v) => patchAccount({ email: v })} /><Field label="Phone" value={account.phone} onChange={(v) => patchAccount({ phone: v })} /><Field label="Profile picture URL" value={account.avatarUrl} onChange={(v) => patchAccount({ avatarUrl: v })} /><Field label="Emergency contact" value={account.emergencyContact} onChange={(v) => patchAccount({ emergencyContact: v })} /></div><TextArea label="Private address" value={account.address} onChange={(v) => patchAccount({ address: v })} /><button className="primary" type="button" onClick={() => setMessage('Account edits saved locally and routed to public/admin previews.')}>Save account</button></section><section className="panel"><img className="profilePreview" src={account.avatarUrl} alt={account.displayName} /><h3>{account.displayName}</h3><p>@{account.username}</p><p>{account.passwordLabel}</p><button type="button" onClick={() => setMessage('Password resets should use Supabase Auth reset email; no password is stored in the static app.')}>Send password reset</button></section></div>}

        {activeTab === 'pets' && <div className="dashboardGrid"><section className="panel wide"><h2>Step-by-step pet profile</h2><p className="formHint">Dropdowns keep profile data clean. Birthday calculates age automatically and every change updates the public profile preview.</p><div className="grid2"><Field label="Name" value={pet.name} onChange={(v) => patchPet({ name: v })} /><Field label="Tag ID" value={pet.tagId} onChange={(v) => patchPet({ tagId: v })} /><SelectField label="Species" value={pet.species} options={['Dog','Cat','Bird','Rabbit','Reptile','Other']} onChange={(v) => patchPet({ species: v })} /><Field label="Breed" value={pet.breed} onChange={(v) => patchPet({ breed: v })} /><Field label="Birthday" type="date" value={pet.birthday} hint={`Age: ${petAge}`} onChange={(v) => patchPet({ birthday: v })} /><SelectField label="Sex" value={pet.sex} options={['Male','Female','Neutered male','Spayed female','Unknown']} onChange={(v) => patchPet({ sex: v })} /><SelectField label="Eye color" value={pet.eyeColor} options={eyeColors} onChange={(v) => patchPet({ eyeColor: v })} /><SelectField label="Coat color" value={pet.coatColor} options={coatColors} onChange={(v) => patchPet({ coatColor: v })} /><SelectField label="Coat type" value={pet.coatType} options={coatTypes} onChange={(v) => patchPet({ coatType: v })} /><SelectField label="Weight" value={pet.weight} options={['Under 10 lb','10-25 lb','26-50 lb','51-75 lb','76-100 lb','100+ lb','58 lb','Custom']} onChange={(v) => patchPet({ weight: v })} /><SelectField label="Height" value={pet.height} options={sizeBands} onChange={(v) => patchPet({ height: v })} /><SelectField label="Length" value={pet.length} options={sizeBands} onChange={(v) => patchPet({ length: v })} /><Field label="Microchip" value={pet.microchip} onChange={(v) => patchPet({ microchip: v })} /><Field label="Photo URL" value={pet.photoUrl} onChange={(v) => patchPet({ photoUrl: v })} /></div><div className="grid2"><Field label="Vet name" value={pet.vetName} onChange={(v) => patchPet({ vetName: v })} /><Field label="Vet phone" value={pet.vetPhone} onChange={(v) => patchPet({ vetPhone: v })} /></div><TextArea label="Vet address / instructions" value={pet.vetAddress} onChange={(v) => patchPet({ vetAddress: v })} /><TextArea label="Public behavior notes" value={pet.behaviorNotes} onChange={(v) => patchPet({ behaviorNotes: v })} /><button className="primary" type="button" onClick={savePetToSupabase}>Save pet profile</button></section><section className="panel"><h3>Pet profile summary</h3><p>{pet.name} is a {petAge} {pet.breed}.</p><p>{pet.eyeColor} eyes • {pet.coatColor} {pet.coatType} coat</p><p>{pet.weight} • {pet.height} height • {pet.length} length</p><p>Vet: {pet.vetName} {pet.vetPhone}</p></section></div>}

        {activeTab === 'walks' && <div className="dashboardGrid"><section className="panel wide"><h2>Walk and route planner</h2><div className="grid2"><SelectField label="End walk by" value={walkEndMode} options={['destination', 'start', 'home', 'custom']} onChange={(v) => setWalkEndMode(v as WalkEndMode)} /><Field label="Custom destination" value={state.settings.customDestination} onChange={(v) => patchSettings({ customDestination: v })} /></div><div className="liveMap topoMap"><svg viewBox="0 0 100 100"><path className="contour c1" d="M8 78 C24 42 40 94 62 54 S82 24 96 38"/><path className="contour c2" d="M4 26 C30 8 42 48 62 20 S84 72 99 58"/><polyline points={pathPoints} /><circle cx={walkPath[0].x} cy={walkPath[0].y} r="3" /><circle cx={lastPoint.x} cy={lastPoint.y} r="4" /><text x={lastPoint.x + 4} y={lastPoint.y - 4}>🐕‍🦺</text></svg></div><div className="routeMeta"><span>Start: {formatCoords(walkStart)}</span><span>End: {formatCoords(walkEnd)}</span></div><div className="actions">{walking ? <button className="primary" type="button" onClick={() => endWalk(walkEndMode)}>End walk</button> : <button className="primary" type="button" onClick={startWalk}>Start walk</button>}<button type="button" onClick={() => setState({ ...state, goals: { ...state.goals, weeklyMiles: state.goals.weeklyMiles + 1 } })}>Raise weekly goal</button><span>{walkMiles.toFixed(2)} mi live</span></div></section>{state.walks.map((walk) => <section className="panel" key={walk.id}><h3>{walk.distance} mi</h3><p>{walk.start} → {walk.end}</p><p>{walk.duration} min • {walk.mode || 'route'} • {walk.notes}</p></section>)}</div>}

        {activeTab === 'diet' && <div className="dashboardGrid"><section className="panel wide"><h2>Diet and meal tracker</h2><TextArea label="Feeding plan" value={pet.feeding} onChange={(v) => patchPet({ feeding: v })} /><Field label="Favorite treats" value={pet.favoriteTreats} onChange={(v) => patchPet({ favoriteTreats: v })} /><button className="primary" type="button" onClick={addMeal}>Add meal/snack</button></section>{state.meals.map((meal) => <section className="panel" key={meal.id}><label className="toggleRow"><input type="checkbox" checked={meal.done} onChange={(event) => setState({ ...state, meals: state.meals.map((item) => item.id === meal.id ? { ...item, done: event.target.checked } : item) })} /> Complete</label><Field label="Time" value={meal.time} onChange={(v) => setState({ ...state, meals: state.meals.map((item) => item.id === meal.id ? { ...item, time: v } : item) })} /><SelectField label="Meal" value={meal.meal} options={['Breakfast','Lunch','Dinner','Snack','Medication','Water','Custom']} onChange={(v) => setState({ ...state, meals: state.meals.map((item) => item.id === meal.id ? { ...item, meal: v } : item) })} /><Field label="Amount" value={meal.amount} onChange={(v) => setState({ ...state, meals: state.meals.map((item) => item.id === meal.id ? { ...item, amount: v } : item) })} /></section>)}</div>}

        {activeTab === 'medical' && <div className="dashboardGrid"><section className="panel wide"><h2>Medical and record keeper</h2><TextArea label="Allergies" value={pet.allergies} onChange={(v) => patchPet({ allergies: v })} /><TextArea label="Medications" value={pet.medications} onChange={(v) => patchPet({ medications: v })} /><button className="primary" type="button" onClick={addRecord}>Add record</button></section>{state.records.map((record) => <section className="panel" key={record.id}><Field label="Title" value={record.title} onChange={(v) => setState({ ...state, records: state.records.map((item) => item.id === record.id ? { ...item, title: v } : item) })} /><SelectField label="Kind" value={record.kind} options={recordKinds} onChange={(v) => setState({ ...state, records: state.records.map((item) => item.id === record.id ? { ...item, kind: v } : item) })} /><Field label="Date" type="date" value={record.date} onChange={(v) => setState({ ...state, records: state.records.map((item) => item.id === record.id ? { ...item, date: v } : item) })} /><TextArea label="Notes" value={record.notes} onChange={(v) => setState({ ...state, records: state.records.map((item) => item.id === record.id ? { ...item, notes: v } : item) })} /><label className="toggleRow"><input type="checkbox" checked={record.public} onChange={(event) => setState({ ...state, records: state.records.map((item) => item.id === record.id ? { ...item, public: event.target.checked } : item) })} /> Public-safe</label></section>)}</div>}

        {activeTab === 'lost' && <div className="dashboardGrid"><section className="panel wide"><h2>Lost/found notification center</h2><p>Flip lost mode, stage finder reports, and keep owner-approved public return-home information together.</p><div className="actions"><button className="primary" type="button" onClick={() => addLostReport('Open')}>Create lost report</button><button type="button" onClick={() => { patchSettings({ shareLastScan: true }); setMessage('Last scan sharing enabled for lost/found mode.'); }}>Share last scan</button></div></section>{state.lostReports.map((report) => <section className="panel" key={report.id}><SelectField label="Status" value={report.status} options={['Open','Searching','Owner contacted','Resolved','False alarm']} onChange={(v) => setState({ ...state, lostReports: state.lostReports.map((item) => item.id === report.id ? { ...item, status: v } : item) })} /><Field label="Location" value={report.location} onChange={(v) => setState({ ...state, lostReports: state.lostReports.map((item) => item.id === report.id ? { ...item, location: v } : item) })} /><TextArea label="Note" value={report.note} onChange={(v) => setState({ ...state, lostReports: state.lostReports.map((item) => item.id === report.id ? { ...item, note: v } : item) })} /><p>{report.time}</p></section>)}</div>}

        {activeTab === 'pack' && <div className="dashboardGrid"><section className="panel wide"><p className="eyebrow">Dog Pack</p><h2>Friends, walks, park plans, and chat</h2><TextArea label="Message your pack" value={packDraft} onChange={setPackDraft} /><div className="actions"><button className="primary" type="button" onClick={sendPackMessage}>Send message</button><button type="button" onClick={() => setState({ ...state, packFriends: [{ id: Date.now(), name: 'New friend', dog: 'New dog', status: 'Invite sent', activity: 'Waiting for approval' }, ...state.packFriends] })}>Add friend</button></div></section>{state.packFriends.map((friend) => <section className="panel" key={friend.id}><h3>{friend.name} + {friend.dog}</h3><p>{friend.status}</p><p>{friend.activity}</p></section>)}<section className="panel wide"><h3>Pack chat</h3>{state.packMessages.map((chat) => <div className="chatBubble" key={chat.id}><strong>{chat.author}</strong><span>{chat.time}</span><p>{chat.text}</p></div>)}</section></div>}

        {activeTab === 'goals' && <div className="dashboardGrid"><section className="panel wide"><h2>Goals, levels, and completion loops</h2><div className="grid2"><Field label="Weekly walk distance" type="number" value={String(state.goals.weeklyMiles)} onChange={(v) => setState({ ...state, goals: { ...state.goals, weeklyMiles: Number(v) || 0 } })} /><Field label="Meals per day" type="number" value={String(state.goals.mealsPerDay)} onChange={(v) => setState({ ...state, goals: { ...state.goals, mealsPerDay: Number(v) || 0 } })} /><Field label="Weekly care tasks" type="number" value={String(state.goals.careTasks)} onChange={(v) => setState({ ...state, goals: { ...state.goals, careTasks: Number(v) || 0 } })} /></div><div className="levelBadge">Level {state.goals.level}<div className="progress"><span style={{ width: `${state.goals.currentXp % 250 / 2.5}%` }} /></div>{state.goals.currentXp} XP</div><div className="actions"><button type="button" onClick={() => awardXp(20, 'care task completed')}>Complete care task</button><button type="button" onClick={() => awardXp(35, 'goal streak completed')}>Complete streak</button></div></section></div>}

        {activeTab === 'settings' && <div className="dashboardGrid"><section className="panel wide"><h2>Settings, privacy, and app look</h2>{Object.entries(state.settings).map(([key, value]) => typeof value === 'boolean' ? <label className="toggleRow" key={key}><input type="checkbox" checked={value} onChange={(event) => patchSettings({ [key]: event.target.checked } as Partial<typeof state.settings>)} /> {key}</label> : null)}<div className="grid2"><SelectField label="Units" value={state.settings.units} options={['miles','kilometers']} onChange={(v) => patchSettings({ units: v })} /><SelectField label="Privacy mode" value={state.settings.privacyMode} options={['strict','balanced','open during lost mode']} onChange={(v) => patchSettings({ privacyMode: v })} /><SelectField label="Map style" value={state.settings.mapStyle} options={['topographic','satellite-ready','city grid','trail map']} onChange={(v) => patchSettings({ mapStyle: v })} /><SelectField label="Default walk end" value={state.settings.defaultWalkEnd} options={['destination','start','home','custom']} onChange={(v) => patchSettings({ defaultWalkEnd: v as WalkEndMode })} /><SelectField label="App color palette" value={state.palette} options={['forest','ocean','sunset','mono']} onChange={(v) => setState({ ...state, palette: v as Palette })} /><SelectField label="Theme" value={state.theme} options={['dark','light']} onChange={(v) => setState({ ...state, theme: v as Theme })} /></div></section><section className="panel"><h3>Scan URLs</h3><p>NFC/QR:</p><code>{publicUrl}</code><p>Read-only:</p><code>{readOnlyUrl}</code></section></div>}

        {activeTab === 'admin' && <div className="dashboardGrid"><section className="panel wide"><h2>Admin console</h2><div className="notificationDock"><span>🔔 3</span><span>📍 1</span><span>🩺 2</span><span>💬 {state.packMessages.length}</span><span>⚙️</span></div><p>Customize app colors/features, switch between admin/user mode, edit users, stage pet profiles, and manage routes. Secret operations still need Supabase Edge Functions before production.</p><div className="grid2"><SelectField label="Global palette" value={state.palette} options={['forest','ocean','sunset','mono']} onChange={(v) => setState({ ...state, palette: v as Palette })} /><SelectField label="Admin account plan" value={state.tier} options={Object.keys(tiers)} onChange={(v) => setState({ ...state, tier: v as keyof typeof tiers })} /><Field label="New user name" value={userDraft.name} onChange={(v) => setUserDraft({ ...userDraft, name: v })} /><Field label="New user email" value={userDraft.email} onChange={(v) => setUserDraft({ ...userDraft, email: v })} /></div><div className="adminActions"><button className="primary" type="button" onClick={() => { patchPet({ tagId: `tag-${Math.random().toString(36).slice(2, 8)}` }); setMessage('New tag code generated locally. Production should mint this server-side.'); }}>Generate tag ID</button><button type="button" onClick={addManagedUser}>Create/invite user</button><button type="button" onClick={() => setState({ ...state, adminMode: !state.adminMode })}>Switch admin/user</button><button type="button" onClick={() => setMessage('Patreon sync requires client secret/creator token on an Edge Function, not in browser.')}>Sync Patreon</button><button type="button" onClick={() => setState(defaultState)}>Reset demo data</button></div></section>{state.managedUsers.map((user) => <section className="panel" key={user.id}><h3>{user.name}</h3><p>{user.role} • {user.status}</p><p>{user.email}</p><SelectField label="Plan" value={user.plan} options={Object.keys(tiers)} onChange={(v) => setState({ ...state, managedUsers: state.managedUsers.map((item) => item.id === user.id ? { ...item, plan: v as keyof typeof tiers } : item) })} /><button type="button" onClick={() => setMessage(`Opened editable admin route for ${user.name}.`)}>Edit account</button></section>)}</div>}
      </section>
    </main>
  );
}
