'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { apiFetch, bearer } from '../lib/api-client';
import { Activity, Bell, Check, FileText, Lock, MapPinned, PawPrint, ShieldCheck, Sparkles, User, Users } from './icons';
import styles from './admin-support.module.css';

// ---------- Types ----------

type Json = Record<string, unknown>;
type Tier = 'free' | 'basic' | 'silver' | 'gold' | 'diamond' | 'admin';
const TIERS: Tier[] = ['free', 'basic', 'silver', 'gold', 'diamond', 'admin'];

export const STATUS_TAGS = ['Canine', 'Service', 'Emotional support', 'Therapy', 'Medical alert', 'Rescue', 'Senior', 'Deaf', 'Blind', 'Reactive', 'In training'] as const;

type AccountRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  tier: string | null;
  is_admin: boolean | null;
  verified: boolean | null;
  pets: number | null;
  guest: boolean | null;
  created_at: string | null;
  last_sign_in_at: string | null;
};

type SheetProfile = {
  id: string;
  email: string | null;
  display_name: string | null;
  phone: string | null;
  tier: string | null;
  is_admin: boolean | null;
  verified: boolean | null;
  details: Json | null;
  public_contact: Json | null;
  pack_code: string | null;
  email_verified_at: string | null;
  created_at?: string | null;
};

type SheetAuth = {
  created_at: string | null;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  providers: string[] | null;
  banned_until: string | null;
};

type SheetPet = {
  id: string;
  name: string | null;
  breed: string | null;
  species?: string | null;
  photo_url: string | null;
  medical_public: string | null;
  behavior_public: string | null;
  contact_public: Json | null;
  lost_mode: boolean | null;
  public_fields: string[] | null;
  profile: Json | null;
  created_at?: string | null;
};

type SheetTag = { tag_code: string; status: string | null; pet_id: string | null; claimed_at: string | null; nfc_uid: string | null };
type SheetActivity = { event_time: string | null; action: string | null; target_table: string | null; changed_fields: string[] | Json | null; actor_email: string | null };

type AccountSheet = {
  profile: SheetProfile;
  auth: SheetAuth | null;
  pets: SheetPet[];
  tags: SheetTag[];
  scans: Json[];
  grants: Json[];
  walks: unknown;
  pins: unknown;
  friends: unknown;
  activity: SheetActivity[];
};

type EmailAction = 'verification' | 'password_reset' | 'magic_link';
type Flash = { tone: 'ok' | 'error'; text: string } | null;

// ---------- Helpers ----------

const MISSING_RPC = 'Admin tools switch on after the latest database update.';

export function friendlyRpcError(error: { message?: string; code?: string } | null | undefined, fallback = 'Something went wrong.') {
  if (!error) return fallback;
  const message = error.message || '';
  if (error.code === 'PGRST202' || error.code === '42883' || /could not find the function|function .* does not exist|schema cache/i.test(message)) return MISSING_RPC;
  if (error.code === '42501' || /admin (access )?required|not authorized|permission denied/i.test(message)) return 'Admin access is required for this. Sign in with an admin account.';
  if (/failed to fetch|network/i.test(message)) return 'Could not reach the server. Check your connection and try again.';
  return message || fallback;
}

function isJson(value: unknown): value is Json {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function str(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function pick(source: Json | null | undefined, ...keys: string[]): string {
  if (!source) return '';
  for (const key of keys) {
    const value = str(source[key]).trim();
    if (value) return value;
  }
  return '';
}

function countOf(value: unknown): number {
  if (typeof value === 'number') return value;
  if (Array.isArray(value)) return value.length;
  if (isJson(value) && typeof value.count === 'number') return value.count;
  return 0;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function when(value: string | null | undefined, withTime = true) {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return withTime
    ? date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function relative(value: string | null | undefined) {
  if (!value) return 'never signed in';
  const ms = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(ms)) return value;
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 60) return `${days}d ago`;
  return when(value, false);
}

function titleCase(value: string | null | undefined) {
  const text = (value || '').trim();
  return text ? text[0].toUpperCase() + text.slice(1) : '';
}

async function accessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
}

function normalizeSheet(raw: unknown): AccountSheet | null {
  if (!isJson(raw) || !isJson(raw.profile)) return null;
  return {
    profile: raw.profile as unknown as SheetProfile,
    auth: isJson(raw.auth) ? (raw.auth as unknown as SheetAuth) : null,
    pets: asArray<SheetPet>(raw.pets),
    tags: asArray<SheetTag>(raw.tags),
    scans: asArray<Json>(raw.scans),
    grants: asArray<Json>(raw.grants),
    walks: raw.walks,
    pins: raw.pins,
    friends: raw.friends,
    activity: asArray<SheetActivity>(raw.activity),
  };
}

// Address lives in profile.details.address {line1,line2,city,state,postal_code}
// (same shape as order shipping), with flat-key fallbacks for older rows.
type ProfileForm = { display_name: string; phone: string; line1: string; line2: string; city: string; state: string; zip: string; card_phone: string };

function profileFormFrom(profile: SheetProfile): ProfileForm {
  const details = isJson(profile.details) ? profile.details : {};
  const address = isJson(details.address) ? details.address : {};
  return {
    display_name: profile.display_name || '',
    phone: profile.phone || '',
    line1: pick(address, 'line1') || pick(details, 'address_line1', 'address1'),
    line2: pick(address, 'line2') || pick(details, 'address_line2', 'address2'),
    city: pick(address, 'city') || pick(details, 'city'),
    state: pick(address, 'state') || pick(details, 'state'),
    zip: pick(address, 'postal_code', 'zip') || pick(details, 'zip', 'postal_code'),
    card_phone: pick(details, 'card_phone', 'cardPhone'),
  };
}

function ownerAddressLines(profile: SheetProfile): string[] {
  const f = profileFormFrom(profile);
  const cityLine = [f.city, [f.state, f.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return [f.line1, f.line2, cityLine].filter(Boolean);
}

function petStatusTags(pet: SheetPet): string[] {
  return stringArray(isJson(pet.profile) ? pet.profile.status_tags : null);
}

function petTagCode(pet: SheetPet, tags: SheetTag[]) {
  const tag = tags.find((item) => item.pet_id === pet.id && item.status !== 'unclaimed') || tags.find((item) => item.pet_id === pet.id);
  return tag?.tag_code || pick(pet.profile, 'tag_code', 'tagId');
}

function cardFields(pet: SheetPet, profile: SheetProfile, tags: SheetTag[]) {
  const p = isJson(pet.profile) ? pet.profile : {};
  const card = isJson(p.card) ? p.card : {};
  const details = isJson(p.details) ? p.details : {};
  const look = (...keys: string[]) => pick(card, ...keys) || pick(p, ...keys) || pick(details, ...keys);
  const form = profileFormFrom(profile);
  const restrictions = look('restrictions', 'restriction');
  const restrictionList = stringArray(card.restrictions).length ? stringArray(card.restrictions) : stringArray(p.restrictions);
  return {
    petName: pet.name || '',
    fullName: pick(card, 'full_name', 'fullName') || look('full_name', 'signature') || pet.name || '',
    breed: pet.breed || look('breed'),
    sex: look('sex', 'gender'),
    dob: look('dob', 'birthday', 'birth_date', 'birthdate'),
    height: look('height'),
    weight: look('weight'),
    eyes: look('eyes', 'eye_color', 'eyeColor'),
    address: ownerAddressLines(profile).join(', '),
    phone: form.card_phone || pick(card, 'phone') || profile.phone || pick(profile.public_contact, 'phone'),
    tagCode: petTagCode(pet, tags),
    statusTags: petStatusTags(pet).join(', '),
    restrictions: restrictions || restrictionList.join(', '),
  };
}

function cardText(pet: SheetPet, profile: SheetProfile, tags: SheetTag[]) {
  const f = cardFields(pet, profile, tags);
  const rows: [string, string][] = [
    ['Pet name', f.petName], ['Full name / signature', f.fullName], ['Breed', f.breed], ['Sex', f.sex], ['DOB', f.dob],
    ['Height', f.height], ['Weight', f.weight], ['Eyes', f.eyes], ['Owner address', f.address], ['Phone', f.phone],
    ['Tag code', f.tagCode], ['Status', f.statusTags], ['Restrictions', f.restrictions],
  ];
  return ['MyPetID card info', ...rows.map(([label, value]) => `${label}: ${value || '-'}`), `Owner: ${profile.display_name || ''} <${profile.email || ''}>`].join('\n');
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

function Badge({ tone, children }: { tone?: 'green' | 'blue' | 'red' | 'violet'; children: ReactNode }) {
  const toneClass = tone === 'green' ? styles.badgeGreen : tone === 'blue' ? styles.badgeBlue : tone === 'red' ? styles.badgeRed : tone === 'violet' ? styles.badgeViolet : '';
  return <span className={`${styles.badge} ${toneClass}`}>{children}</span>;
}

function TierBadge({ tier }: { tier: string | null | undefined }) {
  const value = tier || 'free';
  const tone = value === 'admin' ? 'red' : value === 'diamond' || value === 'gold' ? 'violet' : value === 'free' ? undefined : 'blue';
  return <Badge tone={tone}>{value}</Badge>;
}

// ---------- Main component ----------

export function AdminSupport() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AccountRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<AccountSheet | null>(null);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetError, setSheetError] = useState('');
  const [flash, setFlash] = useState<Flash>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const searchSeq = useRef(0);
  const sheetSeq = useRef(0);
  const printRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(null), flash.tone === 'ok' ? 3500 : 7000);
    return () => window.clearTimeout(timer);
  }, [flash]);

  const runSearch = useCallback(async (text: string) => {
    const seq = ++searchSeq.current;
    if (!supabase) { setSearchError('Supabase is not configured on this site.'); return; }
    setSearching(true);
    setSearchError('');
    const { data, error } = await supabase.rpc('admin_search_accounts', { p_query: text.trim() });
    if (seq !== searchSeq.current) return;
    setSearching(false);
    if (error) { setSearchError(friendlyRpcError(error, 'Search failed.')); setResults([]); return; }
    setResults(asArray<AccountRow>(data));
  }, []);

  // Debounced search; an empty query lists recent accounts.
  useEffect(() => {
    const timer = window.setTimeout(() => { void runSearch(query); }, query ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [query, runSearch]);

  const loadSheet = useCallback(async (profileId: string, quiet = false) => {
    const seq = ++sheetSeq.current;
    if (!supabase) return;
    if (!quiet) { setSheetLoading(true); setSheet(null); }
    setSheetError('');
    const { data, error } = await supabase.rpc('admin_account_sheet', { p_profile: profileId });
    if (seq !== sheetSeq.current) return;
    setSheetLoading(false);
    if (error) { setSheetError(friendlyRpcError(error, 'Could not load this account.')); return; }
    const normalized = normalizeSheet(data);
    if (!normalized) { setSheetError('This account could not be found.'); return; }
    setSheet(normalized);
  }, []);

  function openAccount(id: string) {
    setSelectedId(id);
    void loadSheet(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function closeAccount() {
    sheetSeq.current += 1;
    setSelectedId(null);
    setSheet(null);
    setSheetError('');
  }

  // Patch the profile, refresh the sheet and the matching search row.
  const updateProfile = useCallback(async (patch: Json, label: string, doneText: string) => {
    if (!supabase || !selectedId) return false;
    setBusy(label);
    const { error } = await supabase.rpc('admin_update_profile', { p_profile: selectedId, p_patch: patch });
    setBusy(null);
    if (error) { setFlash({ tone: 'error', text: friendlyRpcError(error, 'Update failed.') }); return false; }
    setFlash({ tone: 'ok', text: doneText });
    setResults((rows) => rows.map((row) => (row.id === selectedId ? { ...row, ...(patch as Partial<AccountRow>) } : row)));
    await loadSheet(selectedId, true);
    return true;
  }, [selectedId, loadSheet]);

  const updatePet = useCallback(async (petId: string, patch: Json, doneText: string) => {
    if (!supabase || !selectedId) return false;
    setBusy(`pet:${petId}`);
    const { error } = await supabase.rpc('admin_update_pet', { p_pet: petId, p_patch: patch });
    setBusy(null);
    if (error) { setFlash({ tone: 'error', text: friendlyRpcError(error, 'Pet update failed.') }); return false; }
    setFlash({ tone: 'ok', text: doneText });
    await loadSheet(selectedId, true);
    return true;
  }, [selectedId, loadSheet]);

  async function sendAccountEmail(action: EmailAction) {
    if (!selectedId) return;
    const token = await accessToken();
    if (!token) { setFlash({ tone: 'error', text: 'Your admin session expired. Sign in again.' }); return; }
    setBusy(`email:${action}`);
    const response = await apiFetch('/api/admin/account-email/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: bearer(token) },
      body: JSON.stringify({ profileId: selectedId, action }),
    });
    const body: unknown = await response.json();
    setBusy(null);
    const record = isJson(body) ? body : {};
    const message = str(record.message) || str(record.error);
    if (!response.ok || record.ok === false) setFlash({ tone: 'error', text: message || 'Email could not be sent.' });
    else setFlash({ tone: 'ok', text: message || 'Email sent.' });
  }

  function printSheet() {
    const node = printRef.current;
    if (!node) return;
    // Hide every other top-level element while the browser prints, then restore.
    const hidden: { el: HTMLElement; display: string }[] = [];
    Array.from(document.body.children).forEach((child) => {
      if (child instanceof HTMLElement && child !== node && !child.contains(node)) {
        hidden.push({ el: child, display: child.style.display });
        child.style.display = 'none';
      }
    });
    const restore = () => {
      hidden.forEach(({ el, display }) => { el.style.display = display; });
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);
    window.print();
    window.setTimeout(() => { if (hidden.some(({ el }) => el.style.display === 'none')) restore(); }, 60_000);
  }

  const selectedRow = results.find((row) => row.id === selectedId) || null;

  return (
    <div className={styles.desk}>
      {flash && <p className={`authMessage ${styles.toast}`} role="status" aria-live="polite">{flash.tone === 'ok' ? '✓ ' : ''}{flash.text}</p>}

      {!selectedId && (
        <section className="panel wide">
          <div className="panelTitleRow">
            <div>
              <p className="eyebrow"><Users /> Support desk</p>
              <h2>Find an account</h2>
            </div>
            <span className="iconBubble green"><User /></span>
          </div>
          <label className={styles.searchLabel}>
            <span className="formHint">Email, name, phone, pet name, or tag code</span>
            <div className={styles.searchRow}>
              <input
                type="search"
                inputMode="search"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="Search accounts"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search">Clear</button>}
            </div>
          </label>
          {searchError && <p className="notice">{searchError}</p>}
          {searching && !results.length && <p className="mutedLine">Searching…</p>}
          {!searching && !searchError && !results.length && <p className="mutedLine">No accounts match{query ? ` “${query}”` : ' yet'}.</p>}
          {results.length > 0 && (
            <ul className={styles.results} aria-busy={searching}>
              {results.map((row) => (
                <li key={row.id}>
                  <button type="button" className={styles.resultButton} onClick={() => openAccount(row.id)}>
                    <span className={styles.resultAvatar}>{row.guest ? <PawPrint /> : (row.display_name || row.email || '?').trim().charAt(0).toUpperCase()}</span>
                    <span className={styles.resultMain}>
                      <span className={styles.resultTitle}>
                        {row.display_name || (row.guest ? 'Guest pet' : 'No name')}
                        <TierBadge tier={row.tier} />
                        {row.verified && <Badge tone="green"><Check /> Verified</Badge>}
                        {row.is_admin && <Badge tone="red"><Lock /> Admin</Badge>}
                        {row.guest && <Badge>Guest</Badge>}
                      </span>
                      <span className={styles.resultEmail}>{row.email || 'No email'}</span>
                      <span className={styles.resultMeta}>{row.pets || 0} pet{row.pets === 1 ? '' : 's'} · {relative(row.last_sign_in_at)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {selectedId && (
        <>
          <button type="button" className={`ghost ${styles.backButton}`} onClick={closeAccount}>← Back to results</button>
          {sheetLoading && <section className="panel wide"><p className="mutedLine">Loading {selectedRow?.email || 'account'}…</p></section>}
          {sheetError && (
            <section className="panel wide">
              <p className="notice">{sheetError}</p>
              <div className="actions"><button type="button" onClick={() => void loadSheet(selectedId)}>Try again</button></div>
            </section>
          )}
          {sheet && (
            <AccountSheetView
              sheet={sheet}
              busy={busy}
              onUpdateProfile={updateProfile}
              onUpdatePet={updatePet}
              onEmail={sendAccountEmail}
              onPrint={printSheet}
              onRefresh={() => void loadSheet(selectedId, true)}
              onCopied={(ok) => setFlash(ok ? { tone: 'ok', text: 'Card info copied.' } : { tone: 'error', text: 'Copy failed. Long-press to select the text instead.' })}
            />
          )}
        </>
      )}

      {mounted && sheet && createPortal(
        <div ref={printRef} className={styles.printOnly} aria-hidden="true"><PrintableSheet sheet={sheet} /></div>,
        document.body,
      )}
    </div>
  );
}

// ---------- Account sheet ----------

type SheetViewProps = {
  sheet: AccountSheet;
  busy: string | null;
  onUpdateProfile: (patch: Json, label: string, doneText: string) => Promise<boolean>;
  onUpdatePet: (petId: string, patch: Json, doneText: string) => Promise<boolean>;
  onEmail: (action: EmailAction) => Promise<void>;
  onPrint: () => void;
  onRefresh: () => void;
  onCopied: (ok: boolean) => void;
};

function AccountSheetView({ sheet, busy, onUpdateProfile, onUpdatePet, onEmail, onPrint, onRefresh, onCopied }: SheetViewProps) {
  const { profile, auth } = sheet;
  const verified = Boolean(profile.verified);
  const isAdmin = Boolean(profile.is_admin);
  const [form, setForm] = useState<ProfileForm>(() => profileFormFrom(profile));
  const [dirty, setDirty] = useState(false);

  // Re-seed the form whenever a fresh copy of the profile arrives and the admin
  // has no unsaved edits.
  useEffect(() => {
    if (!dirty) setForm(profileFormFrom(profile));
  }, [profile, dirty]);

  function field<K extends keyof ProfileForm>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    setDirty(true);
  }

  async function saveProfile() {
    const state = form.state.trim().toUpperCase();
    if (state && !/^[A-Z]{2}$/.test(state)) return;
    const details = isJson(profile.details) ? { ...profile.details } : {};
    const address = isJson(details.address) ? { ...details.address } : {};
    const nextDetails: Json = {
      ...details,
      address: { ...address, line1: form.line1.trim(), line2: form.line2.trim(), city: form.city.trim(), state, postal_code: form.zip.trim() },
      card_phone: form.card_phone.trim(),
    };
    const ok = await onUpdateProfile({ display_name: form.display_name.trim(), phone: form.phone.trim(), details: nextDetails }, 'profile', 'Profile saved.');
    if (ok) setDirty(false);
  }

  function toggleAdmin() {
    const next = !isAdmin;
    const who = profile.email || profile.display_name || 'this account';
    if (!window.confirm(next ? `Give ${who} full admin access?` : `Remove admin access from ${who}?`)) return;
    void onUpdateProfile({ is_admin: next }, 'admin', next ? 'Admin access granted.' : 'Admin access removed.');
  }

  const stateInvalid = Boolean(form.state.trim()) && !/^[A-Za-z]{2}$/.test(form.state.trim());
  const canEmail = Boolean(profile.email);
  const banned = auth?.banned_until && new Date(auth.banned_until).getTime() > Date.now();

  return (
    <>
      <section className="panel wide">
        <div className={styles.sheetHeader}>
          <span className={`iconBubble ${isAdmin ? 'red' : verified ? 'green' : 'blue'}`}>{isAdmin ? <Lock /> : <User />}</span>
          <div className={styles.sheetHeaderMain}>
            <h2>{profile.display_name || 'No name'}</h2>
            <span className="mutedLine" style={{ overflowWrap: 'anywhere' }}>{profile.email || 'No email on file'}</span>
            <div className={styles.badgeRow}>
              <TierBadge tier={profile.tier} />
              {verified ? <Badge tone="green"><Check /> Verified</Badge> : <Badge>Unverified</Badge>}
              {isAdmin && <Badge tone="red"><Lock /> Admin</Badge>}
              {auth?.email_confirmed_at ? <Badge tone="blue">Email confirmed</Badge> : <Badge>Email not confirmed</Badge>}
              {banned && <Badge tone="red">Banned</Badge>}
            </div>
          </div>
        </div>
        <dl className="infoList">
          <dt>Joined</dt><dd>{when(auth?.created_at || profile.created_at)}</dd>
          <dt>Last sign-in</dt><dd>{when(auth?.last_sign_in_at)} ({relative(auth?.last_sign_in_at)})</dd>
          <dt>Sign-in methods</dt><dd>{(auth?.providers || []).join(', ') || 'Unknown'}</dd>
          {profile.pack_code && <><dt>Pack code</dt><dd className={styles.mono}>{profile.pack_code}</dd></>}
          <dt>Account ID</dt><dd className={styles.mono} style={{ overflowWrap: 'anywhere' }}>{profile.id}</dd>
        </dl>
        <div className={styles.counts} style={{ marginTop: 14 }}>
          <div className={styles.countTile}><strong>{sheet.pets.length}</strong><span>Pets</span></div>
          <div className={styles.countTile}><strong>{sheet.tags.length}</strong><span>Tags</span></div>
          <div className={styles.countTile}><strong>{sheet.scans.length}</strong><span>Scans</span></div>
          <div className={styles.countTile}><strong>{countOf(sheet.walks)}</strong><span>Walks</span></div>
          <div className={styles.countTile}><strong>{countOf(sheet.pins)}</strong><span>Pins</span></div>
          <div className={styles.countTile}><strong>{countOf(sheet.friends)}</strong><span>Friends</span></div>
        </div>
      </section>

      <section className="panel wide">
        <div className={styles.section}>
          <h3><Sparkles /> Quick actions</h3>
          <div className={styles.quickGrid}>
            <button type="button" className={verified ? '' : 'primary'} disabled={busy !== null} onClick={() => void onUpdateProfile({ verified: !verified }, 'verified', verified ? 'Marked unverified.' : 'Marked verified.')}>
              <ShieldCheck /> {verified ? 'Unverify' : 'Mark verified'}
            </button>
            <button type="button" className={isAdmin ? 'dangerButton' : ''} disabled={busy !== null} onClick={toggleAdmin}>
              <Lock /> {isAdmin ? 'Remove admin' : 'Make admin'}
            </button>
            <button type="button" disabled={busy !== null || !canEmail} onClick={() => void onEmail('verification')}>
              <Check /> {busy === 'email:verification' ? 'Sending…' : 'Send verification'}
            </button>
            <button type="button" disabled={busy !== null || !canEmail} onClick={() => void onEmail('password_reset')}>
              <Lock /> {busy === 'email:password_reset' ? 'Sending…' : 'Password reset'}
            </button>
            <button type="button" disabled={busy !== null || !canEmail} onClick={() => void onEmail('magic_link')}>
              <Bell /> {busy === 'email:magic_link' ? 'Sending…' : 'Sign-in link'}
            </button>
            <button type="button" onClick={onPrint}><FileText /> Printable info sheet</button>
            <label>
              Change plan
              <select
                value={TIERS.includes((profile.tier || 'free') as Tier) ? profile.tier || 'free' : 'free'}
                disabled={busy !== null}
                onChange={(event) => {
                  const tier = event.target.value as Tier;
                  if (tier === 'admin' && !window.confirm('The admin plan unlocks admin tools. Continue?')) return;
                  void onUpdateProfile({ tier }, 'tier', `Plan changed to ${titleCase(tier)}.`);
                }}
              >
                {TIERS.map((tier) => <option key={tier} value={tier}>{titleCase(tier)}</option>)}
              </select>
            </label>
          </div>
          {!canEmail && <p className="formHint">This account has no email, so emails can’t be sent.</p>}
        </div>
      </section>

      <section className="panel wide">
        <div className={styles.section}>
          <h3><User /> Profile</h3>
          <div className={styles.fieldGrid}>
            <label className={styles.spanAll}>Display name<input value={form.display_name} onChange={(e) => field('display_name', e.target.value)} autoComplete="off" /></label>
            <label>Phone<input type="tel" inputMode="tel" value={form.phone} onChange={(e) => field('phone', e.target.value)} autoComplete="off" /></label>
            <label>Card phone<input type="tel" inputMode="tel" value={form.card_phone} onChange={(e) => field('card_phone', e.target.value)} autoComplete="off" placeholder="Shown on the ID card" /></label>
            <label className={styles.spanAll}>Address line 1<input value={form.line1} onChange={(e) => field('line1', e.target.value)} autoComplete="off" /></label>
            <label className={styles.spanAll}>Address line 2<input value={form.line2} onChange={(e) => field('line2', e.target.value)} autoComplete="off" /></label>
            <label>City<input value={form.city} onChange={(e) => field('city', e.target.value)} autoComplete="off" /></label>
            <div className="grid2" style={{ gap: 12 }}>
              <label>State<input value={form.state} maxLength={2} onChange={(e) => field('state', e.target.value.toUpperCase())} autoComplete="off" autoCapitalize="characters" aria-invalid={stateInvalid} placeholder="TX" /></label>
              <label>ZIP<input value={form.zip} inputMode="numeric" maxLength={10} onChange={(e) => field('zip', e.target.value)} autoComplete="off" /></label>
            </div>
          </div>
          {stateInvalid && <p className="formHint" style={{ color: 'var(--danger)' }}>State should be a 2-letter code like TX.</p>}
          {dirty && (
            <div className={styles.stickyActions}>
              <button type="button" onClick={() => { setForm(profileFormFrom(profile)); setDirty(false); }}>Undo</button>
              <button type="button" className="primary" disabled={busy !== null || stateInvalid} onClick={() => void saveProfile()}>{busy === 'profile' ? 'Saving…' : 'Save profile'}</button>
            </div>
          )}
        </div>
      </section>

      <section className="panel wide">
        <div className={styles.section}>
          <h3><PawPrint /> Pets ({sheet.pets.length})</h3>
          {sheet.pets.length === 0 && <p className="mutedLine">No pets on this account.</p>}
          <div style={{ display: 'grid', gap: 10 }}>
            {sheet.pets.map((pet) => (
              <PetEditor key={pet.id} pet={pet} profile={profile} tags={sheet.tags} busy={busy} onSave={onUpdatePet} onCopied={onCopied} />
            ))}
          </div>
        </div>
      </section>

      <section className="panel wide">
        <div className={styles.section}>
          <h3><ShieldCheck /> Tags ({sheet.tags.length})</h3>
          {sheet.tags.length === 0 ? <p className="mutedLine">No tags claimed.</p> : (
            <ul className={styles.list}>
              {sheet.tags.map((tag) => (
                <li key={tag.tag_code}>
                  <span><strong className={styles.mono}>{tag.tag_code}</strong> · {tag.status || 'unknown'}</span>
                  <small>
                    {tag.pet_id ? `Pet: ${sheet.pets.find((pet) => pet.id === tag.pet_id)?.name || tag.pet_id}` : 'Not linked to a pet'}
                    {tag.claimed_at ? ` · claimed ${when(tag.claimed_at, false)}` : ''}
                    {tag.nfc_uid ? ` · NFC ${tag.nfc_uid}` : ''}
                  </small>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="panel wide">
        <div className={styles.section}>
          <h3><MapPinned /> Recent scans ({sheet.scans.length})</h3>
          {sheet.scans.length === 0 ? <p className="mutedLine">No scans yet.</p> : (
            <ul className={styles.list}>
              {sheet.scans.slice(0, 15).map((scan, index) => {
                const at = pick(scan, 'scanned_at', 'created_at', 'event_time');
                const place = pick(scan, 'place_name', 'city', 'location', 'address');
                const lat = scan.lat ?? scan.latitude;
                const lng = scan.lng ?? scan.longitude;
                return (
                  <li key={pick(scan, 'id') || index}>
                    <span>{pick(scan, 'tag_code') || 'Scan'}{pick(scan, 'kind', 'type', 'source') ? ` · ${pick(scan, 'kind', 'type', 'source')}` : ''}{scan.found_report || pick(scan, 'message') ? ' · found report' : ''}</span>
                    <small>{when(at)}{place ? ` · ${place}` : typeof lat === 'number' && typeof lng === 'number' ? ` · ${lat.toFixed(3)}, ${lng.toFixed(3)}` : ''}</small>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {sheet.grants.length > 0 && (
        <section className="panel wide">
          <div className={styles.section}>
            <h3><Sparkles /> Plan grants</h3>
            <ul className={styles.list}>
              {sheet.grants.map((grant, index) => (
                <li key={pick(grant, 'id') || index}>
                  <span>{titleCase(pick(grant, 'tier'))} · {pick(grant, 'status') || 'active'} · {pick(grant, 'source')}</span>
                  <small>{when(pick(grant, 'created_at'), false)}{pick(grant, 'expires_at') ? ` → ${when(pick(grant, 'expires_at'), false)}` : ' · no expiry'}{pick(grant, 'note') ? ` · ${pick(grant, 'note')}` : ''}</small>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="panel wide">
        <div className={styles.section}>
          <div className="panelTitleRow" style={{ marginBottom: 4 }}>
            <h3><Activity /> Activity</h3>
            <button type="button" onClick={onRefresh} disabled={busy !== null}>Refresh</button>
          </div>
          {sheet.activity.length === 0 ? <p className="mutedLine">No recorded activity.</p> : (
            <ol className={styles.timeline}>
              {sheet.activity.slice(0, 40).map((item, index) => {
                const fields = Array.isArray(item.changed_fields) ? item.changed_fields.join(', ') : isJson(item.changed_fields) ? Object.keys(item.changed_fields).join(', ') : '';
                return (
                  <li key={`${item.event_time}-${index}`}>
                    <span><strong>{titleCase(item.action) || 'Change'}</strong>{item.target_table ? ` · ${item.target_table}` : ''}</span>
                    {fields && <small>{fields}</small>}
                    <small>{when(item.event_time)}{item.actor_email ? ` · by ${item.actor_email}` : ''}</small>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </section>
    </>
  );
}

// ---------- Pet editor ----------

type PetForm = { name: string; breed: string; photo_url: string; behavior_public: string; medical_public: string; lost_mode: boolean; status_tags: string[] };

function petFormFrom(pet: SheetPet): PetForm {
  return {
    name: pet.name || '',
    breed: pet.breed || '',
    photo_url: pet.photo_url || '',
    behavior_public: pet.behavior_public || '',
    medical_public: pet.medical_public || '',
    lost_mode: Boolean(pet.lost_mode),
    status_tags: petStatusTags(pet),
  };
}

type PetEditorProps = {
  pet: SheetPet;
  profile: SheetProfile;
  tags: SheetTag[];
  busy: string | null;
  onSave: (petId: string, patch: Json, doneText: string) => Promise<boolean>;
  onCopied: (ok: boolean) => void;
};

function PetEditor({ pet, profile, tags, busy, onSave, onCopied }: PetEditorProps) {
  const [form, setForm] = useState<PetForm>(() => petFormFrom(pet));
  const [dirty, setDirty] = useState(false);
  const saving = busy === `pet:${pet.id}`;

  useEffect(() => {
    if (!dirty) setForm(petFormFrom(pet));
  }, [pet, dirty]);

  function set<K extends keyof PetForm>(key: K, value: PetForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setDirty(true);
  }

  function toggleTag(tag: string) {
    set('status_tags', form.status_tags.includes(tag) ? form.status_tags.filter((item) => item !== tag) : [...form.status_tags, tag]);
  }

  async function save() {
    const baseProfile = isJson(pet.profile) ? pet.profile : {};
    const ok = await onSave(pet.id, {
      name: form.name.trim(),
      breed: form.breed.trim(),
      photo_url: form.photo_url.trim(),
      behavior_public: form.behavior_public,
      medical_public: form.medical_public,
      lost_mode: form.lost_mode,
      profile: { ...baseProfile, status_tags: form.status_tags },
    }, `${form.name.trim() || 'Pet'} saved.`);
    if (ok) setDirty(false);
  }

  const tagCode = petTagCode(pet, tags);
  const photo = /^https?:\/\/|^\//.test(pet.photo_url || '') ? pet.photo_url : null;

  return (
    <details className={styles.petCard}>
      <summary className={styles.petSummary}>
        {photo
          // eslint-disable-next-line @next/next/no-img-element
          ? <img className={styles.petPhoto} src={photo} alt="" loading="lazy" />
          : <span className={styles.petPhoto}><PawPrint /></span>}
        <span className={styles.petSummaryText}>
          <strong>{pet.name || 'Unnamed pet'}</strong>
          <span>{[pet.breed, tagCode].filter(Boolean).join(' · ') || 'No breed or tag yet'}</span>
        </span>
        {pet.lost_mode && <Badge tone="red">Lost</Badge>}
      </summary>
      <div className={styles.petBody}>
        <div className={styles.fieldGrid}>
          <label>Name<input value={form.name} onChange={(e) => set('name', e.target.value)} autoComplete="off" /></label>
          <label>Breed<input value={form.breed} onChange={(e) => set('breed', e.target.value)} autoComplete="off" /></label>
          <label className={styles.spanAll}>Photo URL<input type="url" inputMode="url" value={form.photo_url} onChange={(e) => set('photo_url', e.target.value)} autoComplete="off" autoCapitalize="none" /></label>
          <label className={styles.spanAll}>Behavior notes (public)<textarea value={form.behavior_public} onChange={(e) => set('behavior_public', e.target.value)} /></label>
          <label className={styles.spanAll}>Medical notes (public)<textarea value={form.medical_public} onChange={(e) => set('medical_public', e.target.value)} /></label>
        </div>
        <label className={styles.toggleRow}>
          <span>Lost mode {form.lost_mode && <Badge tone="red">On</Badge>}</span>
          <input type="checkbox" checked={form.lost_mode} onChange={(e) => set('lost_mode', e.target.checked)} />
        </label>
        <div>
          <p className="formHint" style={{ marginBottom: 6 }}>Status tags</p>
          <div className={styles.statusChips}>
            {STATUS_TAGS.map((tag) => {
              const on = form.status_tags.includes(tag);
              return <button key={tag} type="button" aria-pressed={on} className={on ? 'activeMini' : ''} onClick={() => toggleTag(tag)}>{on && <Check />}{tag}</button>;
            })}
          </div>
        </div>
        <div className="actions compact" style={{ marginTop: 8 }}>
          <button type="button" className="primary" disabled={!dirty || busy !== null} onClick={() => void save()}>{saving ? 'Saving…' : 'Save pet'}</button>
          {dirty && <button type="button" onClick={() => { setForm(petFormFrom(pet)); setDirty(false); }}>Undo</button>}
          <button type="button" onClick={() => { void copyText(cardText(pet, profile, tags)).then(onCopied); }}><FileText /> Copy card info</button>
        </div>
      </div>
    </details>
  );
}

// ---------- Printable sheet ----------

function PrintRow({ label, value }: { label: string; value: string | null | undefined }) {
  return <tr><th>{label}</th><td>{value || '-'}</td></tr>;
}

function PrintableSheet({ sheet }: { sheet: AccountSheet }) {
  const { profile, auth } = sheet;
  const address = useMemo(() => ownerAddressLines(profile).join(', '), [profile]);
  const form = profileFormFrom(profile);
  return (
    <article>
      <h1>MyPetID account sheet</h1>
      <p className={styles.printMeta}>Printed {new Date().toLocaleString()} · Account {profile.id}</p>
      <h2>Owner</h2>
      <table><tbody>
        <PrintRow label="Name" value={profile.display_name} />
        <PrintRow label="Email" value={profile.email} />
        <PrintRow label="Phone" value={profile.phone} />
        <PrintRow label="Card phone" value={form.card_phone} />
        <PrintRow label="Address" value={address} />
        <PrintRow label="Plan" value={titleCase(profile.tier || 'free')} />
        <PrintRow label="Verified" value={profile.verified ? 'Yes' : 'No'} />
        <PrintRow label="Admin" value={profile.is_admin ? 'Yes' : 'No'} />
        <PrintRow label="Joined" value={when(auth?.created_at || profile.created_at)} />
        <PrintRow label="Last sign-in" value={when(auth?.last_sign_in_at)} />
        <PrintRow label="Walks / pins / friends" value={`${countOf(sheet.walks)} / ${countOf(sheet.pins)} / ${countOf(sheet.friends)}`} />
      </tbody></table>
      {sheet.pets.map((pet) => {
        const f = cardFields(pet, profile, sheet.tags);
        return (
          <section key={pet.id} className={styles.printPet}>
            <h2>{pet.name || 'Pet'}</h2>
            <table><tbody>
              <PrintRow label="Full name / signature" value={f.fullName} />
              <PrintRow label="Breed" value={f.breed} />
              <PrintRow label="Sex" value={f.sex} />
              <PrintRow label="DOB" value={f.dob} />
              <PrintRow label="Height" value={f.height} />
              <PrintRow label="Weight" value={f.weight} />
              <PrintRow label="Eyes" value={f.eyes} />
              <PrintRow label="Tag code" value={f.tagCode} />
              <PrintRow label="Status" value={f.statusTags} />
              <PrintRow label="Restrictions" value={f.restrictions} />
              <PrintRow label="Lost mode" value={pet.lost_mode ? 'ON' : 'Off'} />
              <PrintRow label="Behavior" value={pet.behavior_public} />
              <PrintRow label="Medical" value={pet.medical_public} />
            </tbody></table>
          </section>
        );
      })}
      {sheet.tags.length > 0 && (
        <>
          <h2>Tags</h2>
          <table><tbody>
            {sheet.tags.map((tag) => <PrintRow key={tag.tag_code} label={tag.tag_code} value={`${tag.status || ''}${tag.claimed_at ? ` · claimed ${when(tag.claimed_at, false)}` : ''}`} />)}
          </tbody></table>
        </>
      )}
    </article>
  );
}
