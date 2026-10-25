"use client";

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { hourOptions } from '../lib/clock';
import { BottomSheet } from './memo-layout';
import { MascotPeek } from './mascot';
import { MapPinned } from './icons';

/**
 * Lost mode and finder reports from the account: pets.lost_mode and the scan_events finders
 * create when they scan the tag (owners can read and follow up on their own dogs' scans).
 */
type ScanEvent = { id: string; pet_id: string; latitude: number | null; longitude: number | null; accuracy_meters: number | null; note: string | null; reported_lost: boolean | null; created_at: string; found_status: string | null; finder_contact: string | null; finder_note: string | null; owner_follow_up: string | null; owner_resolution_note: string | null; resolved_at: string | null };
type Pet = { id: string; name: string; lost_mode: boolean };
export const ALERTS_EVENT = 'mypetid:alerts';

export function useFinderReports() {
  const [pets, setPets] = useState<Pet[]>([]);
  const [events, setEvents] = useState<ScanEvent[]>([]);
  const [ready, setReady] = useState(false);
  const load = useCallback(async () => {
    if (!supabase) return setReady(true);
    const { data: auth } = await supabase.auth.getSession();
    const uid = auth.session?.user.id;
    if (!uid) return setReady(true);
    const { data: rows } = await supabase.from('pets').select('id,name,lost_mode').eq('owner_id', uid).order('created_at');
    const list = (rows || []) as Pet[];
    setPets(list);
    if (list.length) {
      const { data } = await supabase.from('scan_events').select('id,pet_id,latitude,longitude,accuracy_meters,note,reported_lost,created_at,found_status,finder_contact,finder_note,owner_follow_up,owner_resolution_note,resolved_at').in('pet_id', list.map((p) => p.id)).order('created_at', { ascending: false }).limit(50);
      setEvents((data || []) as ScanEvent[]);
    }
    setReady(true);
  }, []);
  useEffect(() => {
    void load();
    const reload = () => void load();
    window.addEventListener(ALERTS_EVENT, reload);
    return () => window.removeEventListener(ALERTS_EVENT, reload);
  }, [load]);
  const open = events.filter((e) => !e.resolved_at && (e.reported_lost || e.found_status || e.finder_note || e.finder_contact || (e.latitude !== null && e.longitude !== null)));
  return { pets, events, open, ready, reload: load };
}

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', ...hourOptions() });
const mapLink = (e: ScanEvent) => `https://www.openstreetmap.org/?mlat=${e.latitude}&mlon=${e.longitude}#map=17/${e.latitude}/${e.longitude}`;

export function FinderReports() {
  const { pets, events, ready, reload } = useFinderReports();
  const [openEvent, setOpenEvent] = useState<ScanEvent | null>(null);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  if (!supabase || !ready) return null;
  if (!pets.length) return <section className="memoCard full"><header className="memoCardHead"><h3>Lost & found</h3></header><p className="formHint">Sign in and add your dog to your account to get finder alerts when someone scans the tag.</p></section>;

  async function setLost(pet: Pet, lost: boolean) {
    if (!supabase) return;
    if (lost && !window.confirm(`Turn on lost mode for ${pet.name}? Anyone who scans the tag will see that ${pet.name} is lost and how to reach you.`)) return;
    const { error } = await supabase.from('pets').update({ lost_mode: lost }).eq('id', pet.id);
    if (error) return setMessage(error.message);
    setMessage(lost ? `Lost mode is on for ${pet.name}. Finders who scan the tag are asked to share where they are.` : `${pet.name} is marked safe.`);
    window.dispatchEvent(new CustomEvent(ALERTS_EVENT));
    void reload();
  }
  async function resolve(e: ScanEvent) {
    if (!supabase) return;
    const { error } = await supabase.from('scan_events').update({ resolved_at: new Date().toISOString(), owner_resolution_note: note.trim() || 'Handled by owner' }).eq('id', e.id);
    if (error) return setMessage(error.message);
    setOpenEvent(null); setNote(''); setMessage('Report marked as handled.');
    window.dispatchEvent(new CustomEvent(ALERTS_EVENT));
    void reload();
  }
  const petName = (id: string) => pets.find((p) => p.id === id)?.name || 'Your dog';

  return (
    <section className="memoCard full">
      <header className="memoCardHead"><h3>Lost & found</h3><span className="memoCardIcon"><MapPinned /></span></header>
      {message && <p className="authMessage" role="status">{message}</p>}
      <div className="lostToggles">{pets.map((p) => (
        <div key={p.id} className={`lostToggle ${p.lost_mode ? 'on' : ''}`}>
          <div><strong>{p.name}</strong><small>{p.lost_mode ? 'Lost mode is ON: the tag page asks finders for help' : 'Safe at home'}</small></div>
          {p.lost_mode ? <button type="button" onClick={() => setLost(p, false)}>Mark found</button> : <button type="button" className="dangerButton" onClick={() => setLost(p, true)}>{p.name} is lost</button>}
        </div>
      ))}</div>
      <h4 style={{ margin: '16px 0 8px' }}>Finder reports</h4>
      {events.length === 0 ? <div className="memoEmpty"><MascotPeek size={54} /><p className="formHint">No scans yet. When someone scans the tag you’ll see it here and get a notification.</p></div> : (
        <ul className="memoRows">{events.map((e) => (
          <li key={e.id}><button type="button" className={`memoRow scanRow ${e.resolved_at ? 'resolved' : ''}`} onClick={() => { setNote(''); setOpenEvent(e); }}>
            <span className="memoRowDate">{when(e.created_at)}</span>
            <span className="memoRowTitle">{petName(e.pet_id)} · {e.resolved_at ? 'Handled' : e.found_status || (e.reported_lost ? 'Found while lost' : 'Tag scanned')}{e.finder_note ? ` · “${e.finder_note}”` : ''}</span>
            <span className="memoRowTime">{e.latitude !== null ? 'Location' : 'No location'}</span>
          </button></li>
        ))}</ul>
      )}
      {openEvent && <BottomSheet title={`${petName(openEvent.pet_id)} was scanned`} onClose={() => setOpenEvent(null)}>
        <dl className="sheetFields">
          <dt>When</dt><dd>{when(openEvent.created_at)}</dd>
          <dt>Status</dt><dd>{openEvent.found_status || (openEvent.reported_lost ? 'Found while lost' : 'Tag scanned')}</dd>
          {openEvent.finder_note && <><dt>Finder says</dt><dd>{openEvent.finder_note}</dd></>}
          {openEvent.finder_contact && <><dt>Finder contact</dt><dd>{openEvent.finder_contact}</dd></>}
          <dt>Location</dt><dd>{openEvent.latitude !== null && openEvent.longitude !== null ? <a href={mapLink(openEvent)} target="_blank" rel="noopener noreferrer">Open the map{openEvent.accuracy_meters ? ` (within ${Math.round(openEvent.accuracy_meters)} m)` : ''}</a> : 'The finder did not share a location'}</dd>
          {openEvent.resolved_at && <><dt>Handled</dt><dd>{when(openEvent.resolved_at)}{openEvent.owner_resolution_note ? ` · ${openEvent.owner_resolution_note}` : ''}</dd></>}
        </dl>
        {!openEvent.resolved_at && <><label>Note (optional)<input value={note} onChange={(ev) => setNote(ev.target.value)} placeholder="Picked him up, all good" maxLength={300} /></label>
          <div className="actions"><button className="primary" type="button" onClick={() => resolve(openEvent)}>Mark as handled</button></div></>}
      </BottomSheet>}
    </section>
  );
}
