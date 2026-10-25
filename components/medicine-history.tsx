"use client";

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Heart } from './icons';

/**
 * Medicine history: what each medicine was for, how it was given, whether it worked and any
 * side effects, so owners (and their vet) can see what happened. Stored in pets.profile.medications.
 */
export type Outcome = 'worked' | 'partly' | 'did_not_work' | 'stopped_side_effects' | 'too_early' | 'unknown';
export const OUTCOMES: { key: Outcome; label: string; tone: string }[] = [
  { key: 'worked', label: 'It worked', tone: 'green' },
  { key: 'partly', label: 'Partly worked', tone: 'blue' },
  { key: 'did_not_work', label: 'Didn’t work', tone: 'red' },
  { key: 'stopped_side_effects', label: 'Stopped: side effects', tone: 'red' },
  { key: 'too_early', label: 'Too early to tell', tone: '' },
  { key: 'unknown', label: 'Not sure', tone: '' },
];

export type Medication = { id: string; name: string; reason: string; dose: string; started: string; planned: string; stopped: string; outcome: Outcome; side_effects: string; ongoing: boolean; tell_vet: boolean };
const EMPTY: Medication = { id: '', name: '', reason: '', dose: '', started: '', planned: '', stopped: '', outcome: 'too_early', side_effects: '', ongoing: false, tell_vet: false };

const str = (v: unknown) => (typeof v === 'string' ? v : '');
export function parseMedications(raw: unknown): Medication[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((m) => m && typeof m === 'object').map((m: Record<string, unknown>, i) => ({
    id: str(m.id) || `med-${i}`, name: str(m.name), reason: str(m.reason), dose: str(m.dose), started: str(m.started), planned: str(m.planned), stopped: str(m.stopped),
    outcome: (OUTCOMES.some((o) => o.key === m.outcome) ? m.outcome : 'unknown') as Outcome,
    side_effects: str(m.side_effects), ongoing: Boolean(m.ongoing), tell_vet: Boolean(m.tell_vet),
  })).filter((m) => m.name);
}

function fmt(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function MedicineHistory() {
  const [pets, setPets] = useState<{ id: string; name: string; profile: Record<string, unknown> }[]>([]);
  const [petId, setPetId] = useState('');
  const [editing, setEditing] = useState<Medication | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase.from('pets').select('id,name,profile').eq('owner_id', session.user.id).order('created_at');
    const list = ((data || []) as { id: string; name: string; profile: Record<string, unknown> | null }[]).map((p) => ({ ...p, profile: p.profile || {} }));
    setPets(list);
    setPetId((current) => current && list.some((p) => p.id === current) ? current : list[0]?.id || '');
  }, []);
  useEffect(() => { void load(); }, [load]);

  const pet = pets.find((p) => p.id === petId);
  if (!pet) return null;
  const meds = parseMedications(pet.profile.medications);

  async function save(list: Medication[], note: string) {
    if (!supabase || !pet) return;
    setBusy(true);
    // Re-read so other profile keys saved elsewhere (care schedule, card) are kept.
    const { data: fresh } = await supabase.from('pets').select('profile').eq('id', pet.id).maybeSingle();
    const profile = { ...((fresh as { profile?: Record<string, unknown> } | null)?.profile || {}), medications: list };
    const { error } = await supabase.from('pets').update({ profile }).eq('id', pet.id);
    setBusy(false);
    if (error) return setMessage(error.message);
    setPets((all) => all.map((p) => p.id === pet.id ? { ...p, profile } : p));
    setEditing(null);
    setMessage(note);
  }
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!editing || !editing.name.trim()) return;
    const item = { ...editing, id: editing.id || `med-${Date.now()}`, name: editing.name.trim() };
    void save(editing.id ? meds.map((m) => m.id === editing.id ? item : m) : [item, ...meds], 'Medicine saved.');
  }
  function remove(med: Medication) {
    if (!window.confirm(`Remove ${med.name} from ${pet!.name}’s medicine history?`)) return;
    void save(meds.filter((m) => m.id !== med.id), 'Removed.');
  }
  const set = (patch: Partial<Medication>) => editing && setEditing({ ...editing, ...patch });

  return (
    <section className="panel full medicineHistory">
      <div className="panelTitleRow"><div><p className="eyebrow">Saved to your account</p><h2>Medicine history</h2></div>
        {pets.length > 1 && <select value={petId} onChange={(e) => setPetId(e.target.value)} aria-label="Choose dog" style={{ width: 'auto' }}>{pets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>}
        <span className="iconBubble red"><Heart /></span></div>
      <p className="formHint">Track what each medicine was for, whether it worked, and any side effects. Share it with your vet before new prescriptions.</p>
      {message && <p className="authMessage" role="status">{message}</p>}

      {editing ? (
        <form onSubmit={submit}>
          <div className="grid2">
            <label>Medicine<input value={editing.name} onChange={(e) => set({ name: e.target.value })} placeholder="Doxycycline 100mg" required maxLength={80} /></label>
            <label>What it was for<input value={editing.reason} onChange={(e) => set({ reason: e.target.value })} placeholder="Lyme disease" maxLength={80} /></label>
            <label>Dose and how often<input value={editing.dose} onChange={(e) => set({ dose: e.target.value })} placeholder="1 tablet every 12 hours" maxLength={120} /></label>
            <label>Planned length<input value={editing.planned} onChange={(e) => set({ planned: e.target.value })} placeholder="One month" maxLength={40} /></label>
            <label>Started<input type="date" value={editing.started} onChange={(e) => set({ started: e.target.value })} /></label>
            <label>Stopped<input type="date" value={editing.stopped} onChange={(e) => set({ stopped: e.target.value })} /></label>
          </div>
          <h3>Did it work?</h3>
          <div className="chipCloud" role="radiogroup" aria-label="Did it work?">{OUTCOMES.map((o) => <button key={o.key} type="button" role="radio" aria-checked={editing.outcome === o.key} className={editing.outcome === o.key ? 'activeMini' : ''} onClick={() => set({ outcome: o.key })}>{o.label}</button>)}</div>
          <label>Side effects or changes you noticed<textarea value={editing.side_effects} onChange={(e) => set({ side_effects: e.target.value })} maxLength={2000} placeholder="Behavior, appetite, drinking, sleep, stomach, skin…" /></label>
          <label className="toggleRow"><input type="checkbox" checked={editing.ongoing} onChange={(e) => set({ ongoing: e.target.checked })} /> The side effects are still happening</label>
          <label className="toggleRow"><input type="checkbox" checked={editing.tell_vet} onChange={(e) => set({ tell_vet: e.target.checked })} /> Remind me to tell the vet</label>
          <div className="actions"><button type="button" onClick={() => setEditing(null)}>Cancel</button><button className="primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save medicine'}</button></div>
        </form>
      ) : (
        <div className="actions compact"><button className="primary" type="button" onClick={() => { setMessage(''); setEditing({ ...EMPTY }); }}>Add a medicine</button></div>
      )}

      {meds.length === 0 ? <p className="formHint">No medicines logged yet.</p> : <ul className="medList">{meds.map((m) => {
        const outcome = OUTCOMES.find((o) => o.key === m.outcome)!;
        return (
          <li key={m.id} className={`medItem ${outcome.tone}`}>
            <div className="medHead"><strong>{m.name}</strong><span className={`medOutcome ${outcome.tone}`}>{outcome.label}</span></div>
            {m.reason && <p>For {m.reason}{m.dose ? ` · ${m.dose}` : ''}</p>}
            <p className="formHint">{m.started ? `Started ${fmt(m.started)}` : ''}{m.stopped ? ` · stopped ${fmt(m.stopped)}` : m.started ? ' · still taking' : ''}{m.planned ? ` · planned ${m.planned}` : ''}</p>
            {m.side_effects && <p className="medEffects"><strong>{m.ongoing ? 'Side effects (still happening): ' : 'Side effects: '}</strong>{m.side_effects}</p>}
            {m.tell_vet && <p className="medVet">Tell the vet about this before any new prescription.</p>}
            <div className="actions compact"><button type="button" onClick={() => { setMessage(''); setEditing(m); }}>Edit</button><button type="button" onClick={() => remove(m)}>Remove</button></div>
          </li>
        );
      })}</ul>}
    </section>
  );
}
