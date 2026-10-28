"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabase';
import { PUBLIC_APP_URL } from '../lib/public-url';
import { statusTag } from '../lib/id-card';
import { isMissingRelation, useOwnerPets } from '../lib/owner-pets';
import { KIND_META, formatClock, formatCountdown, formatDays, parseSchedule, upcoming } from '../lib/care-schedule';
import { StatusScreen } from './status-screen';
import { BoneLoader } from './bone-loader';
import styles from './sitter-link.module.css';

/**
 * Sitter / walker share links. The owner picks how long the link works and what it shows;
 * a random 32-byte token goes in the link and only its sha256 is stored (public.sitter_links).
 * The public page (/sitter/?t=...) calls get_sitter_view, which checks expiry/revocation and
 * returns only the included sections.
 */

export type SitterInclude = { care_schedule: boolean; feeding: boolean; meds: boolean; vet: boolean; behavior: boolean; walk: boolean };
type SitterLinkRow = { id: string; pet_id: string; label: string | null; expires_at: string; include: Partial<SitterInclude>; revoked_at: string | null; created_at: string; last_opened_at: string | null };
type SitterNotes = { feeding_notes: string; walk_notes: string; behavior_notes: string; emergency_name: string; emergency_phone: string };

const INCLUDE_LABELS: [keyof SitterInclude, string][] = [
  ['care_schedule', 'Care schedule (meals, walks, meds times)'],
  ['feeding', 'Feeding plan'],
  ['meds', 'Medications & health notes'],
  ['vet', 'Vet & emergency contacts'],
  ['behavior', 'Behavior notes'],
  ['walk', 'Walk notes'],
];
const ALL_ON: SitterInclude = { care_schedule: true, feeding: true, meds: true, vet: true, behavior: true, walk: true };
const DURATIONS: { key: string; label: string; ms: number }[] = [
  { key: '4h', label: '4 hours', ms: 4 * 3600_000 },
  { key: '1d', label: '1 day', ms: 86_400_000 },
  { key: '3d', label: '3 days', ms: 3 * 86_400_000 },
  { key: '1w', label: '1 week', ms: 7 * 86_400_000 },
  { key: 'custom', label: 'Custom', ms: 0 },
];
const MAX_MS = 92 * 86_400_000;
const TOKEN_STORE = 'mypetid.sitterTokens';

function base64url(bytes: Uint8Array) {
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function newSitterToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}
export async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
export function sitterUrl(token: string) {
  return `${PUBLIC_APP_URL}/sitter/?t=${encodeURIComponent(token)}`;
}

/** Tokens are only known to the device that made the link; keep them locally so "Copy" works later. */
function readTokens(): Record<string, string> {
  try { const raw = JSON.parse(localStorage.getItem(TOKEN_STORE) || '{}'); return raw && typeof raw === 'object' ? raw : {}; } catch { return {}; }
}
function writeTokens(tokens: Record<string, string>) {
  try { localStorage.setItem(TOKEN_STORE, JSON.stringify(tokens)); } catch { /* private mode */ }
}

function when(iso: string) {
  return new Date(iso).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
function localInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch { window.prompt('Copy this link', text); return false; }
}

export function SitterLink({ petId, dogName }: { petId?: string; dogName?: string }) {
  const { state, pets, pet, selected, setSelected, error: petError, reload: reloadPets } = useOwnerPets(petId);
  const [links, setLinks] = useState<SitterLinkRow[] | null>(null);
  const [tokens, setTokens] = useState<Record<string, string>>({});
  const [label, setLabel] = useState('');
  const [duration, setDuration] = useState('1d');
  const [custom, setCustom] = useState('');
  const [include, setInclude] = useState<SitterInclude>(ALL_ON);
  const [notes, setNotes] = useState<SitterNotes>({ feeding_notes: '', walk_notes: '', behavior_notes: '', emergency_name: '', emergency_phone: '' });
  const [notesOpen, setNotesOpen] = useState(false);
  const [created, setCreated] = useState<{ url: string; expires: string } | null>(null);
  const [message, setMessage] = useState('');
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  const name = pet?.name || dogName || 'your dog';

  useEffect(() => { setTokens(readTokens()); setNow(Date.now()); const id = window.setInterval(() => setNow(Date.now()), 60_000); return () => window.clearInterval(id); }, []);

  useEffect(() => {
    const s = (pet?.profile?.sitter || {}) as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === 'string' ? v : '');
    setNotes({ feeding_notes: str(s.feeding_notes), walk_notes: str(s.walk_notes), behavior_notes: str(s.behavior_notes), emergency_name: str(s.emergency_name), emergency_phone: str(s.emergency_phone) });
  }, [pet]);

  const load = useCallback(async () => {
    if (!supabase || !pet) return;
    const { data, error } = await supabase.from('sitter_links').select('id,pet_id,label,expires_at,include,revoked_at,created_at,last_opened_at').eq('pet_id', pet.id).order('created_at', { ascending: false }).limit(50);
    if (error) { if (isMissingRelation(error)) setMissing(true); else setMessage(error.message); setLinks([]); return; }
    setMissing(false);
    setLinks((data || []) as SitterLinkRow[]);
  }, [pet]);
  useEffect(() => { setLinks(null); setCreated(null); void load(); }, [load]);

  const [active, inactive] = useMemo(() => {
    const t = now ?? 0;
    const list = links || [];
    return [list.filter((l) => !l.revoked_at && Date.parse(l.expires_at) > t), list.filter((l) => l.revoked_at || Date.parse(l.expires_at) <= t)];
  }, [links, now]);

  if (!supabase) return null;
  if (state === 'signedOut' || state === 'loading') return null;
  if (state === 'error') return <section className="panel wide"><p className="eyebrow">Sitter link</p><p className="formHint">{petError}</p></section>;
  if (state === 'noPets' || !pet) return <section className="panel wide"><p className="eyebrow">Sitter link</p><h2>Share care info with a sitter</h2><p className="formHint">Add {dogName || 'your dog'} to your account first.</p></section>;

  function expiresAt(): Date | null {
    if (duration === 'custom') {
      const d = custom ? new Date(custom) : null;
      return d && !Number.isNaN(d.getTime()) ? d : null;
    }
    const ms = DURATIONS.find((d) => d.key === duration)?.ms || 86_400_000;
    return new Date(Date.now() + ms);
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase || !pet) return;
    const expires = expiresAt();
    if (!expires) return setMessage('Pick when the link should stop working.');
    if (expires.getTime() <= Date.now() + 5 * 60_000) return setMessage('Pick a time at least a few minutes from now.');
    if (expires.getTime() - Date.now() > MAX_MS - 60_000) return setMessage('Links can last up to 3 months.');
    if (!Object.values(include).some(Boolean)) return setMessage('Choose at least one thing to share.');
    if (!window.crypto?.subtle) return setMessage('This browser can’t make secure links. Try a current Chrome, Safari or Firefox.');
    setBusy(true); setMessage(''); setCreated(null);
    const token = newSitterToken();
    const hash = await sha256Hex(token);
    const { data: auth } = await supabase.auth.getSession();
    const { data, error } = await supabase.from('sitter_links').insert({ pet_id: pet.id, owner_id: auth.session?.user.id, token_hash: hash, label: label.trim() || null, expires_at: expires.toISOString(), include }).select('id').single();
    setBusy(false);
    if (error) return setMessage(isMissingRelation(error) ? 'Sitter links switch on after the latest database update.' : error.message);
    const id = (data as { id: string }).id;
    const next = { ...readTokens(), [id]: token };
    writeTokens(next); setTokens(next);
    const url = sitterUrl(token);
    setCreated({ url, expires: expires.toISOString() });
    setLabel('');
    const copied = await copyText(url);
    setMessage(copied ? 'Link created and copied. Send it to your sitter.' : 'Link created.');
    await load();
  }

  async function revoke(link: SitterLinkRow) {
    if (!supabase || !window.confirm(`Turn off ${link.label ? `“${link.label}”` : 'this link'} now? Anyone with it will see a "link expired" page.`)) return;
    const { error } = await supabase.from('sitter_links').update({ revoked_at: new Date().toISOString() }).eq('id', link.id);
    if (error) return setMessage(error.message);
    const next = { ...readTokens() }; delete next[link.id]; writeTokens(next); setTokens(next);
    setMessage('Link turned off.');
    await load();
  }

  async function removeLink(link: SitterLinkRow) {
    if (!supabase) return;
    const { error } = await supabase.from('sitter_links').delete().eq('id', link.id);
    if (error) return setMessage(error.message);
    await load();
  }

  async function share(link: SitterLinkRow) {
    const token = tokens[link.id];
    if (!token) return;
    const url = sitterUrl(token);
    if (typeof navigator.share === 'function') {
      try { await navigator.share({ title: `${name}’s care info`, text: `Care info for ${name} (works until ${when(link.expires_at)})`, url }); return; } catch { /* fall back to copy */ }
    }
    if (await copyText(url)) setMessage('Link copied.');
  }

  async function saveNotes(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase || !pet) return;
    setBusy(true);
    const fresh = await supabase.from('pets').select('profile').eq('id', pet.id).maybeSingle();
    const profile = ((fresh.data as { profile?: Record<string, any> } | null)?.profile) || {};
    const clean = Object.fromEntries(Object.entries(notes).map(([k, v]) => [k, v.trim().slice(0, 2000)]));
    const { error } = await supabase.from('pets').update({ profile: { ...profile, sitter: { ...(profile.sitter || {}), ...clean } } }).eq('id', pet.id);
    setBusy(false);
    if (error) return setMessage(error.message);
    setMessage('Sitter notes saved. Open links show them right away.');
    setNotesOpen(false);
    void reloadPets();
  }

  const includeSummary = (inc: Partial<SitterInclude>) => INCLUDE_LABELS.filter(([k]) => inc?.[k]).map(([, l]) => l.split(' (')[0]).join(', ') || 'Nothing';

  function row(link: SitterLinkRow, live: boolean) {
    const token = tokens[link.id];
    return <li key={link.id} className={`${styles.item} ${live ? '' : styles.inactive}`}>
      <span className={styles.itemMain}>
        <strong>{link.label || 'Sitter link'}<span className={`${styles.badge} ${live ? styles.badgeLive : ''}`}>{link.revoked_at ? 'Turned off' : live ? 'Active' : 'Expired'}</span></strong>
        <small>{live ? `Works until ${when(link.expires_at)}${now ? ` (${formatCountdown(Date.parse(link.expires_at) - now).replace(/^in /, '')} left)` : ''}` : link.revoked_at ? `Turned off ${when(link.revoked_at)}` : `Expired ${when(link.expires_at)}`}</small>
        <small>Shows: {includeSummary(link.include)}</small>
        <small>{link.last_opened_at ? `Last opened ${when(link.last_opened_at)}` : 'Not opened yet'}</small>
      </span>
      <span className={styles.itemActions}>
        {live && token && <button type="button" onClick={async () => { if (await copyText(sitterUrl(token))) setMessage('Link copied.'); }}>Copy</button>}
        {live && token && <button type="button" onClick={() => share(link)}>Share</button>}
        {live && !token && <small className="formHint">Copy is only on the device that made it</small>}
        {live ? <button type="button" className={styles.danger} onClick={() => revoke(link)}>Revoke</button> : <button type="button" onClick={() => removeLink(link)}>Remove</button>}
      </span>
    </li>;
  }

  return (
    <section className="panel wide">
      <div className="panelTitleRow">
        <div><p className="eyebrow">Sitter link</p><h2>Share {name}’s care info</h2></div>
        {pets.length > 1 && !petId && <select value={selected} onChange={(e) => setSelected(e.target.value)} aria-label="Choose dog" style={{ width: 'auto' }}>{pets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>}
      </div>
      <p className="formHint">Make a private link for a sitter, walker or family member. It stops working when it expires or when you revoke it. No account needed to open it.</p>
      {missing && <p className="formHint">Sitter links switch on after the latest database update.</p>}
      {message && <p className="authMessage" role="status">{message}</p>}

      {!missing && <div className={styles.wrap}>
        {created && <div className={styles.created} role="status">
          <strong>Your new link</strong>
          <code>{created.url}</code>
          <small className="formHint">Works until {when(created.expires)}. For safety only a fingerprint of the link is stored: copy it from this device.</small>
          <div className="actions compact"><button className="primary" type="button" onClick={() => copyText(created.url)}>Copy link</button><a className="button" href={created.url} target="_blank" rel="noopener noreferrer">Preview</a></div>
        </div>}

        <form className={styles.form} onSubmit={create}>
          <label>Who is it for? (optional)<input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} placeholder="Sam, weekend sitter" /></label>
          <div>
            <p className={styles.sectionHead}>Link works for</p>
            <div className={styles.choices} role="radiogroup" aria-label="Link expiry">{DURATIONS.map((d) => <button key={d.key} type="button" role="radio" aria-checked={duration === d.key} className={duration === d.key ? styles.on : ''} onClick={() => { setDuration(d.key); if (d.key === 'custom' && !custom) setCustom(localInput(new Date(Date.now() + 2 * 86_400_000))); }}>{d.label}</button>)}</div>
          </div>
          {duration === 'custom' && <label>Stops working at<input type="datetime-local" value={custom} onChange={(e) => setCustom(e.target.value)} min={localInput(new Date())} max={localInput(new Date(Date.now() + MAX_MS - 86_400_000))} required /></label>}
          <div>
            <p className={styles.sectionHead}>What the sitter sees</p>
            <div className={styles.checks}>{INCLUDE_LABELS.map(([key, text]) => <label key={key} className="toggleRow"><input type="checkbox" checked={include[key]} onChange={(e) => setInclude({ ...include, [key]: e.target.checked })} /> {text}</label>)}</div>
            <p className="formHint">Your home address is never included. Name, photo and status tags are always shown so the sitter knows it’s the right dog.</p>
          </div>
          <div className="actions compact">
            <button className="primary" type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create link'}</button>
            <button type="button" onClick={() => setNotesOpen(!notesOpen)} aria-expanded={notesOpen}>{notesOpen ? 'Hide sitter notes' : 'Edit sitter notes'}</button>
          </div>
        </form>

        {notesOpen && <form className={styles.form} onSubmit={saveNotes}>
          <p className="formHint">These notes are only shown through sitter links (not on the public tag page). Feeding plan, medicine and vet details come from {name}’s profile.</p>
          <label>Feeding notes<textarea value={notes.feeding_notes} onChange={(e) => setNotes({ ...notes, feeding_notes: e.target.value })} maxLength={2000} placeholder={pet.feeding_plan || '2 cups at 7 AM and 6 PM. Food is in the pantry bin.'} /></label>
          <label>Walk notes<textarea value={notes.walk_notes} onChange={(e) => setNotes({ ...notes, walk_notes: e.target.value })} maxLength={2000} placeholder="Harness, not collar. Pulls toward squirrels. Usual loop is 20 minutes." /></label>
          <label>Behavior notes<textarea value={notes.behavior_notes} onChange={(e) => setNotes({ ...notes, behavior_notes: e.target.value })} maxLength={2000} placeholder="Scared of thunder: crate with a blanket helps. Do not let him greet other dogs on leash." /></label>
          <div className="grid2">
            <label>Emergency contact name<input value={notes.emergency_name} onChange={(e) => setNotes({ ...notes, emergency_name: e.target.value })} maxLength={80} /></label>
            <label>Emergency contact phone<input value={notes.emergency_phone} onChange={(e) => setNotes({ ...notes, emergency_phone: e.target.value })} inputMode="tel" maxLength={30} /></label>
          </div>
          <div className="actions compact"><button className="primary" type="submit" disabled={busy}>Save sitter notes</button></div>
        </form>}

        {links === null ? <p className="formHint">Loading links…</p> : <>
          {active.length > 0 && <div><p className={styles.sectionHead}>Active</p><ul className={styles.list}>{active.map((l) => row(l, true))}</ul></div>}
          {inactive.length > 0 && <details><summary className="formHint">Expired and revoked ({inactive.length})</summary><ul className={styles.list} style={{ marginTop: 8 }}>{inactive.map((l) => row(l, false))}</ul></details>}
          {links.length === 0 && <p className="formHint">No sitter links yet.</p>}
        </>}
      </div>}
    </section>
  );
}

// ---------- public sitter page ----------

type SitterView = {
  status: 'ok' | 'expired' | 'revoked' | 'invalid';
  label?: string | null;
  expires_at?: string;
  timezone?: string;
  pet?: { name: string; breed: string | null; photo_url: string | null; status_tags: string[]; sex?: string | null; weight_lb?: string | null };
  care_schedule?: unknown[];
  feeding?: { plan: string | null; notes: string | null };
  meds?: { medical_notes: string | null; current: { name: string | null; dose: string | null; reason: string | null }[]; records: { title: string; given_on: string | null; due_on: string | null; notes: string | null }[] };
  vet?: { clinic: string | null; phone: string | null; address: string | null; owner_phone: string | null; owner_email: string | null; emergency_name: string | null; emergency_phone: string | null };
  behavior?: { public: string | null; care_notes: string | null; sitter_notes: string | null };
  walk?: { notes: string | null };
};

const tel = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;

function CareList({ schedule, timeZone, now }: { schedule: unknown[]; timeZone: string; now: Date | null }) {
  const items = useMemo(() => parseSchedule(schedule).filter((i) => i.times.length), [schedule]);
  const next = useMemo(() => (now ? new Map(upcoming(items, now, timeZone, items.length).map((e) => [e.item.id, e])) : new Map()), [items, now, timeZone]);
  if (!items.length) return <p className="formHint">No care times set.</p>;
  return <ul className={styles.rows}>{items.map((item) => {
    const n = next.get(item.id);
    return <li key={item.id}>
      <span><strong>{item.label}</strong><small>{KIND_META[item.kind].label} · {item.times.map((t) => formatClock(t)).join(', ')} · {formatDays(item.days)}{item.dose ? ` · ${item.dose}` : ''}</small>{item.note && <small>{item.note}</small>}</span>
      {n && <span className={styles.next}>{formatCountdown(n.ms)}</span>}
    </li>;
  })}</ul>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className={`panel ${styles.card}`}><h2>{title}</h2>{children}</section>;
}

/** Public page body for /sitter/?t=<token>. */
export function SitterView() {
  const [view, setView] = useState<SitterView | null>(null);
  const [failure, setFailure] = useState('');
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const token = params.get('t') || hash.get('t') || '';
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    if (!token) { setView({ status: 'invalid' }); return () => window.clearInterval(timer); }
    if (!supabase) { setFailure('Cloud services are not configured on this site.'); return () => window.clearInterval(timer); }
    supabase.rpc('get_sitter_view', { p_token: token }).then(({ data, error }) => {
      if (error) { setFailure(isMissingRelation(error) ? 'Sitter links are not switched on yet.' : error.message); return; }
      setView((data as SitterView) || { status: 'invalid' });
    });
    return () => window.clearInterval(timer);
  }, []);

  const brand = <Link className="brandLockup" href="/"><img src="/images/logo/MyPetID-Logo_Resized.jpg" alt="" /><span>MyPet<b>ID</b></span></Link>;

  if (failure) return <main className="publicShell"><section className="publicHero">{brand}</section><article className="panel" style={{ maxWidth: 720 }}><StatusScreen kind="database" message={failure} /></article></main>;
  if (!view) return <main className="publicShell"><section className="publicHero">{brand}</section><article className="panel" style={{ maxWidth: 720 }}><BoneLoader label="Opening the care sheet…" /></article></main>;
  const expired = view.status === 'ok' && view.expires_at && now && Date.parse(view.expires_at) <= now.getTime();
  if (view.status !== 'ok' || !view.pet || expired) {
    const title = view.status === 'revoked' ? 'This sitter link was turned off' : view.status === 'invalid' ? 'This link doesn’t work' : 'This sitter link has expired';
    const message = view.status === 'invalid'
      ? 'The link may be incomplete. Check you copied all of it, or ask the owner to send a new one.'
      : 'Thanks for looking after this pup! The owner can send you a new link if you still need the care info.';
    return <main className="publicShell"><section className="publicHero">{brand}</section><article className="panel" style={{ maxWidth: 720 }}><StatusScreen kind="notFound" title={title} message={message} actions={[{ label: 'Go home', href: '/', primary: true }]} /></article></main>;
  }

  const pet = view.pet;
  const tz = view.timezone || 'America/New_York';
  const tags = (pet.status_tags || []).map(statusTag).filter(Boolean);
  const left = view.expires_at && now ? Date.parse(view.expires_at) - now.getTime() : 0;
  const v = view.vet;
  const meds = view.meds;
  const behavior = view.behavior;

  return (
    <main className="publicShell">
      <section className="publicHero">{brand}</section>
      <div className={styles.page}>
        <section className={`panel ${styles.hero}`}>
          {pet.photo_url && <img src={pet.photo_url} alt={`${pet.name}`} />}
          <div>
            <p className="eyebrow">Care sheet{view.label ? ` for ${view.label}` : ''}</p>
            <h1>{pet.name}</h1>
            <p>{[pet.breed, pet.sex, pet.weight_lb ? `${pet.weight_lb} lb` : ''].filter(Boolean).join(' · ')}</p>
            {tags.length > 0 && <div className={`chipCloud ${styles.tags}`} style={{ marginTop: 8 }}>{tags.map((t) => <span key={t!.key}>{t!.label}</span>)}</div>}
            {view.expires_at && <p className={styles.expires}>Link works until {when(view.expires_at)}{left > 0 ? ` (${formatCountdown(left).replace(/^in /, '')} left)` : ''}</p>}
          </div>
        </section>

        {v && <Section title="Emergency & vet">
          <ul className={styles.rows}>
            {(v.owner_phone || v.owner_email) && <li><span><strong>Owner</strong><small>{[v.owner_phone, v.owner_email].filter(Boolean).join(' · ')}</small></span>{v.owner_phone && <a className="button primary" href={tel(v.owner_phone)}>Call</a>}</li>}
            {(v.emergency_name || v.emergency_phone) && <li><span><strong>Emergency contact</strong><small>{[v.emergency_name, v.emergency_phone].filter(Boolean).join(' · ')}</small></span>{v.emergency_phone && <a className="button" href={tel(v.emergency_phone)}>Call</a>}</li>}
            {(v.clinic || v.phone) && <li><span><strong>{v.clinic || 'Vet'}</strong><small>{[v.phone, v.address].filter(Boolean).join(' · ')}</small></span>{v.phone && <a className="button" href={tel(v.phone)}>Call vet</a>}</li>}
            {!v.owner_phone && !v.owner_email && !v.emergency_phone && !v.phone && <li><span><small>No contacts were added yet.</small></span></li>}
          </ul>
        </Section>}

        {view.care_schedule && <Section title="Daily schedule">
          <CareList schedule={view.care_schedule} timeZone={tz} now={now} />
          <p className="formHint">Times are in {tz.replace(/_/g, ' ')}.</p>
        </Section>}

        {view.feeding && (view.feeding.plan || view.feeding.notes) && <Section title="Feeding">
          {view.feeding.plan && <p>{view.feeding.plan}</p>}
          {view.feeding.notes && <p>{view.feeding.notes}</p>}
        </Section>}

        {meds && (meds.medical_notes || meds.current.length > 0 || meds.records.length > 0) && <Section title="Medications & health">
          {meds.medical_notes && <p>{meds.medical_notes}</p>}
          {(meds.current.length > 0 || meds.records.length > 0) && <ul className={styles.rows}>
            {meds.current.map((m, i) => <li key={`c${i}`}><span><strong>{m.name || 'Medication'}</strong>{m.dose && <small>{m.dose}</small>}{m.reason && <small>For {m.reason}</small>}</span></li>)}
            {meds.records.map((r, i) => <li key={`r${i}`}><span><strong>{r.title}</strong>{r.notes && <small>{r.notes}</small>}</span>{r.due_on && <span className={styles.next}>Next {new Date(`${r.due_on}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>}</li>)}
          </ul>}
        </Section>}

        {behavior && (behavior.public || behavior.care_notes || behavior.sitter_notes) && <Section title="Behavior">
          {behavior.sitter_notes && <p>{behavior.sitter_notes}</p>}
          {behavior.public && <p>{behavior.public}</p>}
          {behavior.care_notes && <p>{behavior.care_notes}</p>}
        </Section>}

        {view.walk?.notes && <Section title="Walks"><p>{view.walk.notes}</p></Section>}

        <p className="formHint" style={{ textAlign: 'center' }}>Shared privately by {pet.name}’s owner with MyPetID. Please don’t forward this link.</p>
      </div>
    </main>
  );
}
