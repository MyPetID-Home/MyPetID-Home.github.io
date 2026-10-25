"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { supabase } from '../lib/supabase';
import { CLOCK_EVENT } from '../lib/clock';
import {
  CARE_KINDS, DAY_LABELS, KIND_META, appendCareLog, dayWord, deviceTimeZone, formatClock, formatCountdown, formatDays,
  formatInstant, isOccurrenceDone, isValidTimeZone, newCareId, nextOccurrence, normalizeTime, parseCareLog, parseSchedule, upcoming,
  type CareIconName, type CareItem, type CareKind, type CareLogEntry, type UpcomingEntry,
} from '../lib/care-schedule';
import { Bell, Bowl, Check, Footprints, Heart, Scissors, Sparkles, Stethoscope } from './icons';
import styles from './care-schedule.module.css';
import { AlarmArt } from './alarm-art';
import { MascotPeek } from './mascot';

/**
 * Care schedule: meals, walks, medicine and more with live countdowns and in-app alarms.
 * Stored in pets.profile.care_schedule (+ profile.timezone, profile.care_log) on the owner's cloud pet row.
 */

const ICONS: Record<CareIconName, ComponentType<{ className?: string }>> = { Heart, Bowl, Footprints, Sparkles, Scissors, Stethoscope, Bell };
const TICK_MS = 15_000;
const OWNER_GRACE_MS = 60 * 60_000;
const UPDATED_EVENT = 'mypetid:care-updated';

function KindIcon({ kind, className }: { kind: CareKind; className?: string }) {
  const meta = KIND_META[kind];
  const Icon = ICONS[meta.icon];
  return <span className={`iconBubble ${meta.tone} ${className || ''}`} aria-hidden><Icon /></span>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// ---------- data ----------

type CarePet = { id: string; name: string; schedule: CareItem[]; log: CareLogEntry[]; timeZone: string };
type DbState = 'loading' | 'ready' | 'signedOut' | 'noClient' | 'noPets' | 'error';
type ProfileMutator = (profile: Record<string, unknown>) => Record<string, unknown>;

function toCarePet(row: unknown): CarePet | null {
  if (!isRecord(row) || typeof row.id !== 'string') return null;
  const profile = isRecord(row.profile) ? row.profile : {};
  const tz = typeof profile.timezone === 'string' && isValidTimeZone(profile.timezone) ? profile.timezone : deviceTimeZone();
  return {
    id: row.id,
    name: typeof row.name === 'string' && row.name.trim() ? row.name.trim() : 'Your pet',
    schedule: parseSchedule(profile.care_schedule),
    log: parseCareLog(profile.care_log),
    timeZone: tz,
  };
}

function useOwnerPets() {
  const [db, setDb] = useState<DbState>(supabase ? 'loading' : 'noClient');
  const [pets, setPets] = useState<CarePet[]>([]);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    if (!supabase) { setDb('noClient'); return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setDb('signedOut'); setPets([]); return; }
    const { data, error } = await supabase.from('pets').select('id,name,profile').eq('owner_id', session.user.id);
    if (error) { setDb('error'); setLoadError(error.message || 'Could not load your pets.'); return; }
    const list = (Array.isArray(data) ? (data as unknown[]) : []).map(toCarePet).filter((p): p is CarePet => p !== null);
    setPets(list);
    setDb(list.length ? 'ready' : 'noPets');
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    const run = () => { if (alive) void load(); };
    const timer = window.setTimeout(run, 0);
    const { data } = supabase.auth.onAuthStateChange((event) => { if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') run(); });
    window.addEventListener(UPDATED_EVENT, run);
    return () => { alive = false; window.clearTimeout(timer); data.subscription.unsubscribe(); window.removeEventListener(UPDATED_EVENT, run); };
  }, [load]);

  /** Re-reads the row, applies `mutate` to the fresh profile (keeping every other key) and saves it. Returns an error message or null. */
  const updateProfile = useCallback(async (petId: string, mutate: ProfileMutator): Promise<string | null> => {
    if (!supabase) return 'Cloud sync is not set up on this site.';
    const fresh = await supabase.from('pets').select('id,name,profile').eq('id', petId).maybeSingle();
    if (fresh.error) return fresh.error.message;
    if (!fresh.data) return 'That pet could not be found.';
    const row: unknown = fresh.data;
    const base = isRecord(row) && isRecord(row.profile) ? row.profile : {};
    const next = mutate({ ...base });
    const { error } = await supabase.from('pets').update({ profile: next }).eq('id', petId);
    if (error) return error.message;
    const name = isRecord(row) && typeof row.name === 'string' ? row.name : '';
    const updated = toCarePet({ id: petId, name, profile: next });
    if (updated) setPets((list) => list.map((p) => (p.id === petId ? updated : p)));
    window.setTimeout(() => window.dispatchEvent(new CustomEvent(UPDATED_EVENT, { detail: { petId } })), 0);
    return null;
  }, []);

  return { db, pets, loadError, updateProfile };
}

async function markDone(updateProfile: (petId: string, mutate: ProfileMutator) => Promise<string | null>, petId: string, itemId: string) {
  return updateProfile(petId, (p) => ({ ...p, care_log: appendCareLog(parseCareLog(p.care_log), itemId) }));
}

/** Current time, set only after mount (hydration-safe), refreshed every 15s and when the tab becomes visible. */
function useNow(interval = TICK_MS) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, interval);
    const onVisible = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener(CLOCK_EVENT, tick);
    return () => { window.clearTimeout(first); window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); window.removeEventListener(CLOCK_EVENT, tick); };
  }, [interval]);
  return now;
}

// ---------- alarms ----------

let audioCtx: AudioContext | null = null;
function getAudio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) { try { audioCtx = new Ctor(); } catch { return null; } }
  return audioCtx;
}
function unlockAudio() {
  const ctx = getAudio();
  if (ctx && ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
}
/** A short three-note chime, synthesised (no audio files). */
function playChime() {
  const ctx = getAudio();
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
  const t0 = ctx.currentTime + 0.03;
  const notes: [number, number][] = [[880, 0], [1174.66, 0.18], [1318.51, 0.36]];
  for (const [freq, delay] of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t0 + delay);
    gain.gain.exponentialRampToValueAtTime(0.22, t0 + delay + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + delay + 0.7);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0 + delay);
    osc.stop(t0 + delay + 0.75);
  }
}

const FIRED_KEY = 'mypetid-care-fired';
const firedMemory = new Set<string>();
function readFired(): Record<string, number> {
  try {
    const raw = window.localStorage.getItem(FIRED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (!isRecord(parsed)) return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed)) if (typeof v === 'number') out[k] = v;
    return out;
  } catch { return {}; }
}
function hasFired(key: string) {
  return firedMemory.has(key) || key in readFired();
}
function markFired(key: string) {
  firedMemory.add(key);
  const map = readFired();
  const cutoff = Date.now() - 2 * 86_400_000;
  for (const k of Object.keys(map)) if (map[k] < cutoff) delete map[k];
  map[key] = Date.now();
  try { window.localStorage.setItem(FIRED_KEY, JSON.stringify(map)); } catch { /* storage blocked: memory set still dedupes */ }
}

async function systemNotify(title: string, body: string, tag: string) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (reg) { await reg.showNotification(title, { body, tag }); return; }
  } catch { /* fall through to the page Notification */ }
  try { new Notification(title, { body, tag }); } catch { /* some mobile browsers only allow SW notifications */ }
}

type Toast = { key: string; petId: string; itemId: string; kind: CareKind; title: string; body: string };

function alarmText(pet: CarePet, item: CareItem) {
  const title = item.kind === 'medicine' ? `${pet.name}: ${item.label} time` : `${item.label} for ${pet.name}`;
  const body = [item.dose, item.note].filter(Boolean).join(' · ') || `It's time for ${pet.name}'s ${item.label.toLowerCase()}.`;
  return { title, body };
}

/** While the page is open: checks every 15s and rings alarm items that came due in the last 60s (once per occurrence, per device). */
function useCareAlarms(pets: CarePet[]) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    if (!pets.length) return;
    const timers: number[] = [];
    const check = () => {
      const now = new Date();
      const fresh: Toast[] = [];
      for (const pet of pets) {
        for (const item of pet.schedule) {
          if (!item.alarm) continue;
          const at = nextOccurrence(item, now, pet.timeZone, 60_000);
          if (!at || at.getTime() > now.getTime()) continue;
          if (isOccurrenceDone(item.id, at, pet.log)) continue;
          const key = `${pet.id}:${item.id}:${at.toISOString()}`;
          if (hasFired(key)) continue;
          markFired(key);
          fresh.push({ key, petId: pet.id, itemId: item.id, kind: item.kind, ...alarmText(pet, item) });
        }
      }
      if (!fresh.length) return;
      playChime();
      for (const t of fresh) void systemNotify(t.title, t.body, t.key);
      setToasts((list) => [...list.filter((t) => !fresh.some((f) => f.key === t.key)), ...fresh].slice(-4));
      for (const t of fresh) timers.push(window.setTimeout(() => setToasts((list) => list.filter((x) => x.key !== t.key)), 3 * 60_000));
    };
    const first = window.setTimeout(check, 0);
    const interval = window.setInterval(check, TICK_MS);
    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });
    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
      timers.forEach((t) => window.clearTimeout(t));
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, [pets]);

  const dismiss = useCallback((key: string) => setToasts((list) => list.filter((t) => t.key !== key)), []);
  return { toasts, dismiss };
}

type Permission = 'unsupported' | NotificationPermission;
function useNotificationPermission() {
  const [permission, setPermission] = useState<Permission | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => setPermission(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission), 0);
    return () => window.clearTimeout(timer);
  }, []);
  const request = useCallback(async () => {
    unlockAudio();
    if (typeof Notification === 'undefined') { setPermission('unsupported'); return; }
    try { setPermission(await Notification.requestPermission()); } catch { setPermission(Notification.permission); }
  }, []);
  return { permission, request };
}

function ToastStack({ toasts, onDismiss, onDone }: { toasts: Toast[]; onDismiss: (key: string) => void; onDone: (toast: Toast) => void }) {
  const [seen, setSeen] = useState<string[]>([]);
  if (!toasts.length) return null;
  // The newest alarm rings full screen with its animation; once handled or put off it waits in the stack.
  const ringing = [...toasts].reverse().find((t) => !seen.includes(t.key));
  return (<>
    {ringing && <div className={styles.alarmScrim} role="alertdialog" aria-modal="true" aria-label={ringing.title}>
      <div className={styles.alarmCard}>
        <MascotPeek size={64} className={styles.alarmMascot} />
        <AlarmArt kind={ringing.kind} />
        <h2>{ringing.title}</h2>
        <p>{ringing.body}</p>
        <div className="actions"><button type="button" onClick={() => setSeen((list) => [...list, ringing.key])}>Remind me later</button><button type="button" className="primary" onClick={() => onDone(ringing)}><Check /> Done</button></div>
      </div>
    </div>}
    <div className={styles.toastStack} role="status" aria-live="assertive">
      {toasts.map((t) => (
        <div key={t.key} className={styles.toast}>
          <KindIcon kind={t.kind} className={styles.icon} />
          <div><strong>{t.title}</strong><small>{t.body}</small></div>
          <button type="button" className="primary" onClick={() => onDone(t)}><Check /> Done</button>
          <button type="button" onClick={() => onDismiss(t.key)} aria-label="Dismiss reminder">Later</button>
        </div>
      ))}
    </div>
  </>);
}

function countdownClass(ms: number) {
  if (ms < -60_000) return `${styles.countdown} ${styles.overdue}`;
  if (ms < 15 * 60_000) return `${styles.countdown} ${styles.soon}`;
  return styles.countdown;
}

// ---------- owner panel ----------

type Draft = {
  id: string | null; kind: CareKind; label: string; times: string[]; days: number[];
  dose: string; note: string; alarm: boolean; public: boolean; publicTouched: boolean;
};

function emptyDraft(kind: CareKind = 'meal', label = '', time = ''): Draft {
  return { id: null, kind, label, times: [time], days: [], dose: '', note: '', alarm: kind === 'medicine', public: kind === 'medicine', publicTouched: false };
}

function draftFromItem(item: CareItem): Draft {
  return { id: item.id, kind: item.kind, label: item.label, times: item.times.length ? [...item.times] : [''], days: [...item.days], dose: item.dose || '', note: item.note || '', alarm: item.alarm, public: item.public, publicTouched: true };
}

const TEMPLATES: { name: string; kind: CareKind; label: string; time: string }[] = [
  { name: 'Breakfast 7:00', kind: 'meal', label: 'Breakfast', time: '07:00' },
  { name: 'Dinner 18:00', kind: 'meal', label: 'Dinner', time: '18:00' },
  { name: 'Morning walk 7:30', kind: 'walk', label: 'Morning walk', time: '07:30' },
  { name: 'Evening walk 18:30', kind: 'walk', label: 'Evening walk', time: '18:30' },
  { name: 'Medicine', kind: 'medicine', label: '', time: '' },
];

export function CareSchedule({ petId }: { petId?: string }) {
  const { db, pets, loadError, updateProfile } = useOwnerPets();
  const now = useNow();
  const { toasts, dismiss } = useCareAlarms(pets);
  const { permission, request } = useNotificationPermission();
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const pet = useMemo(() => {
    const wanted = petId || chosenId;
    return (wanted ? pets.find((p) => p.id === wanted) : undefined) || (petId ? undefined : pets[0]);
  }, [pets, petId, chosenId]);

  const next = useMemo<UpcomingEntry[]>(
    () => (pet && now ? upcoming(pet.schedule, now, pet.timeZone, 4, { graceMs: OWNER_GRACE_MS, log: pet.log }) : []),
    [pet, now],
  );

  const groups = useMemo(() => {
    if (!pet) return [];
    return CARE_KINDS.map((kind) => ({ kind, items: pet.schedule.filter((i) => i.kind === kind).sort((a, b) => (a.times[0] || '99').localeCompare(b.times[0] || '99')) }))
      .filter((g) => g.items.length);
  }, [pet]);

  const saveSchedule = useCallback(async (targetId: string, change: (list: CareItem[]) => CareItem[]) => {
    setBusy(true);
    const error = await updateProfile(targetId, (p) => ({ ...p, care_schedule: change(parseSchedule(p.care_schedule)), timezone: deviceTimeZone() }));
    setBusy(false);
    return error;
  }, [updateProfile]);

  const done = useCallback(async (targetPetId: string, item: Pick<CareItem, 'id' | 'label'>) => {
    const error = await markDone(updateProfile, targetPetId, item.id);
    setMessage(error || `Marked ${item.label} as done.`);
  }, [updateProfile]);

  if (db !== 'ready' || !pet) {
    const text = db === 'loading' ? 'Loading your care schedule…'
      : db === 'noClient' ? 'Care reminders need a MyPetID cloud account, which is not set up on this site yet.'
        : db === 'signedOut' ? 'Sign in to set up meals, walks and medicine reminders for your dog.'
          : db === 'noPets' ? 'Save your pet to your cloud account first, then add its meals, walks and medicine here.'
            : db === 'error' ? loadError || 'Could not load your care schedule.'
              : 'This pet is not in your cloud account yet.';
    return (
      <section className="panel full">
        <div className="panelTitleRow">
          <div><p className="eyebrow"><Bell /> Care schedule</p><h2>Meals, walks and medicine</h2></div>
          <span className="iconBubble violet"><Bell /></span>
        </div>
        <p className="authMessage" role="status">{text}</p>
      </section>
    );
  }

  const currentPet = pet;

  async function quickAdd(t: (typeof TEMPLATES)[number]) {
    setMessage('');
    if (!t.time) { setDraft(emptyDraft(t.kind, t.label, '')); return; }
    const item: CareItem = { id: newCareId(), kind: t.kind, label: t.label, times: [t.time], days: [], alarm: false, public: t.kind === 'medicine' };
    const error = await saveSchedule(currentPet.id, (list) => [...list, item]);
    setMessage(error || `Added ${t.label} at ${formatClock(t.time)}. Tap Edit to change it.`);
  }

  async function saveDraft() {
    if (!draft) return;
    const times = Array.from(new Set(draft.times.map(normalizeTime).filter(Boolean))).sort();
    if (!times.length) { setMessage('Add at least one time, like 08:00.'); return; }
    const item: CareItem = {
      id: draft.id || newCareId(),
      kind: draft.kind,
      label: draft.label.trim() || KIND_META[draft.kind].label,
      times,
      days: draft.days.length === 7 ? [] : [...draft.days].sort(),
      dose: draft.dose.trim() || undefined,
      note: draft.note.trim() || undefined,
      alarm: draft.alarm,
      public: draft.public,
    };
    const error = await saveSchedule(currentPet.id, (list) => (list.some((i) => i.id === item.id) ? list.map((i) => (i.id === item.id ? item : i)) : [...list, item]));
    if (error) { setMessage(error); return; }
    setDraft(null);
    setMessage(`Saved ${item.label}.`);
  }

  async function deleteItem(id: string) {
    const error = await saveSchedule(currentPet.id, (list) => list.filter((i) => i.id !== id));
    setConfirmDelete(null);
    if (error) setMessage(error);
    if (draft?.id === id) setDraft(null);
  }

  const patch = (change: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...change } : d));

  return (
    <section className="panel full">
      <div className="panelTitleRow">
        <div>
          <p className="eyebrow"><Bell /> Care schedule</p>
          <h2>{currentPet.name}&apos;s day</h2>
        </div>
        <span className="iconBubble violet"><Bell /></span>
      </div>

      <div className={styles.wrap}>
        {!petId && pets.length > 1 && (
          <div className={styles.chips} role="radiogroup" aria-label="Choose a pet">
            {pets.map((p) => (
              <button key={p.id} type="button" role="radio" aria-checked={p.id === currentPet.id} className={p.id === currentPet.id ? 'activeMini' : ''} onClick={() => { setChosenId(p.id); setDraft(null); setMessage(''); }}>{p.name}</button>
            ))}
          </div>
        )}

        {message && <p className="authMessage" role="status">{message}</p>}

        <div className={styles.section}>
          <p className={styles.sectionHead}>Next up</p>
          {!now ? <p className="mutedLine">Checking the clock…</p> : next.length === 0 ? (
            <p className="mutedLine">Nothing scheduled yet. Add {currentPet.name}&apos;s meals, walks or medicine below.</p>
          ) : (
            <ul className={styles.list}>
              {next.map(({ item, at, ms }) => (
                <li key={item.id} className={styles.item}>
                  <KindIcon kind={item.kind} className={styles.icon} />
                  <div className={styles.itemMain}>
                    <strong>{item.label}</strong>
                    <small>{formatInstant(at)} {dayWord(at, now)}{item.dose ? ` · ${item.dose}` : ''}</small>
                  </div>
                  <span className={countdownClass(ms)}>{formatCountdown(ms)}</span>
                  <div className={styles.itemActions}>
                    <button type="button" className={ms < 60 * 60_000 ? 'primary' : ''} onClick={() => done(currentPet.id, item)}><Check /> Done</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={styles.section}>
          <p className={styles.sectionHead}>Quick add</p>
          <div className={styles.chips}>
            {TEMPLATES.map((t) => <button key={t.name} type="button" disabled={busy} onClick={() => quickAdd(t)}>+ {t.name}</button>)}
            {!draft && <button type="button" className="primary" onClick={() => { setDraft(emptyDraft()); setMessage(''); }}>Add to schedule</button>}
          </div>
        </div>

        {draft && (
          <div className={styles.form}>
            <strong>{draft.id ? 'Edit reminder' : 'New reminder'}</strong>
            <div className={styles.chips} role="radiogroup" aria-label="Kind">
              {CARE_KINDS.map((kind) => (
                <button key={kind} type="button" role="radio" aria-checked={draft.kind === kind} className={draft.kind === kind ? 'activeMini' : ''}
                  onClick={() => patch({ kind, ...(draft.publicTouched ? {} : { public: kind === 'medicine' }), ...(draft.id ? {} : { alarm: draft.alarm || kind === 'medicine' }) })}>
                  {KIND_META[kind].label}
                </button>
              ))}
            </div>
            <label>Name
              <input value={draft.label} onChange={(e) => patch({ label: e.target.value })} placeholder={draft.kind === 'medicine' ? 'e.g. Apoquel' : KIND_META[draft.kind].label} maxLength={60} />
            </label>
            <div className={styles.section}>
              <span>Times</span>
              <div className={styles.timeRow}>
                {draft.times.map((t, index) => (
                  <span key={index} className={styles.timeRow}>
                    <input type="time" value={t} aria-label={`Time ${index + 1}`} onChange={(e) => patch({ times: draft.times.map((x, i) => (i === index ? e.target.value : x)) })} />
                    {draft.times.length > 1 && <button type="button" aria-label={`Remove time ${index + 1}`} onClick={() => patch({ times: draft.times.filter((_, i) => i !== index) })}>Remove</button>}
                  </span>
                ))}
                {draft.times.length < 8 && <button type="button" onClick={() => patch({ times: [...draft.times, ''] })}>+ Add time</button>}
              </div>
            </div>
            <div className={styles.section}>
              <span>Days</span>
              <div className={styles.chips}>
                <button type="button" aria-pressed={draft.days.length === 0} className={draft.days.length === 0 ? 'activeMini' : ''} onClick={() => patch({ days: [] })}>Every day</button>
                {DAY_LABELS.map((label, day) => {
                  const on = draft.days.includes(day);
                  return (
                    <button key={label} type="button" aria-pressed={on} className={on ? 'activeMini' : ''}
                      onClick={() => {
                        const days = on ? draft.days.filter((d) => d !== day) : [...draft.days, day];
                        patch({ days: days.length === 7 ? [] : days });
                      }}>{label}</button>
                  );
                })}
              </div>
            </div>
            <div className="grid2">
              <label>Dose <small>(optional)</small>
                <input value={draft.dose} onChange={(e) => patch({ dose: e.target.value })} placeholder={draft.kind === 'meal' ? 'e.g. 1 cup kibble' : 'e.g. 1 tablet with food'} maxLength={80} />
              </label>
              <label>Note <small>(optional)</small>
                <input value={draft.note} onChange={(e) => patch({ note: e.target.value })} placeholder="Anything a sitter or finder should know" maxLength={200} />
              </label>
            </div>
            <div className={styles.toggles}>
              <label className="toggleRow"><input type="checkbox" checked={draft.alarm} onChange={(e) => patch({ alarm: e.target.checked })} /> Alarm</label>
              <label className="toggleRow"><input type="checkbox" checked={draft.public} onChange={(e) => patch({ public: e.target.checked, publicTouched: true })} /> Show on my dog&apos;s scan page</label>
            </div>
            <p className="formHint">Times use this device&apos;s time zone ({deviceTimeZone()}). If {currentPet.name} goes missing, a finder who scans the tag sees the countdown for items shown on the scan page.</p>
            <div className="actions compact">
              <button type="button" className="primary" disabled={busy} onClick={saveDraft}>{busy ? 'Saving…' : 'Save'}</button>
              <button type="button" onClick={() => setDraft(null)}>Cancel</button>
            </div>
          </div>
        )}

        {groups.length > 0 && (
          <div className={styles.section}>
            <p className={styles.sectionHead}>Schedule</p>
            {groups.map((group) => (
              <div key={group.kind} className={styles.section}>
                <small className="mutedLine">{KIND_META[group.kind].label}</small>
                <ul className={styles.list}>
                  {group.items.map((item) => (
                    <li key={item.id} className={styles.item}>
                      <KindIcon kind={item.kind} className={styles.icon} />
                      <div className={styles.itemMain}>
                        <strong>{item.label}</strong>
                        <small>
                          {item.times.length ? item.times.map((t) => formatClock(t)).join(', ') : 'No time set'} · {formatDays(item.days)}
                          {item.dose ? ` · ${item.dose}` : ''}{item.alarm ? ' · Alarm' : ''}{item.public ? ' · On scan page' : ''}
                        </small>
                      </div>
                      {confirmDelete === item.id ? (
                        <div className={styles.itemActions}>
                          <button type="button" className="dangerButton" disabled={busy} onClick={() => deleteItem(item.id)}>Delete</button>
                          <button type="button" onClick={() => setConfirmDelete(null)}>Keep</button>
                        </div>
                      ) : (
                        <div className={styles.itemActions}>
                          <button type="button" onClick={() => { setDraft(draftFromItem(item)); setMessage(''); }}>Edit</button>
                          <button type="button" className={styles.danger} onClick={() => setConfirmDelete(item.id)} aria-label={`Delete ${item.label}`}>Delete</button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        <div className={styles.section}>
          <p className={styles.sectionHead}>Alarms</p>
          <p className="mutedLine">Alarms ring while MyPetID is open (or installed) on this device: a chime, a reminder on screen and, if you allow it, a system alert.</p>
          {permission && permission !== 'unsupported' && permission !== 'granted' && (
            <div className="actions compact">
              <button type="button" onClick={request} disabled={permission === 'denied'}><Bell /> Allow alerts on this device</button>
              {permission === 'denied' && <span className="formHint">Alerts are blocked. Turn them on in your browser&apos;s site settings.</span>}
            </div>
          )}
          {permission === 'granted' && <p className="formHint"><Check /> System alerts are on for this device.</p>}
          {permission === 'unsupported' && <p className="formHint">This browser can&apos;t show system alerts, but the chime and on-screen reminder still work.</p>}
        </div>
      </div>

      <ToastStack toasts={toasts} onDismiss={dismiss} onDone={(t) => { dismiss(t.key); const item = pets.find((p) => p.id === t.petId)?.schedule.find((i) => i.id === t.itemId); if (item) void done(t.petId, item); }} />
    </section>
  );
}

// ---------- dashboard widget ----------

export function NextUpWidget() {
  const { db, pets, updateProfile } = useOwnerPets();
  const now = useNow();
  const { toasts, dismiss } = useCareAlarms(pets);
  const [message, setMessage] = useState('');

  const next = useMemo(() => {
    if (!now) return [];
    const all: (UpcomingEntry & { pet: CarePet })[] = [];
    for (const pet of pets) {
      for (const entry of upcoming(pet.schedule, now, pet.timeZone, 3, { graceMs: OWNER_GRACE_MS, log: pet.log })) all.push({ ...entry, pet });
    }
    return all.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, 3);
  }, [pets, now]);

  const done = useCallback(async (petId: string, item: Pick<CareItem, 'id' | 'label'>) => {
    const error = await markDone(updateProfile, petId, item.id);
    setMessage(error || `Marked ${item.label} as done.`);
  }, [updateProfile]);

  if (db === 'noClient' || db === 'signedOut' || db === 'error') return null;
  const many = pets.length > 1;

  return (
    <section className="panel">
      <div className="panelTitleRow">
        <div><p className="eyebrow"><Bell /> Next up</p><h2>Care today</h2></div>
        <span className="iconBubble violet"><Bell /></span>
      </div>
      {message && <p className="authMessage" role="status">{message}</p>}
      {db === 'loading' || !now ? <p className="mutedLine">Loading…</p> : next.length === 0 ? (
        <p className="mutedLine">{db === 'noPets' ? 'Save your pet to the cloud to set up care reminders.' : 'No reminders yet. Add meals, walks and medicine in the care schedule.'}</p>
      ) : (
        <ul className={styles.list}>
          {next.map(({ item, at, ms, pet }) => (
            <li key={`${pet.id}:${item.id}`} className={styles.item}>
              <KindIcon kind={item.kind} className={styles.icon} />
              <div className={styles.itemMain}>
                <strong>{many ? `${pet.name}: ` : ''}{item.label}</strong>
                <small>{formatInstant(at)} {dayWord(at, now)}</small>
              </div>
              <span className={countdownClass(ms)}>{formatCountdown(ms)}</span>
              <div className={styles.itemActions}>
                <button type="button" onClick={() => done(pet.id, item)}><Check /> Done</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <ToastStack toasts={toasts} onDismiss={dismiss} onDone={(t) => { dismiss(t.key); const item = pets.find((p) => p.id === t.petId)?.schedule.find((i) => i.id === t.itemId); if (item) void done(t.petId, item); }} />
    </section>
  );
}

// ---------- public scan page ----------

const URGENT_AHEAD_MS = 3 * 60 * 60_000;
const URGENT_OVERDUE_MS = 2 * 60 * 60_000;

function urgentHeadline(petName: string, item: CareItem, ms: number) {
  const when = formatCountdown(ms);
  const timing = when === 'now' ? 'now' : ms > 0 ? when : `(${when})`;
  if (item.kind === 'medicine') {
    const what = item.label && item.label.toLowerCase() !== 'medicine' ? `medicine (${item.label})` : 'medicine';
    return `${petName} needs ${what} ${timing}`;
  }
  if (item.kind === 'meal') return `${petName} is due a meal ${timing}`;
  if (item.kind === 'walk') return `${petName} is due a walk ${timing}`;
  return `${petName} is due: ${item.label} ${timing}`;
}

export function PublicCareCountdown({ schedule, timeZone, petName, lost }: { schedule: unknown[]; timeZone: string; petName: string; lost: boolean }) {
  const now = useNow();
  const name = petName.trim() || 'This pet';
  const items = useMemo(() => parseSchedule(schedule).filter((i) => i.public && i.times.length), [schedule]);
  const tz = isValidTimeZone(timeZone) ? timeZone : 'UTC';

  const view = useMemo(() => {
    if (!now || !items.length) return null;
    const list = upcoming(items, now, tz, items.length, { graceMs: URGENT_OVERDUE_MS });
    const urgent = list.filter((e) => e.ms <= URGENT_AHEAD_MS && e.ms >= -URGENT_OVERDUE_MS)
      .sort((a, b) => Number(b.item.kind === 'medicine') - Number(a.item.kind === 'medicine') || a.at.getTime() - b.at.getTime())[0];
    if (urgent) return { urgent, calm: null };
    const calm = upcoming(items, now, tz, 1)[0] || null;
    return { urgent: null, calm };
  }, [items, now, tz]);

  if (!view || !now) return null;

  if (view.urgent) {
    const { item, at, ms } = view.urgent;
    const red = item.kind === 'medicine' && lost;
    const extra = [item.dose, item.note].filter(Boolean).join(' · ');
    return (
      <div className={`${styles.alert} ${red ? styles.alertRed : ''}`} role={red ? 'alert' : 'status'} aria-live="polite">
        <strong><KindGlyph kind={item.kind} /> {urgentHeadline(name, item, ms)}</strong>
        <p className="mutedLine">Due at {formatInstant(at)} {dayWord(at, now)} (your time).</p>
        {extra && <p>{extra}</p>}
        {lost && (item.kind === 'medicine'
          ? <p><strong>Please get {name} to the owner or a vet soon.</strong></p>
          : <p>Please contact the owner using the details on this page.</p>)}
      </div>
    );
  }

  if (!view.calm) return null;
  const { item, at } = view.calm;
  const what = item.kind === 'medicine' || item.kind === 'other' ? item.label : `${KIND_META[item.kind].label.toLowerCase()}`;
  return (
    <p className={`mutedLine ${styles.calm}`}><KindGlyph kind={item.kind} /> Next {what} at {formatInstant(at)}{dayWord(at, now) === 'today' ? '' : ` ${dayWord(at, now)}`}</p>
  );
}

function KindGlyph({ kind }: { kind: CareKind }) {
  const Icon = ICONS[KIND_META[kind].icon];
  return <Icon />;
}
