"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Footprints, MapPinned } from './icons';
import { WalkMap3D, type LngLat, type MapPin, type MapRoute } from './walk-map-3d';
import styles from './walk-planner.module.css';

/**
 * Plan loops and routes on the free 3D map, save favourite places as pins, and keep a list
 * of saved walks to do again. Data lives in map_pins / saved_walks (own rows only, via RLS).
 */

type PinKind = 'favorite' | 'park' | 'water' | 'vet' | 'parking' | 'hazard' | 'other';
type PinRow = { id: string; name: string; kind: PinKind; note: string | null; lat: number; lng: number; created_at: string };
type WalkRow = { id: string; name: string; kind: 'route' | 'recorded'; is_loop: boolean; path: LngLat[] | null; distance_mi: number | string | null; duration_min: number | null; times_walked: number | null; last_walked_at: string | null; created_at: string };
type Mode = 'plan' | 'pins' | 'walks';
type DbState = 'loading' | 'ready' | 'signedOut' | 'missing' | 'noClient' | 'error';

const VALHALLA = 'https://valhalla1.openstreetmap.de/route';
const WALK_MPH = 2.5;
const PLAN_COLOR = '#87e06f';
const SAVED_COLOR = '#57d7ff';

const PIN_KINDS: Record<PinKind, { label: string; glyph: string; tone: NonNullable<MapPin['tone']>; bubble: string }> = {
  favorite: { label: 'Favourite', glyph: '★', tone: 'gold', bubble: '' },
  park: { label: 'Park', glyph: '🐕', tone: 'brand', bubble: 'green' },
  water: { label: 'Water', glyph: '💧', tone: 'blue', bubble: 'blue' },
  vet: { label: 'Vet', glyph: '✚', tone: 'red', bubble: 'red' },
  parking: { label: 'Parking', glyph: 'P', tone: 'violet', bubble: 'violet' },
  hazard: { label: 'Hazard', glyph: '!', tone: 'red', bubble: 'red' },
  other: { label: 'Other', glyph: '•', tone: 'brand', bubble: '' },
};

/** Great-circle distance in miles between two [lng, lat] points. */
function haversineMi(a: LngLat, b: LngLat) {
  const R = 3958.8;
  const rad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * rad;
  const dLng = (b[0] - a[0]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
function pathMiles(path: LngLat[]) {
  let total = 0;
  for (let i = 1; i < path.length; i += 1) total += haversineMi(path[i - 1], path[i]);
  return total;
}
function closeLoop(path: LngLat[]): LngLat[] {
  if (path.length < 2) return path;
  const [a, b] = [path[0], path[path.length - 1]];
  return a[0] === b[0] && a[1] === b[1] ? path : [...path, a];
}
function minutesFor(miles: number) { return Math.round((miles / WALK_MPH) * 60); }
function formatMinutes(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60); const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
function toNumber(value: number | string | null | undefined) {
  const n = typeof value === 'string' ? Number(value) : value ?? 0;
  return Number.isFinite(n) ? n : 0;
}

/** Decodes a Valhalla polyline6 string into [lng, lat] pairs. */
function decodePolyline6(encoded: string): LngLat[] {
  const out: LngLat[] = [];
  let index = 0; let lat = 0; let lng = 0;
  const next = () => {
    let result = 0; let shift = 0; let byte: number;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20 && index < encoded.length);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (index < encoded.length) {
    lat += next();
    lng += next();
    out.push([lng / 1e6, lat / 1e6]);
  }
  return out;
}

async function snapRoute(points: LngLat[], signal: AbortSignal): Promise<LngLat[]> {
  const response = await fetch(VALHALLA, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ locations: points.map(([lon, lat]) => ({ lat, lon })), costing: 'pedestrian', directions_options: { units: 'miles' } }),
    signal,
  });
  if (!response.ok) throw new Error(`Routing failed (${response.status})`);
  const json = await response.json() as { trip?: { legs?: { shape?: string }[] } };
  const legs = json.trip?.legs || [];
  if (!legs.length) throw new Error('No route');
  const path: LngLat[] = [];
  for (const leg of legs) {
    const shape = leg.shape ? decodePolyline6(leg.shape) : [];
    path.push(...(path.length ? shape.slice(1) : shape));
  }
  if (path.length < 2) throw new Error('Empty route');
  return path;
}

function isMissingTable(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  return error.code === '42P01' || error.code === 'PGRST205' || /schema cache|does not exist/i.test(error.message || '');
}

export function WalkPlanner({ dogName }: { dogName: string }) {
  const dog = dogName.trim() || 'your dog';
  const [mode, setMode] = useState<Mode>('plan');
  const [db, setDb] = useState<DbState>(supabase ? 'loading' : 'noClient');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  // Plan a walk
  const [waypoints, setWaypoints] = useState<LngLat[]>([]);
  const [snap, setSnap] = useState(true);
  const [loop, setLoop] = useState(false);
  const [snapped, setSnapped] = useState<LngLat[] | null>(null);
  const [snapNote, setSnapNote] = useState('');
  const [walkName, setWalkName] = useState('');

  // Pins
  const [pins, setPins] = useState<PinRow[]>([]);
  const [addingPin, setAddingPin] = useState(false);
  const [draft, setDraft] = useState<{ lat: number; lng: number } | null>(null);
  const [pinKind, setPinKind] = useState<PinKind>('favorite');
  const [pinName, setPinName] = useState('');
  const [pinNote, setPinNote] = useState('');
  const [sharingPlace, setSharingPlace] = useState(false);

  // Saved walks
  const [walks, setWalks] = useState<WalkRow[]>([]);
  const [shownWalkId, setShownWalkId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Camera
  const [fitTo, setFitTo] = useState<'route' | 'pins' | null>(null);
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; zoom?: number; key: number } | null>(null);
  const flyKey = useRef(0);

  const load = useCallback(async () => {
    if (!supabase) { setDb('noClient'); return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setDb('signedOut'); setPins([]); setWalks([]); return; }
    const [pinRes, walkRes] = await Promise.all([
      supabase.from('map_pins').select('id, name, kind, note, lat, lng, created_at').order('created_at', { ascending: false }),
      supabase.from('saved_walks').select('id, name, kind, is_loop, path, distance_mi, duration_min, times_walked, last_walked_at, created_at').order('created_at', { ascending: false }),
    ]);
    if (isMissingTable(pinRes.error) || isMissingTable(walkRes.error)) { setDb('missing'); return; }
    if (pinRes.error || walkRes.error) { setDb('error'); setMessage((pinRes.error || walkRes.error)?.message || 'Could not load your places.'); return; }
    setPins((pinRes.data || []) as PinRow[]);
    setWalks((walkRes.data || []) as WalkRow[]);
    setDb('ready');
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    const run = () => { if (alive) void load(); };
    const timer = window.setTimeout(run, 0);
    const { data } = supabase.auth.onAuthStateChange((event) => { if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') run(); });
    return () => { alive = false; window.clearTimeout(timer); data.subscription.unsubscribe(); };
  }, [load]);

  // Snap the planned points to walkable paths (debounced); fall back to straight lines on failure.
  useEffect(() => {
    if (!snap || waypoints.length < 2) {
      const timer = window.setTimeout(() => { setSnapped(null); setSnapNote(''); }, 0);
      return () => window.clearTimeout(timer);
    }
    const controller = new AbortController();
    const points = loop && waypoints.length > 2 ? [...waypoints, waypoints[0]] : waypoints;
    const timer = window.setTimeout(async () => {
      setSnapNote('Finding paths…');
      try {
        const path = await snapRoute(points, controller.signal);
        if (!controller.signal.aborted) { setSnapped(path); setSnapNote(''); }
      } catch {
        if (!controller.signal.aborted) { setSnapped(null); setSnapNote("Couldn't reach the path router, so this shows straight lines between your points."); }
      }
    }, 450);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [snap, loop, waypoints]);

  const signedIn = db === 'ready';
  const plannedPath = useMemo<LngLat[]>(() => {
    if (snapped) return snapped;
    return loop && waypoints.length > 2 ? closeLoop(waypoints) : waypoints;
  }, [snapped, loop, waypoints]);
  const plannedMiles = pathMiles(plannedPath);
  const shownWalk = walks.find((w) => w.id === shownWalkId) || null;

  const route = useMemo<MapRoute | null>(() => {
    if (mode === 'plan') return waypoints.length ? { path: plannedPath, vertices: waypoints, color: PLAN_COLOR } : null;
    if (mode === 'walks' && shownWalk?.path?.length) return { path: shownWalk.path, loop: shownWalk.is_loop, color: SAVED_COLOR };
    return null;
  }, [mode, waypoints, plannedPath, shownWalk]);

  const mapPins = useMemo<MapPin[]>(() => {
    const list: MapPin[] = pins.map((p) => ({ lat: p.lat, lng: p.lng, label: p.name, tone: PIN_KINDS[p.kind]?.tone || 'brand', glyph: PIN_KINDS[p.kind]?.glyph || '•' }));
    if (draft) list.push({ lat: draft.lat, lng: draft.lng, label: pinName.trim() || 'New pin', tone: PIN_KINDS[pinKind].tone, glyph: PIN_KINDS[pinKind].glyph });
    return list;
  }, [pins, draft, pinName, pinKind]);

  const onMapClick = mode === 'plan'
    ? (p: { lat: number; lng: number }) => { setFitTo(null); setWaypoints((list) => [...list, [p.lng, p.lat]]); }
    : mode === 'pins' && addingPin
      ? (p: { lat: number; lng: number }) => setDraft(p)
      : undefined;

  function switchMode(next: Mode) {
    setMode(next);
    setMessage('');
    setFitTo(null);
    setConfirmDelete(null);
    setRenaming(null);
    if (next !== 'pins') { setAddingPin(false); setDraft(null); setSharingPlace(false); }
  }

  function flyToPoint(lat: number, lng: number) {
    flyKey.current += 1;
    setFlyTo({ lat, lng, zoom: 17, key: flyKey.current });
  }

  // ---------- Plan a walk ----------
  async function saveWalk() {
    if (!supabase || !signedIn || waypoints.length < 2) return;
    const name = walkName.trim() || `${loop ? 'Loop' : 'Walk'} with ${dog}`;
    const miles = Math.round(plannedMiles * 100) / 100;
    setBusy(true);
    const { data, error } = await supabase.from('saved_walks').insert({
      name, kind: 'route', is_loop: loop, path: plannedPath, distance_mi: miles, duration_min: minutesFor(miles), times_walked: 0,
    }).select('id, name, kind, is_loop, path, distance_mi, duration_min, times_walked, last_walked_at, created_at').single();
    setBusy(false);
    if (isMissingTable(error)) { setDb('missing'); return; }
    if (error || !data) { setMessage(error?.message || 'Could not save that walk.'); return; }
    setWalks((list) => [data as WalkRow, ...list]);
    setWalkName('');
    setMessage(`Saved "${name}". Find it under Saved walks.`);
  }

  // ---------- Pins ----------
  async function savePin() {
    if (!supabase || !signedIn || !draft) return;
    const name = pinName.trim() || PIN_KINDS[pinKind].label;
    setBusy(true);
    const { data, error } = await supabase.from('map_pins').insert({ name, kind: pinKind, note: pinNote.trim() || null, lat: draft.lat, lng: draft.lng })
      .select('id, name, kind, note, lat, lng, created_at').single();
    setBusy(false);
    if (isMissingTable(error)) { setDb('missing'); return; }
    if (error || !data) { setMessage(error?.message || 'Could not save that pin.'); return; }
    setPins((list) => [data as PinRow, ...list]);
    setDraft(null); setAddingPin(false); setPinName(''); setPinNote('');
    setMessage(`Pinned "${name}".`);
  }

  async function deletePin(id: string) {
    if (!supabase) return;
    const { error } = await supabase.from('map_pins').delete().eq('id', id);
    if (error) { setMessage(error.message); return; }
    setPins((list) => list.filter((p) => p.id !== id));
  }

  // ---------- Saved walks ----------
  function showWalk(walk: WalkRow) {
    setShownWalkId(walk.id);
    setFitTo('route');
  }

  async function walkAgain(walk: WalkRow) {
    if (!supabase) return;
    const times = (walk.times_walked || 0) + 1;
    const now = new Date().toISOString();
    const { error } = await supabase.from('saved_walks').update({ times_walked: times, last_walked_at: now }).eq('id', walk.id);
    if (error) { setMessage(error.message); return; }
    setWalks((list) => list.map((w) => (w.id === walk.id ? { ...w, times_walked: times, last_walked_at: now } : w)));
    showWalk(walk);
    window.dispatchEvent(new CustomEvent('mypetid:start-walk', { detail: { walkId: walk.id, name: walk.name } }));
    setMessage(`Have a good walk on "${walk.name}".`);
  }

  async function renameWalk() {
    if (!supabase || !renaming) return;
    const name = renaming.name.trim();
    if (!name) return;
    const { error } = await supabase.from('saved_walks').update({ name }).eq('id', renaming.id);
    if (error) { setMessage(error.message); return; }
    setWalks((list) => list.map((w) => (w.id === renaming.id ? { ...w, name } : w)));
    setRenaming(null);
  }

  async function deleteWalk(id: string) {
    if (!supabase) return;
    const { error } = await supabase.from('saved_walks').delete().eq('id', id);
    if (error) { setMessage(error.message); return; }
    setWalks((list) => list.filter((w) => w.id !== id));
    if (shownWalkId === id) setShownWalkId(null);
    setConfirmDelete(null);
  }

  const saveBlocker = db === 'noClient' || db === 'signedOut'
    ? 'Sign in to save places and walks.'
    : db === 'missing'
      ? 'Saved places and walks switch on after the latest database update.'
      : db === 'loading' ? 'Loading your saved places…' : '';

  const tabs: { id: Mode; label: string }[] = [
    { id: 'plan', label: 'Plan a walk' },
    { id: 'pins', label: `My pins${pins.length ? ` (${pins.length})` : ''}` },
    { id: 'walks', label: `Saved walks${walks.length ? ` (${walks.length})` : ''}` },
  ];

  return (
    <section className="panel full">
      <div className="panelTitleRow">
        <div>
          <p className="eyebrow"><MapPinned /> Walk planner</p>
          <h2>Plan walks with {dog}</h2>
        </div>
        <span className="iconBubble green"><Footprints /></span>
      </div>

      <div className={styles.planner}>
        <div className={styles.tabs} role="tablist" aria-label="Walk planner">
          {tabs.map((tab) => (
            <button key={tab.id} type="button" role="tab" aria-selected={mode === tab.id} className={mode === tab.id ? 'activeMini' : ''} onClick={() => switchMode(tab.id)}>{tab.label}</button>
          ))}
        </div>

        <div className={styles.mapWrap}>
          <WalkMap3D
            height={380}
            pins={mapPins}
            onMapClick={onMapClick}
            route={route}
            editableRoute={mode === 'plan'}
            onRouteChange={mode === 'plan' ? (next) => { setFitTo(null); setWaypoints(next); } : undefined}
            fitTo={fitTo}
            flyTo={flyTo}
            addPlaceMode={sharingPlace}
            onAddPlaceDone={() => setSharingPlace(false)}
          />
        </div>

        <div className={styles.controls}>
          {saveBlocker && <p className="authMessage">{saveBlocker}</p>}
          {message && <p className="authMessage" role="status">{message}</p>}

          {mode === 'plan' && (
            <>
              <p className="formHint">{waypoints.length === 0 ? `Tap the map to drop your first point, then keep tapping to draw a route for ${dog}. Drag a numbered point to move it.` : waypoints.length === 1 ? 'Nice start. Tap again to add the next point.' : 'Keep tapping to extend the route, or drag a point to adjust it.'}</p>
              <div className={styles.stats}>
                <div className={styles.stat}><small>Distance</small><strong>{plannedMiles.toFixed(2)} mi</strong></div>
                <div className={styles.stat}><small>About</small><strong>{formatMinutes(minutesFor(plannedMiles))}</strong></div>
                <div className={styles.stat}><small>Points</small><strong>{waypoints.length}</strong></div>
              </div>
              <div className={styles.toggles}>
                <label className={styles.toggle}><input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} /> Snap to paths</label>
                <label className={styles.toggle}><input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} /> Make it a loop</label>
              </div>
              {snapNote && <p className="formHint" role="status">{snapNote}</p>}
              <p className="mutedLine">Time is estimated at {WALK_MPH} mph.{snap ? ' Paths come from OpenStreetMap.' : ''}</p>
              <div className="actions compact">
                <button type="button" disabled={!waypoints.length} onClick={() => setWaypoints((list) => list.slice(0, -1))}>Undo last point</button>
                <button type="button" disabled={!waypoints.length} onClick={() => { setWaypoints([]); setSnapped(null); setSnapNote(''); }}>Clear</button>
              </div>
              {signedIn && (
                <div className={styles.row}>
                  <input value={walkName} onChange={(e) => setWalkName(e.target.value)} placeholder={`${loop ? 'Loop' : 'Walk'} with ${dog}`} aria-label="Walk name" maxLength={80} />
                  <button type="button" className="primary" disabled={busy || waypoints.length < 2} onClick={saveWalk}>Save</button>
                </div>
              )}
            </>
          )}

          {mode === 'pins' && (
            <>
              {!addingPin ? (
                <div className="actions compact">
                  <button type="button" className="primary" disabled={!signedIn || sharingPlace} onClick={() => { setAddingPin(true); setDraft(null); setMessage(''); }}><MapPinned /> Add pin</button>
                  <button type="button" className={sharingPlace ? 'activeMini' : ''} aria-pressed={sharingPlace} disabled={!signedIn} onClick={() => { setMessage(''); setSharingPlace((on) => !on); }}>{sharingPlace ? 'Stop sharing' : 'Share a place with everyone'}</button>
                </div>
              ) : (
                <div className={styles.controls}>
                  <p className="formHint">{draft ? 'Tap the map again to move the pin.' : 'Tap the map where the pin should go.'}</p>
                  <div className={styles.kinds} role="radiogroup" aria-label="Pin kind">
                    {(Object.keys(PIN_KINDS) as PinKind[]).map((kind) => (
                      <button key={kind} type="button" role="radio" aria-checked={pinKind === kind} className={pinKind === kind ? 'activeMini' : ''} onClick={() => setPinKind(kind)}>{PIN_KINDS[kind].glyph} {PIN_KINDS[kind].label}</button>
                    ))}
                  </div>
                  <input value={pinName} onChange={(e) => setPinName(e.target.value)} placeholder={`Name (e.g. ${dog}'s favourite bench)`} aria-label="Pin name" maxLength={80} />
                  <input value={pinNote} onChange={(e) => setPinNote(e.target.value)} placeholder="Note (optional)" aria-label="Pin note" maxLength={240} />
                  <div className="actions compact">
                    <button type="button" className="primary" disabled={busy || !draft} onClick={savePin}>Save pin</button>
                    <button type="button" onClick={() => { setAddingPin(false); setDraft(null); }}>Cancel</button>
                  </div>
                </div>
              )}
              <p className={`mutedLine ${styles.note}`}>Private pins are only visible to you. To help other owners, share a place with everyone: it shows on the map for all MyPetID users.</p>
              {sharingPlace && <p className="formHint" role="status">Tap the map where the place is, then fill in the short form on the map.</p>}
              {signedIn && (pins.length === 0 ? <p className="mutedLine">No pins yet. Save the good parks, water stops and the spots to avoid.</p> : (
                <ul className={styles.list}>
                  {pins.map((pin) => {
                    const kind = PIN_KINDS[pin.kind] || PIN_KINDS.other;
                    return (
                      <li key={pin.id} className={styles.item}>
                        <span className={`iconBubble ${kind.bubble} ${styles.itemIcon}`} aria-hidden>{kind.glyph}</span>
                        <button type="button" className={styles.itemMain} onClick={() => flyToPoint(pin.lat, pin.lng)} aria-label={`Show ${pin.name} on the map`}>
                          <strong>{pin.name}</strong>
                          <small>{kind.label}{pin.note ? ` · ${pin.note}` : ''}</small>
                        </button>
                        <div className={styles.itemActions}>
                          <button type="button" className={styles.danger} onClick={() => deletePin(pin.id)} aria-label={`Delete ${pin.name}`}>Delete</button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ))}
            </>
          )}

          {mode === 'walks' && signedIn && (walks.length === 0 ? <p className="mutedLine">No saved walks yet. Plan one and tap Save.</p> : (
            <ul className={styles.list}>
              {walks.map((walk) => {
                const miles = toNumber(walk.distance_mi);
                const times = walk.times_walked || 0;
                return (
                  <li key={walk.id} className={`${styles.walkItem} ${shownWalkId === walk.id ? styles.shown : ''}`}>
                    {renaming?.id === walk.id ? (
                      <div className={styles.row}>
                        <input value={renaming.name} onChange={(e) => setRenaming({ id: walk.id, name: e.target.value })} aria-label="New walk name" maxLength={80} autoFocus onKeyDown={(e) => { if (e.key === 'Enter') void renameWalk(); }} />
                        <button type="button" className="primary" onClick={renameWalk}>Save</button>
                        <button type="button" onClick={() => setRenaming(null)}>Cancel</button>
                      </div>
                    ) : (
                      <div className={styles.walkHead}>
                        <strong>{walk.name}</strong>
                        {walk.is_loop && <span className={styles.badge}>Loop</span>}
                        {walk.kind === 'recorded' && <span className={styles.badge}>Recorded</span>}
                      </div>
                    )}
                    <div className="chipCloud">
                      <span>{miles.toFixed(2)} mi</span>
                      <span>{formatMinutes(walk.duration_min ?? minutesFor(miles))}</span>
                      <span>Walked {times} {times === 1 ? 'time' : 'times'}</span>
                      {walk.last_walked_at && <span>Last {new Date(walk.last_walked_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>}
                    </div>
                    {confirmDelete === walk.id ? (
                      <div className="actions compact">
                        <span className="mutedLine">Delete this walk?</span>
                        <button type="button" className="dangerButton" onClick={() => deleteWalk(walk.id)}>Delete</button>
                        <button type="button" onClick={() => setConfirmDelete(null)}>Keep it</button>
                      </div>
                    ) : (
                      <div className={`actions compact ${styles.itemActions}`} style={{ justifyContent: 'flex-start' }}>
                        <button type="button" className={shownWalkId === walk.id ? 'activeMini' : ''} disabled={!walk.path?.length} onClick={() => showWalk(walk)}>Show</button>
                        <button type="button" className="primary" onClick={() => walkAgain(walk)}><Footprints /> Walk this again</button>
                        <button type="button" onClick={() => setRenaming({ id: walk.id, name: walk.name })}>Rename</button>
                        <button type="button" className={styles.danger} onClick={() => setConfirmDelete(walk.id)}>Delete</button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
}
