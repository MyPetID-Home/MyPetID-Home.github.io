"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { daysUntil, formatDay, isMissingRelation, todayIso, useOwnerPets } from '../lib/owner-pets';
import styles from './health-records.module.css';

/**
 * Vet visits, vaccines, medications/preventatives and other health records with due dates.
 * Stored in public.pet_health_records (docs/migrations/2026-10-health-sitter-poster.sql).
 * The database sends a reminder notification once per record (mypetid_health_reminders, daily);
 * this panel also flags due-soon and overdue items right away.
 */

export type HealthKind = 'visit' | 'vaccine' | 'medication' | 'other';
export type HealthRecord = {
  id: string;
  pet_id: string;
  owner_id: string;
  kind: HealthKind;
  title: string;
  given_on: string | null;
  due_on: string | null;
  clinic: string | null;
  notes: string | null;
  attachment_url: string | null;
  remind_days: number;
  reminded_at: string | null;
  created_at: string;
  updated_at: string;
};
export type HealthStatus = 'current' | 'soon' | 'overdue' | 'none' | 'replaced';

export const HEALTH_KINDS: { key: HealthKind; label: string; plural: string }[] = [
  { key: 'vaccine', label: 'Vaccine', plural: 'Vaccines' },
  { key: 'visit', label: 'Vet visit', plural: 'Vet visits' },
  { key: 'medication', label: 'Medication', plural: 'Meds & preventatives' },
  { key: 'other', label: 'Other', plural: 'Other' },
];
export const VACCINES = ['Rabies', 'DHPP', 'Bordetella', 'Leptospirosis', 'Lyme', 'Canine influenza'];
const STATUS_LABEL: Record<HealthStatus, string> = { current: 'Current', soon: 'Due soon', overdue: 'Overdue', none: 'No due date', replaced: 'Replaced' };
const COLUMNS = 'id,pet_id,owner_id,kind,title,given_on,due_on,clinic,notes,attachment_url,remind_days,reminded_at,created_at,updated_at';

const sameKey = (r: Pick<HealthRecord, 'kind' | 'title'>) => `${r.kind}:${r.title.trim().toLowerCase()}`;

/** Status for each record. A newer record with the same kind + title (e.g. this year's rabies shot) replaces older ones. */
export function healthStatuses(records: HealthRecord[], now = new Date()) {
  const latest = new Map<string, HealthRecord>();
  for (const r of records) {
    const key = sameKey(r);
    const prev = latest.get(key);
    const stamp = (x: HealthRecord) => `${x.given_on || x.due_on || ''}|${x.created_at}`;
    if (!prev || stamp(r) > stamp(prev)) latest.set(key, r);
  }
  const out = new Map<string, { status: HealthStatus; days: number | null }>();
  for (const r of records) {
    if (r.kind !== 'visit' && latest.get(sameKey(r))?.id !== r.id) { out.set(r.id, { status: 'replaced', days: null }); continue; }
    if (!r.due_on) { out.set(r.id, { status: 'none', days: null }); continue; }
    const days = daysUntil(r.due_on, now);
    out.set(r.id, { status: days < 0 ? 'overdue' : days <= Math.max(r.remind_days, 0) ? 'soon' : 'current', days });
  }
  return out;
}

function dueWords(days: number) {
  if (days === 0) return 'due today';
  if (days === 1) return 'due tomorrow';
  if (days > 0) return days < 60 ? `in ${days} days` : `in ${Math.round(days / 30)} months`;
  return -days === 1 ? '1 day overdue' : `${-days} days overdue`;
}

function addYears(iso: string, years: number) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y + years, m - 1, d));
  return date.toISOString().slice(0, 10);
}
function addMonths(iso: string, months: number) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1 + months, d));
  return date.toISOString().slice(0, 10);
}

type Draft = { id: string | null; kind: HealthKind; vaccine: string; title: string; given_on: string; due_on: string; clinic: string; notes: string; attachment_url: string; remind_days: string; rabies_tag: string; save_tag: boolean };

function emptyDraft(kind: HealthKind, clinic: string, rabiesTag: string): Draft {
  return { id: null, kind, vaccine: kind === 'vaccine' ? 'Rabies' : '', title: '', given_on: todayIso(), due_on: '', clinic, notes: '', attachment_url: '', remind_days: '14', rabies_tag: rabiesTag, save_tag: false };
}

function StatusChip({ status, days }: { status: HealthStatus; days: number | null }) {
  return <span className={`${styles.chip} ${styles[status]}`}>{STATUS_LABEL[status]}{days !== null && status !== 'current' ? ` · ${dueWords(days)}` : ''}</span>;
}

export function HealthRecords({ petId, dogName }: { petId?: string; dogName?: string }) {
  const { state, pets, pet, selected, setSelected, error: petError, reload: reloadPets } = useOwnerPets(petId);
  const [records, setRecords] = useState<HealthRecord[] | null>(null);
  const [filter, setFilter] = useState<HealthKind | 'all'>('all');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [message, setMessage] = useState('');
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); }, []);

  const clinic = String(pet?.profile?.vet?.clinic || '');
  const rabiesTag = String(pet?.profile?.details?.rabies_tag || '');
  const name = pet?.name || dogName || 'your dog';

  const load = useCallback(async () => {
    if (!supabase || !pet) return;
    const { data, error } = await supabase.from('pet_health_records').select(COLUMNS).eq('pet_id', pet.id).order('due_on', { ascending: true, nullsFirst: false });
    if (error) { if (isMissingRelation(error)) setMissing(true); else setMessage(error.message); setRecords([]); return; }
    setMissing(false);
    setRecords((data || []) as HealthRecord[]);
  }, [pet]);
  useEffect(() => { setRecords(null); setDraft(null); void load(); }, [load]);

  const statuses = useMemo(() => healthStatuses(records || [], now || new Date()), [records, now]);
  const comingUp = useMemo(() => (records || [])
    .filter((r) => r.due_on && ['soon', 'overdue', 'current'].includes(statuses.get(r.id)?.status || ''))
    .sort((a, b) => (a.due_on! < b.due_on! ? -1 : a.due_on! > b.due_on! ? 1 : 0)), [records, statuses]);
  const attention = comingUp.filter((r) => { const s = statuses.get(r.id)?.status; return s === 'soon' || s === 'overdue'; });
  const shown = useMemo(() => (records || [])
    .filter((r) => filter === 'all' || r.kind === filter)
    .sort((a, b) => ((b.given_on || b.due_on || b.created_at) > (a.given_on || a.due_on || a.created_at) ? 1 : -1)), [records, filter]);

  if (!supabase) return null;
  if (state === 'signedOut' || state === 'loading') return null;
  if (state === 'error') return <section className="panel wide"><p className="eyebrow">Health records</p><p className="formHint">{petError}</p></section>;
  if (state === 'noPets' || !pet) return <section className="panel wide"><p className="eyebrow">Health records</p><h2>Vaccines & vet visits</h2><p className="formHint">Add {dogName || 'your dog'} to your account to keep health records in the cloud.</p></section>;

  function startNew(kind: HealthKind) { setMessage(''); setDraft(emptyDraft(kind, clinic, rabiesTag)); }
  function startEdit(r: HealthRecord) {
    setMessage('');
    const isKnownVaccine = r.kind === 'vaccine' && VACCINES.includes(r.title);
    setDraft({ id: r.id, kind: r.kind, vaccine: r.kind === 'vaccine' ? (isKnownVaccine ? r.title : 'Other') : '', title: isKnownVaccine ? '' : r.title, given_on: r.given_on || '', due_on: r.due_on || '', clinic: r.clinic || '', notes: r.notes || '', attachment_url: r.attachment_url || '', remind_days: String(r.remind_days ?? 14), rabies_tag: rabiesTag, save_tag: false });
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase || !pet || !draft) return;
    const title = (draft.kind === 'vaccine' && draft.vaccine !== 'Other' ? draft.vaccine : draft.title).trim();
    if (!title) return setMessage('Give the record a name.');
    if (draft.given_on && draft.due_on && draft.due_on < draft.given_on) return setMessage('The due date is before the date given.');
    const link = draft.attachment_url.trim();
    if (link && !/^https?:\/\//i.test(link)) return setMessage('The document link must start with https://');
    setBusy(true);
    const { data: auth } = await supabase.auth.getSession();
    const row = {
      pet_id: pet.id, owner_id: auth.session?.user.id, kind: draft.kind, title,
      given_on: draft.given_on || null, due_on: draft.due_on || null, clinic: draft.clinic.trim() || null,
      notes: draft.notes.trim() || null, attachment_url: link || null,
      remind_days: Math.min(365, Math.max(0, Number(draft.remind_days) || 0)),
    };
    const { error } = draft.id
      ? await supabase.from('pet_health_records').update(row).eq('id', draft.id)
      : await supabase.from('pet_health_records').insert(row);
    if (error) { setBusy(false); return setMessage(isMissingRelation(error) ? 'Health records switch on after the latest database update.' : error.message); }
    let note = draft.id ? 'Record updated.' : 'Record added.';
    if (title.toLowerCase() === 'rabies' && draft.save_tag && draft.rabies_tag.trim() && draft.rabies_tag.trim() !== rabiesTag) {
      const tagError = await saveRabiesTag(draft.rabies_tag.trim());
      note += tagError ? ` The rabies tag was not saved: ${tagError}` : ' Rabies tag number saved to the profile and ID card.';
    }
    setBusy(false);
    setDraft(null);
    setMessage(note);
    await load();
  }

  /** Read-modify-write so other profile keys (care schedule, card, ...) are kept. */
  async function saveRabiesTag(tag: string): Promise<string | null> {
    if (!supabase || !pet) return 'Not signed in.';
    const fresh = await supabase.from('pets').select('profile').eq('id', pet.id).maybeSingle();
    if (fresh.error) return fresh.error.message;
    const profile = ((fresh.data as { profile?: Record<string, any> } | null)?.profile) || {};
    const next = { ...profile, details: { ...(profile.details || {}), rabies_tag: tag.slice(0, 24) } };
    const { error } = await supabase.from('pets').update({ profile: next }).eq('id', pet.id);
    if (error) return error.message;
    await reloadPets();
    return null;
  }

  async function remove(r: HealthRecord) {
    if (!supabase || !window.confirm(`Delete “${r.title}”${r.given_on ? ` from ${formatDay(r.given_on)}` : ''}?`)) return;
    const { error } = await supabase.from('pet_health_records').delete().eq('id', r.id);
    if (error) return setMessage(error.message);
    setDraft(null);
    setMessage('Record deleted.');
    await load();
  }

  const set = (patch: Partial<Draft>) => draft && setDraft({ ...draft, ...patch });
  const isRabies = draft?.kind === 'vaccine' && (draft.vaccine === 'Rabies' || (draft.vaccine === 'Other' && draft.title.trim().toLowerCase() === 'rabies'));

  return (
    <section className="panel wide">
      <div className="panelTitleRow">
        <div><p className="eyebrow">Health records</p><h2>{name}’s vaccines & vet visits</h2></div>
        {pets.length > 1 && !petId && <select value={selected} onChange={(e) => setSelected(e.target.value)} aria-label="Choose dog" style={{ width: 'auto' }}>{pets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>}
      </div>
      {missing && <p className="formHint">Health records switch on after the latest database update.</p>}
      {message && <p className="authMessage" role="status">{message}</p>}

      {!missing && <div className={styles.wrap}>
        {attention.length > 0 && <div className={styles.attention} role="status">
          <strong>{attention.length === 1 ? '1 thing needs attention' : `${attention.length} things need attention`}</strong>
          <ul className={styles.upcoming}>{attention.map((r) => { const s = statuses.get(r.id)!; return <li key={r.id}><span>{r.title} <small>· {formatDay(r.due_on)}</small></span><StatusChip status={s.status} days={s.days} /></li>; })}</ul>
        </div>}

        {comingUp.length > 0 && <div>
          <p className={styles.sectionHead}>Coming up</p>
          <ul className={styles.upcoming}>{comingUp.slice(0, 6).map((r) => { const s = statuses.get(r.id)!; return <li key={r.id}><span><strong>{r.title}</strong> <small>· {HEALTH_KINDS.find((k) => k.key === r.kind)?.label} · {formatDay(r.due_on)}</small></span><StatusChip status={s.status} days={s.days} /></li>; })}</ul>
        </div>}

        {draft ? (
          <form className={styles.form} onSubmit={save}>
            <div className="formTabs" role="tablist" aria-label="Record type">{HEALTH_KINDS.map((k) => <button key={k.key} type="button" role="tab" aria-selected={draft.kind === k.key} className={draft.kind === k.key ? 'active' : ''} onClick={() => set({ kind: k.key, vaccine: k.key === 'vaccine' ? (draft.vaccine || 'Rabies') : '' })}>{k.label}</button>)}</div>
            <div className="grid2">
              {draft.kind === 'vaccine'
                ? <label>Vaccine<select value={draft.vaccine} onChange={(e) => set({ vaccine: e.target.value })}>{VACCINES.map((v) => <option key={v}>{v}</option>)}<option value="Other">Other</option></select></label>
                : null}
              {(draft.kind !== 'vaccine' || draft.vaccine === 'Other') && <label>{draft.kind === 'visit' ? 'Reason for visit' : draft.kind === 'medication' ? 'Medication or preventative' : 'Name'}<input value={draft.title} onChange={(e) => set({ title: e.target.value })} maxLength={120} placeholder={draft.kind === 'visit' ? 'Annual checkup' : draft.kind === 'medication' ? 'Heartgard Plus' : 'Dental cleaning'} required /></label>}
              <label>{draft.kind === 'medication' ? 'Started / last given' : 'Date given'}<input type="date" value={draft.given_on} onChange={(e) => set({ given_on: e.target.value })} /></label>
              <label>{draft.kind === 'visit' ? 'Next visit (optional)' : draft.kind === 'medication' ? 'Next dose / refill' : 'Expires / due'}<input type="date" value={draft.due_on} onChange={(e) => set({ due_on: e.target.value })} /></label>
              <label>Clinic<input value={draft.clinic} onChange={(e) => set({ clinic: e.target.value })} maxLength={160} /></label>
              <label>Remind me (days before)<input inputMode="numeric" value={draft.remind_days} onChange={(e) => set({ remind_days: e.target.value.replace(/\D/g, '').slice(0, 3) })} /></label>
            </div>
            {draft.given_on && <div className={styles.presets} aria-label="Set the due date">
              <small className="formHint">Due in:</small>
              {draft.kind === 'medication'
                ? [1, 3, 6].map((m) => <button key={m} type="button" onClick={() => set({ due_on: addMonths(draft.given_on, m) })}>{m} month{m > 1 ? 's' : ''}</button>)
                : [1, 3].map((y) => <button key={y} type="button" onClick={() => set({ due_on: addYears(draft.given_on, y) })}>{y} year{y > 1 ? 's' : ''}</button>)}
              {draft.kind === 'vaccine' && <button type="button" onClick={() => set({ due_on: addMonths(draft.given_on, 6) })}>6 months</button>}
            </div>}
            {isRabies && <div className={styles.rabies}>
              <label>Rabies tag number<input value={draft.rabies_tag} onChange={(e) => set({ rabies_tag: e.target.value })} maxLength={24} placeholder="From the metal tag or certificate" /></label>
              <label className="toggleRow"><input type="checkbox" checked={draft.save_tag} onChange={(e) => set({ save_tag: e.target.checked })} /> Save it to {name}’s profile (used as the ID card license number){rabiesTag && rabiesTag !== draft.rabies_tag.trim() ? `, replacing ${rabiesTag}` : ''}</label>
            </div>}
            <label>Notes<textarea value={draft.notes} onChange={(e) => set({ notes: e.target.value })} maxLength={4000} placeholder="Lot number, dose, reactions, what the vet said" /></label>
            <label>Document link (optional)<input type="url" value={draft.attachment_url} onChange={(e) => set({ attachment_url: e.target.value })} placeholder="https://… certificate or invoice" maxLength={1000} /></label>
            <div className="actions compact">
              <button className="primary" type="submit" disabled={busy}>{busy ? 'Saving…' : draft.id ? 'Save changes' : 'Add record'}</button>
              <button type="button" onClick={() => setDraft(null)}>Cancel</button>
            </div>
          </form>
        ) : (
          <div className="actions compact">
            <button className="primary" type="button" onClick={() => startNew('vaccine')}>Add vaccine</button>
            <button type="button" onClick={() => startNew('visit')}>Add vet visit</button>
            <button type="button" onClick={() => startNew('medication')}>Add medication</button>
            <button type="button" onClick={() => startNew('other')}>Other</button>
          </div>
        )}

        {records && records.length > 0 && <div className="formTabs" role="tablist" aria-label="Filter records">
          {([['all', 'All'], ...HEALTH_KINDS.map((k) => [k.key, k.plural])] as [HealthKind | 'all', string][]).map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={filter === key} className={filter === key ? 'active' : ''} onClick={() => setFilter(key)}>{label}</button>)}
        </div>}

        {records === null ? <p className="formHint">Loading records…</p>
          : records.length === 0 ? <p className="formHint">No health records yet. Add {name}’s rabies shot first: you’ll get a reminder before it expires.</p>
          : shown.length === 0 ? <p className="formHint">Nothing in this group yet.</p>
          : <ul className={styles.list}>{shown.map((r) => {
            const s = statuses.get(r.id) || { status: 'none' as HealthStatus, days: null };
            return <li key={r.id} className={styles.item}>
              <div className={styles.itemHead}>
                <span><span className={styles.kind}>{HEALTH_KINDS.find((k) => k.key === r.kind)?.label}</span><strong>{r.title}</strong></span>
                <StatusChip status={s.status} days={s.days} />
              </div>
              <div className={styles.meta}>
                {r.given_on && <span>Given {formatDay(r.given_on)}</span>}
                {r.due_on && <span>{r.kind === 'visit' ? 'Next' : 'Due'} {formatDay(r.due_on)}</span>}
                {r.clinic && <span>{r.clinic}</span>}
                {r.due_on && <span>Reminder {r.remind_days} day{r.remind_days === 1 ? '' : 's'} before{r.reminded_at ? ' (sent)' : ''}</span>}
              </div>
              {r.notes && <p className={styles.notes}>{r.notes}</p>}
              <div className={styles.itemActions}>
                {r.attachment_url && <a className="button" href={r.attachment_url} target="_blank" rel="noopener noreferrer">Open document</a>}
                <button type="button" onClick={() => startEdit(r)}>Edit</button>
                <button type="button" className={styles.danger} onClick={() => remove(r)}>Delete</button>
              </div>
            </li>;
          })}</ul>}
      </div>}
    </section>
  );
}
