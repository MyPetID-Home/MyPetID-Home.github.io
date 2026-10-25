"use client";

import { useCallback, useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { hourOptions } from '../lib/clock';
import { MascotPeek } from './mascot';
import { Bell, Calendar, ChevronRight, Close as X, FileText, Footprints, MapPinned, PawPrint, Plus } from './icons';

/**
 * Layout pieces modelled on how MemoPet sets up its pages (in MyPetID colors): the dog header,
 * a row of round section icons, stacked summary cards on Home, and bottom sheets for details.
 */

type IconType = ComponentType<{ className?: string }>;

export function PetStrip({ name, photoUrl, onEdit, children }: { name: string; photoUrl: string; onEdit?: () => void; children?: ReactNode }) {
  return (
    <section className="petStrip">
      <div className="petStripPhoto">
        <img src={photoUrl || '/images/logo/MyPetID-Logo_Resized.jpg'} alt={name} />
        {onEdit && <button type="button" className="petStripEdit" aria-label={`Edit ${name}’s profile`} onClick={onEdit}><PawPrint /></button>}
      </div>
      <div className="petStripName"><small>Name</small><strong>{name}</strong></div>
      {children}
    </section>
  );
}

export type IconSection<T extends string> = { key: T; label: string; icon: IconType };

export function IconSectionRail<T extends string>({ items, active, onPick, label }: { items: IconSection<T>[]; active: T; onPick: (key: T) => void; label: string }) {
  return (
    <nav className="iconSectionRail" aria-label={label}>
      {items.map(({ key, label: text, icon: Icon }) => (
        <button key={key} type="button" className={active === key ? 'active' : ''} aria-current={active === key ? 'page' : undefined} onClick={() => onPick(key)}>
          <span className="iconSectionDot"><Icon /></span><span>{text}</span>
        </button>
      ))}
    </nav>
  );
}

/** A white card with a titled header row, like MemoPet's home cards. */
export function SummaryCard({ title, icon: Icon, onOpen, openLabel, children }: { title: string; icon: IconType; onOpen?: () => void; openLabel?: string; children: ReactNode }) {
  return (
    <section className="memoCard">
      <header className="memoCardHead"><h3>{title}</h3>{onOpen ? <button type="button" className="memoCardLink" onClick={onOpen}>{openLabel || 'Open'} <ChevronRight /></button> : <span className="memoCardIcon"><Icon /></span>}</header>
      {children}
    </section>
  );
}

export function BottomSheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="sheetScrim" onClick={onClose}>
      <div className="bottomSheet" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <header className="sheetHead"><h3>{title}</h3><button type="button" className="sheetClose" aria-label="Close" onClick={onClose}><X /></button></header>
        <div className="sheetBody">{children}</div>
      </div>
    </div>
  );
}

// ---------- appointments (pet_care_events) ----------

export type Appointment = { id: string; pet_id: string; event_type: string; title: string; notes: string | null; scheduled_for: string | null; completed_at: string | null };
const TAG_RE = /^\[(memopet|clyde-demo)\]\s*/;
const cleanNote = (note: string | null) => (note || '').replace(TAG_RE, '');

function whenParts(iso: string | null) {
  if (!iso) return { date: 'No date', time: '' };
  const d = new Date(iso);
  return { date: d.toLocaleDateString(undefined, { month: '2-digit', day: '2-digit', year: 'numeric' }), time: d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', ...hourOptions() }) };
}

function useCloudPet() {
  const [pet, setPet] = useState<{ id: string; owner_id: string; name: string } | null>(null);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(async ({ data }) => {
      const uid = data.session?.user.id;
      if (!uid || !supabase) return;
      const { data: row } = await supabase.from('pets').select('id,owner_id,name').eq('owner_id', uid).order('created_at').limit(1).maybeSingle();
      if (row) setPet(row as { id: string; owner_id: string; name: string });
    });
  }, []);
  return pet;
}

export function useAppointments() {
  const pet = useCloudPet();
  const [items, setItems] = useState<Appointment[]>([]);
  const load = useCallback(async () => {
    if (!supabase || !pet) return;
    const { data } = await supabase.from('pet_care_events').select('id,pet_id,event_type,title,notes,scheduled_for,completed_at').eq('pet_id', pet.id).order('scheduled_for', { ascending: true });
    setItems((data || []) as Appointment[]);
  }, [pet]);
  useEffect(() => { void load(); }, [load]);
  const upcoming = items.filter((a) => !a.completed_at && a.scheduled_for && new Date(a.scheduled_for).getTime() > Date.now() - 86_400_000);
  const history = items.filter((a) => a.completed_at).sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || ''));
  return { pet, upcoming, history, reload: load };
}

export function AppointmentList({ items, limit, onPick }: { items: Appointment[]; limit?: number; onPick?: (a: Appointment) => void }) {
  const shown = limit ? items.slice(0, limit) : items;
  if (!shown.length) return <div className="memoEmpty"><MascotPeek size={54} /><p className="formHint">Nothing scheduled yet.</p></div>;
  return (
    <ul className="memoRows">{shown.map((a) => { const w = whenParts(a.scheduled_for); return (
      <li key={a.id}>{onPick
        ? <button type="button" className="memoRow" onClick={() => onPick(a)}><span className="memoRowDate">{w.date}</span><span className="memoRowTitle">{a.title}</span><span className="memoRowTime">{w.time}</span></button>
        : <div className="memoRow"><span className="memoRowDate">{w.date}</span><span className="memoRowTitle">{a.title}</span><span className="memoRowTime">{w.time}</span></div>}</li>
    ); })}</ul>
  );
}

/** Full appointments section: list, add form, and a details sheet (delete asks first). */
export function AppointmentsSection() {
  const { pet, upcoming, history, reload } = useAppointments();
  const [open, setOpen] = useState<Appointment | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ title: '', date: '', time: '12:00', notes: '' });
  const [message, setMessage] = useState('');

  if (!supabase) return null;
  if (!pet) return <section className="memoCard"><p className="formHint">Sign in to keep appointments in your account.</p></section>;

  async function add(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase || !pet || !draft.title.trim() || !draft.date) return;
    const { error } = await supabase.from('pet_care_events').insert({ pet_id: pet.id, owner_id: pet.owner_id, event_type: 'appointment', title: draft.title.trim(), notes: draft.notes.trim() || null, scheduled_for: new Date(`${draft.date}T${draft.time || '12:00'}`).toISOString() });
    if (error) return setMessage(error.message);
    setDraft({ title: '', date: '', time: '12:00', notes: '' });
    setAdding(false);
    setMessage('Appointment added.');
    void reload();
  }
  async function markDone(a: Appointment) {
    if (!supabase) return;
    const { error } = await supabase.from('pet_care_events').update({ completed_at: new Date().toISOString() }).eq('id', a.id);
    if (error) return setMessage(error.message);
    setOpen(null); setMessage('Marked as done.'); void reload();
  }
  async function remove(a: Appointment) {
    if (!supabase || !window.confirm(`Delete “${a.title}”? This can’t be undone.`)) return;
    const { error } = await supabase.from('pet_care_events').delete().eq('id', a.id);
    if (error) return setMessage(error.message);
    setOpen(null); setMessage('Deleted.'); void reload();
  }

  return (
    <section className="memoCard full">
      <header className="memoCardHead"><h3>Appointments</h3><span className="memoCardIcon"><Calendar /></span></header>
      <p className="formHint">{pet.name}’s agenda. Add vet visits, vaccines and renewals and they show on Home.</p>
      {message && <p className="authMessage" role="status">{message}</p>}
      {adding ? (
        <form onSubmit={add} className="memoForm">
          <label>What<input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Rabies vaccine" required maxLength={120} /></label>
          <div className="grid2">
            <label>Day<input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} required /></label>
            <label>Time<input type="time" value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} /></label>
          </div>
          <label>Note<textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} maxLength={1000} /></label>
          <div className="actions"><button type="button" onClick={() => setAdding(false)}>Cancel</button><button className="primary" type="submit">Save appointment</button></div>
        </form>
      ) : <button className="memoAdd" type="button" onClick={() => { setMessage(''); setAdding(true); }}><span><Plus /></span> Add appointment</button>}
      <AppointmentList items={upcoming} onPick={setOpen} />
      {history.length > 0 && <details className="legacyDetails"><summary>History ({history.length})</summary><AppointmentList items={history} onPick={setOpen} /></details>}
      {open && <BottomSheet title="Appointment" onClose={() => setOpen(null)}>
        <dl className="sheetFields">
          <dt>Description</dt><dd>{open.title}</dd>
          <dt>Day</dt><dd>{whenParts(open.scheduled_for).date}</dd>
          <dt>Time</dt><dd>{whenParts(open.scheduled_for).time || '—'}</dd>
          <dt>Note</dt><dd>{cleanNote(open.notes) || '—'}</dd>
          {open.completed_at && <><dt>Done</dt><dd>{whenParts(open.completed_at).date}</dd></>}
        </dl>
        <div className="actions">{!open.completed_at && <button className="primary" type="button" onClick={() => markDone(open)}>Mark as done</button>}<button type="button" className="dangerLink" onClick={() => remove(open)}>Delete</button></div>
      </BottomSheet>}
    </section>
  );
}

// ---------- Home ----------

export type HomeData = {
  petName: string; ownerName: string; ownerPhone: string; vetName: string; vetPhone: string; microchip: string; age: string;
  documents: { id: number; title: string; kind: string; url?: string }[];
  latestWalk: { label: string; detail: string } | null;
  lastScan: string; alertCount: number;
};

/** MemoPet-style Home: Today, Location, Data, Upcoming appointments, Documents, Latest walk. */
export function HomeSummary({ data, today, go }: { data: HomeData; today: ReactNode; go: (target: 'diet' | 'lost' | 'pets' | 'care' | 'docs' | 'walks') => void }) {
  const { upcoming } = useAppointments();
  const rows: [string, string][] = [['Owner', data.ownerName], ['Owner’s phone', data.ownerPhone], ['Vet', data.vetName], ['Vet’s phone', data.vetPhone], ['Microchip', data.microchip], ['Age', data.age]];
  return (
    <div className="memoStack">
      <SummaryCard title="Today" icon={PawPrint} onOpen={() => go('diet')} openLabel="Schedule">{today}</SummaryCard>
      <SummaryCard title="Location" icon={MapPinned} onOpen={() => go('lost')} openLabel="History">
        <button type="button" className="memoLine" onClick={() => go('lost')}><span>{data.alertCount > 0 ? `${data.alertCount} alert${data.alertCount === 1 ? '' : 's'} to review` : data.lastScan || 'If someone scans your tag, you’ll get a notification with the link to where they found your dog.'}</span><ChevronRight /></button>
      </SummaryCard>
      <SummaryCard title="Data" icon={PawPrint} onOpen={() => go('pets')} openLabel="Edit">
        <dl className="memoData">{rows.filter(([, v]) => v).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      </SummaryCard>
      <SummaryCard title="Upcoming appointments" icon={Calendar} onOpen={() => go('care')} openLabel="All"><AppointmentList items={upcoming} limit={3} /></SummaryCard>
      <SummaryCard title="Documents" icon={FileText} onOpen={() => go('docs')} openLabel="All">
        {data.documents.length === 0 ? <p className="formHint">No documents yet.</p> : <div className="memoDocs">{data.documents.slice(0, 6).map((d) => <button key={d.id} type="button" onClick={() => go('docs')} className="memoDoc">{d.url && /^(data:image|https?:)/.test(d.url) ? <img src={d.url} alt="" loading="lazy" /> : <span className="memoDocIcon"><FileText /></span>}<span>{d.title}</span></button>)}</div>}
      </SummaryCard>
      <SummaryCard title="Latest walk" icon={Footprints} onOpen={() => go('walks')} openLabel="Walks">
        <button type="button" className="memoLine" onClick={() => go('walks')}><span>{data.latestWalk ? <><strong>{data.latestWalk.label}</strong> · {data.latestWalk.detail}</> : 'No walks yet. Start one from Walks.'}</span><ChevronRight /></button>
      </SummaryCard>
    </div>
  );
}
