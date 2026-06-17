"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { hasSupabaseConfig, supabase } from '../lib/supabase';
import { AuthPanel } from './auth-panel';

type Tab = 'overview' | 'account' | 'pets' | 'walks' | 'diet' | 'medical' | 'lost' | 'goals' | 'settings' | 'admin';
type Theme = 'dark' | 'light';

type PetProfile = {
  name: string;
  tagId: string;
  species: string;
  breed: string;
  birthday: string;
  sex: string;
  weight: string;
  color: string;
  microchip: string;
  vet: string;
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

type WalkSession = { id: number; start: string; end?: string; distance: number; duration: number; notes: string };
type MealLog = { id: number; time: string; meal: string; amount: string; calories: number; done: boolean };
type MedicalRecord = { id: number; title: string; kind: string; date: string; notes: string; public: boolean };
type LostReport = { id: number; status: string; location: string; note: string; time: string };

const tabs: Tab[] = ['overview', 'account', 'pets', 'walks', 'diet', 'medical', 'lost', 'goals', 'settings', 'admin'];

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
  tier: 'admin' as keyof typeof tiers,
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
    weight: '58 lb',
    color: 'Black / white',
    microchip: '982000000000000',
    vet: 'MyPetID Family Vet',
    photoUrl: '/images/dog/Clyde-Nice.jpg',
    medicalNotes: 'Sensitive stomach. Avoid rich treats unless necessary.',
    behaviorNotes: 'Friendly, loves tug, nervous around loud trucks.',
    allergies: 'Chicken-heavy treats, unknown pollen sensitivity',
    medications: 'Monthly flea/tick. Probiotic with dinner.',
    feeding: 'Breakfast 7 AM: 1 cup kibble. Dinner 6 PM: 1 cup kibble + probiotic.',
    favoriteTreats: 'Pumpkin biscuits, peanut butter lick mat',
    publicFields: ['Photo', 'Owner contact', 'Medical notes', 'Behavior notes', 'Lost mode', 'Last safe scan map'],
  } satisfies PetProfile,
  walks: [{ id: 1, start: 'Today 8:15 AM', end: 'Today 8:42 AM', distance: 1.42, duration: 27, notes: 'Morning loop, normal pace.' }] as WalkSession[],
  meals: [
    { id: 1, time: '7:00 AM', meal: 'Breakfast', amount: '1 cup kibble', calories: 410, done: true },
    { id: 2, time: '6:00 PM', meal: 'Dinner', amount: '1 cup kibble + probiotic', calories: 430, done: false },
  ] as MealLog[],
  records: [
    { id: 1, title: 'Rabies certificate', kind: 'Vaccine', date: '2026-08-01', notes: 'Certificate on file.', public: true },
    { id: 2, title: 'Microchip registration', kind: 'ID', date: '2026-01-12', notes: 'Verified owner contact.', public: false },
  ] as MedicalRecord[],
  lostReports: [{ id: 1, status: 'Resolved', location: 'Demo park trail', note: 'Finder shared safe location.', time: 'Yesterday 5:12 PM' }] as LostReport[],
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
  },
  goals: { weeklyMiles: 8, mealsPerDay: 2, careTasks: 18, currentXp: 640, level: 4 },
};

function loadState() {
  if (typeof window === 'undefined') return defaultState;
  try {
    return { ...defaultState, ...JSON.parse(localStorage.getItem('mypetid.dashboard') || '{}') };
  } catch {
    return defaultState;
  }
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; type?: string; onChange: (value: string) => void }) {
  return <label>{label}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label>{label}<textarea value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

export function DashboardClient() {
  const [state, setState] = useState(defaultState);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [message, setMessage] = useState('Ready. Edit fields, start walks, log meals, update records, and save locally or to Supabase where wired.');
  const [walking, setWalking] = useState(false);
  const [walkSeconds, setWalkSeconds] = useState(0);
  const [walkMiles, setWalkMiles] = useState(0);
  const [walkPath, setWalkPath] = useState([{ x: 12, y: 70 }, { x: 20, y: 62 }]);

  useEffect(() => setState(loadState()), []);
  useEffect(() => {
    document.documentElement.dataset.theme = state.theme;
    localStorage.setItem('mypetid.dashboard', JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    if (!walking) return;
    const timer = window.setInterval(() => {
      setWalkSeconds((value) => value + 1);
      setWalkMiles((value) => Number((value + 0.018).toFixed(3)));
      setWalkPath((path) => {
        const last = path[path.length - 1];
        const next = { x: Math.min(90, last.x + 4 + Math.random() * 5), y: Math.max(20, Math.min(80, last.y + (Math.random() * 16 - 8))) };
        return [...path.slice(-11), next];
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [walking]);

  const pet = state.pet;
  const account = state.account;
  const weeklyDone = state.walks.reduce((sum, walk) => sum + walk.distance, 0) + walkMiles;
  const weeklyProgress = Math.min(100, Math.round((weeklyDone / state.goals.weeklyMiles) * 100));
  const publicUrl = useMemo(() => typeof window === 'undefined' ? `/scan/?tag=${pet.tagId}` : `${window.location.origin}/scan/?tag=${encodeURIComponent(pet.tagId)}`, [pet.tagId]);
  const readOnlyUrl = `/pet/?tag=${encodeURIComponent(pet.tagId)}`;

  function patchAccount(next: Partial<AccountProfile>) { setState({ ...state, account: { ...account, ...next } }); }
  function patchPet(next: Partial<PetProfile>) { setState({ ...state, pet: { ...pet, ...next } }); }
  function patchSettings(next: Partial<typeof state.settings>) { setState({ ...state, settings: { ...state.settings, ...next } }); }
  function awardXp(points: number, reason: string) {
    const currentXp = state.goals.currentXp + points;
    const level = Math.max(state.goals.level, Math.floor(currentXp / 250) + 1);
    setState({ ...state, goals: { ...state.goals, currentXp, level } });
    setMessage(`+${points} XP: ${reason}`);
  }

  async function savePetToSupabase() {
    if (!supabase) return setMessage('Supabase is not configured in this build.');
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
      care_notes: `${pet.allergies}\n${pet.medications}`,
    });
    setMessage(error ? error.message : 'Pet profile saved to Supabase.');
  }

  function startWalk() {
    setWalking(true); setWalkSeconds(0); setWalkMiles(0); setWalkPath([{ x: 12, y: 70 }, { x: 20, y: 62 }]);
    setMessage('Walk started. The live route icon now moves and distance accumulates every second.');
  }
  function endWalk() {
    const entry = { id: Date.now(), start: 'Just now', end: 'Ended now', distance: Number(walkMiles.toFixed(2)), duration: Math.max(1, Math.round(walkSeconds / 60)), notes: 'Tracked from live dashboard route.' };
    setState({ ...state, walks: [entry, ...state.walks], goals: { ...state.goals, currentXp: state.goals.currentXp + 50, level: Math.max(state.goals.level, Math.floor((state.goals.currentXp + 50) / 250) + 1) } });
    setWalking(false); setMessage(`Walk saved: ${entry.distance} mi, ${walkSeconds}s. +50 XP.`);
  }
  function addMeal() { setState({ ...state, meals: [{ id: Date.now(), time: '12:00 PM', meal: 'Snack', amount: 'Custom amount', calories: 120, done: false }, ...state.meals] }); }
  function addRecord() { setState({ ...state, records: [{ id: Date.now(), title: 'New record', kind: 'Medical', date: new Date().toISOString().slice(0, 10), notes: 'Editable notes', public: false }, ...state.records] }); }
  function addLostReport(status = 'Open') { setState({ ...state, lostReports: [{ id: Date.now(), status, location: 'New sighting location', note: 'Editable lost/found note', time: 'Now' }, ...state.lostReports] }); }

  const pathPoints = walkPath.map((point) => `${point.x},${point.y}`).join(' ');
  const lastPoint = walkPath[walkPath.length - 1];

  return (
    <main className="appShell proApp">
      <aside className="sidebar">
        <Link className="brandLockup" href="/"><img src="/images/logo/MyPetID-Logo_Resized.jpg" alt="MyPetID logo" /><span>MyPetID</span></Link>
        <nav className="sideNav" aria-label="Dashboard sections">{tabs.map((tab) => <button key={tab} className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)} type="button">{tab}</button>)}</nav>
        <div className={`tierBadge ${state.tier === 'admin' ? 'red' : 'green'}`}><span>{tiers[state.tier].label}</span><strong>{tiers[state.tier].pets} pets • {tiers[state.tier].users} users</strong><small>{tiers[state.tier].scan ? 'Scan tracking unlocked' : 'Scan tracking locked'}</small></div>
      </aside>

      <section className="workspace">
        <header className="appHeader">
          <div><p className="eyebrow">Production command center</p><h1>{pet.name}'s life tracker</h1><p>Edit account, pet, diet, activity, medical records, lost/found reports, goals, public scan controls, and settings from one responsive web app shell.</p></div>
          <div className="petAvatarCard"><img src={pet.photoUrl || '/images/dog/Clyde-Nice.jpg'} alt={pet.name} /><span className="pulseDot" /></div>
        </header>
        {!hasSupabaseConfig && <p className="notice">Demo mode: Supabase public env values are missing from this static build.</p>}
        <AuthPanel />
        <div className="dashboardStatus"><span>{message}</span><button type="button" onClick={() => setState({ ...state, theme: state.theme === 'dark' ? 'light' : 'dark' })}>{state.theme === 'dark' ? 'Light mode' : 'Dark mode'}</button></div>

        {activeTab === 'overview' && <div className="dashboardGrid">
          <section className="panel heroPanel"><div><p className="eyebrow">NFC-ready profile</p><h2>{pet.name}</h2><p>{pet.breed} • {pet.weight} • tag {pet.tagId}</p><div className="actions"><Link className="button primary" href={`/scan/?tag=${encodeURIComponent(pet.tagId)}`}>Open scan gate</Link><Link className="button" href={readOnlyUrl}>Public profile</Link><button type="button" onClick={savePetToSupabase}>Save pet to Supabase</button></div></div><QRCodeSVG value={publicUrl} size={160} bgColor="transparent" fgColor="currentColor" /></section>
          <section className="panel stat"><p>Weekly walks</p><strong>{weeklyDone.toFixed(1)} mi</strong><div className="progress"><span style={{ width: `${weeklyProgress}%` }} /></div><span>{weeklyProgress}% of {state.goals.weeklyMiles} mi</span></section>
          <section className="panel stat"><p>Care level</p><strong>Lv {state.goals.level}</strong><span>{state.goals.currentXp} XP</span></section>
          <section className="panel stat"><p>Meals today</p><strong>{state.meals.filter((meal) => meal.done).length}/{state.goals.mealsPerDay}</strong><span>diet tracker</span></section>
          <section className="panel wide"><h2>Live activity map</h2><div className="liveMap"><svg viewBox="0 0 100 100" aria-label="Live route"><polyline points={pathPoints} /><circle cx={lastPoint.x} cy={lastPoint.y} r="4" /><text x={lastPoint.x + 4} y={lastPoint.y - 4}>🐾</text></svg></div><div className="actions">{walking ? <button className="primary" type="button" onClick={endWalk}>End walk</button> : <button className="primary" type="button" onClick={startWalk}>Start walk</button>}<span>{walkMiles.toFixed(2)} mi • {walkSeconds}s</span></div></section>
        </div>}

        {activeTab === 'account' && <div className="dashboardGrid"><section className="panel wide"><h2>Account information</h2><div className="grid2"><Field label="Username" value={account.username} onChange={(v) => patchAccount({ username: v })} /><Field label="Display name" value={account.displayName} onChange={(v) => patchAccount({ displayName: v })} /><Field label="Email" type="email" value={account.email} onChange={(v) => patchAccount({ email: v })} /><Field label="Phone" value={account.phone} onChange={(v) => patchAccount({ phone: v })} /><Field label="Profile picture URL" value={account.avatarUrl} onChange={(v) => patchAccount({ avatarUrl: v })} /><Field label="Emergency contact" value={account.emergencyContact} onChange={(v) => patchAccount({ emergencyContact: v })} /></div><TextArea label="Private address" value={account.address} onChange={(v) => patchAccount({ address: v })} /><button className="primary" type="button" onClick={() => setMessage('Account edits saved locally. Supabase profile write is the next backend pass.')}>Save account</button></section><section className="panel"><img className="profilePreview" src={account.avatarUrl} alt={account.displayName} /><h3>{account.displayName}</h3><p>@{account.username}</p><p>{account.passwordLabel}</p><button type="button" onClick={() => setMessage('Password resets should use Supabase Auth reset email; no password is stored in the static app.')}>Send password reset</button></section></div>}

        {activeTab === 'pets' && <div className="dashboardGrid"><section className="panel wide"><h2>Editable pet profile</h2><div className="grid2"><Field label="Name" value={pet.name} onChange={(v) => patchPet({ name: v })} /><Field label="Tag ID" value={pet.tagId} onChange={(v) => patchPet({ tagId: v })} /><Field label="Species" value={pet.species} onChange={(v) => patchPet({ species: v })} /><Field label="Breed" value={pet.breed} onChange={(v) => patchPet({ breed: v })} /><Field label="Birthday" type="date" value={pet.birthday} onChange={(v) => patchPet({ birthday: v })} /><Field label="Weight" value={pet.weight} onChange={(v) => patchPet({ weight: v })} /><Field label="Color / markings" value={pet.color} onChange={(v) => patchPet({ color: v })} /><Field label="Microchip" value={pet.microchip} onChange={(v) => patchPet({ microchip: v })} /><Field label="Vet" value={pet.vet} onChange={(v) => patchPet({ vet: v })} /><Field label="Photo URL" value={pet.photoUrl} onChange={(v) => patchPet({ photoUrl: v })} /></div><TextArea label="Public behavior notes" value={pet.behaviorNotes} onChange={(v) => patchPet({ behaviorNotes: v })} /><button className="primary" type="button" onClick={savePetToSupabase}>Save pet profile</button></section></div>}

        {activeTab === 'walks' && <div className="dashboardGrid"><section className="panel wide"><h2>Walk and distance tracker</h2><div className="liveMap"><svg viewBox="0 0 100 100"><polyline points={pathPoints} /><circle cx={lastPoint.x} cy={lastPoint.y} r="4" /><text x={lastPoint.x + 4} y={lastPoint.y - 4}>🐕‍🦺</text></svg></div><div className="actions">{walking ? <button className="primary" type="button" onClick={endWalk}>End walk</button> : <button className="primary" type="button" onClick={startWalk}>Start walk</button>}<button type="button" onClick={() => setState({ ...state, goals: { ...state.goals, weeklyMiles: state.goals.weeklyMiles + 1 } })}>Raise weekly goal</button><span>{walkMiles.toFixed(2)} mi live</span></div></section>{state.walks.map((walk) => <section className="panel" key={walk.id}><h3>{walk.distance} mi</h3><p>{walk.start} → {walk.end}</p><p>{walk.duration} min • {walk.notes}</p></section>)}</div>}

        {activeTab === 'diet' && <div className="dashboardGrid"><section className="panel wide"><h2>Diet and meal tracker</h2><TextArea label="Feeding plan" value={pet.feeding} onChange={(v) => patchPet({ feeding: v })} /><Field label="Favorite treats" value={pet.favoriteTreats} onChange={(v) => patchPet({ favoriteTreats: v })} /><button className="primary" type="button" onClick={addMeal}>Add meal/snack</button></section>{state.meals.map((meal) => <section className="panel" key={meal.id}><label className="toggleRow"><input type="checkbox" checked={meal.done} onChange={(event) => setState({ ...state, meals: state.meals.map((item) => item.id === meal.id ? { ...item, done: event.target.checked } : item) })} /> Complete</label><Field label="Time" value={meal.time} onChange={(v) => setState({ ...state, meals: state.meals.map((item) => item.id === meal.id ? { ...item, time: v } : item) })} /><Field label="Meal" value={meal.meal} onChange={(v) => setState({ ...state, meals: state.meals.map((item) => item.id === meal.id ? { ...item, meal: v } : item) })} /><Field label="Amount" value={meal.amount} onChange={(v) => setState({ ...state, meals: state.meals.map((item) => item.id === meal.id ? { ...item, amount: v } : item) })} /></section>)}</div>}

        {activeTab === 'medical' && <div className="dashboardGrid"><section className="panel wide"><h2>Medical and record keeper</h2><TextArea label="Allergies" value={pet.allergies} onChange={(v) => patchPet({ allergies: v })} /><TextArea label="Medications" value={pet.medications} onChange={(v) => patchPet({ medications: v })} /><button className="primary" type="button" onClick={addRecord}>Add record</button></section>{state.records.map((record) => <section className="panel" key={record.id}><Field label="Title" value={record.title} onChange={(v) => setState({ ...state, records: state.records.map((item) => item.id === record.id ? { ...item, title: v } : item) })} /><Field label="Kind" value={record.kind} onChange={(v) => setState({ ...state, records: state.records.map((item) => item.id === record.id ? { ...item, kind: v } : item) })} /><Field label="Date" type="date" value={record.date} onChange={(v) => setState({ ...state, records: state.records.map((item) => item.id === record.id ? { ...item, date: v } : item) })} /><TextArea label="Notes" value={record.notes} onChange={(v) => setState({ ...state, records: state.records.map((item) => item.id === record.id ? { ...item, notes: v } : item) })} /><label className="toggleRow"><input type="checkbox" checked={record.public} onChange={(event) => setState({ ...state, records: state.records.map((item) => item.id === record.id ? { ...item, public: event.target.checked } : item) })} /> Public-safe</label></section>)}</div>}

        {activeTab === 'lost' && <div className="dashboardGrid"><section className="panel wide"><h2>Lost/found notification center</h2><p>Flip lost mode, stage finder reports, and keep owner-approved public return-home information together.</p><div className="actions"><button className="primary" type="button" onClick={() => addLostReport('Open')}>Create lost report</button><button type="button" onClick={() => { patchSettings({ shareLastScan: true }); setMessage('Last scan sharing enabled for lost/found mode.'); }}>Share last scan</button></div></section>{state.lostReports.map((report) => <section className="panel" key={report.id}><Field label="Status" value={report.status} onChange={(v) => setState({ ...state, lostReports: state.lostReports.map((item) => item.id === report.id ? { ...item, status: v } : item) })} /><Field label="Location" value={report.location} onChange={(v) => setState({ ...state, lostReports: state.lostReports.map((item) => item.id === report.id ? { ...item, location: v } : item) })} /><TextArea label="Note" value={report.note} onChange={(v) => setState({ ...state, lostReports: state.lostReports.map((item) => item.id === report.id ? { ...item, note: v } : item) })} /><p>{report.time}</p></section>)}</div>}

        {activeTab === 'goals' && <div className="dashboardGrid"><section className="panel wide"><h2>Goals, levels, and completion loops</h2><div className="grid2"><Field label="Weekly walk distance" type="number" value={String(state.goals.weeklyMiles)} onChange={(v) => setState({ ...state, goals: { ...state.goals, weeklyMiles: Number(v) || 0 } })} /><Field label="Meals per day" type="number" value={String(state.goals.mealsPerDay)} onChange={(v) => setState({ ...state, goals: { ...state.goals, mealsPerDay: Number(v) || 0 } })} /><Field label="Weekly care tasks" type="number" value={String(state.goals.careTasks)} onChange={(v) => setState({ ...state, goals: { ...state.goals, careTasks: Number(v) || 0 } })} /></div><div className="levelBadge">Level {state.goals.level}<div className="progress"><span style={{ width: `${state.goals.currentXp % 250 / 2.5}%` }} /></div>{state.goals.currentXp} XP</div><div className="actions"><button type="button" onClick={() => awardXp(20, 'care task completed')}>Complete care task</button><button type="button" onClick={() => awardXp(35, 'goal streak completed')}>Complete streak</button></div></section></div>}

        {activeTab === 'settings' && <div className="dashboardGrid"><section className="panel wide"><h2>Settings and privacy</h2>{Object.entries(state.settings).map(([key, value]) => typeof value === 'boolean' ? <label className="toggleRow" key={key}><input type="checkbox" checked={value} onChange={(event) => patchSettings({ [key]: event.target.checked } as Partial<typeof state.settings>)} /> {key}</label> : null)}<div className="grid2"><label>Units<select value={state.settings.units} onChange={(event) => patchSettings({ units: event.target.value })}><option value="miles">Miles</option><option value="kilometers">Kilometers</option></select></label><label>Privacy mode<select value={state.settings.privacyMode} onChange={(event) => patchSettings({ privacyMode: event.target.value })}><option value="strict">Strict</option><option value="balanced">Balanced</option><option value="open">Open during lost mode</option></select></label></div></section><section className="panel"><h3>Scan URLs</h3><p>NFC/QR:</p><code>{publicUrl}</code><p>Read-only:</p><code>{readOnlyUrl}</code></section></div>}

        {activeTab === 'admin' && <div className="dashboardGrid"><section className="panel wide"><h2>Admin console</h2><p>Admin bypass, tag creation, Patreon sync, user invites, and audit controls are shown here. Secret operations still need Supabase Edge Functions before production.</p><div className="adminActions"><button className="primary" type="button" onClick={() => { patchPet({ tagId: `tag-${Math.random().toString(36).slice(2, 8)}` }); setMessage('New tag code generated locally. Production should mint this server-side.'); }}>Generate tag ID</button><button type="button" onClick={() => setMessage('Invite staged. Supabase server invite is required for production email delivery.')}>Invite user</button><button type="button" onClick={() => setMessage('Patreon sync requires client secret/creator token on an Edge Function, not in browser.')}>Sync Patreon</button><button type="button" onClick={() => setState(defaultState)}>Reset demo data</button></div></section></div>}
      </section>
    </main>
  );
}
