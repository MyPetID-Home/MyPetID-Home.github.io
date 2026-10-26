"use client";

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { hourOptions } from '../lib/clock';
import {
  addFix, addSteps, createStepCounter, currentSpeed, elapsedMs, fmtDistance, fmtDuration, fmtSpeed, mark, newWalk, pause, resume, summary, thinPath, tick,
  type Units, type WalkState,
} from '../lib/walk-tracker';
import { BottomSheet } from './memo-layout';
import { MascotPeek } from './mascot';
import { WalkShare } from './walk-share';
import type { MapPin } from './walk-map-3d';
import { change, walkStats, type WalkRecord } from '../lib/walk-stats';

const WalkMap3D = dynamic(() => import('./walk-map-3d').then((m) => m.WalkMap3D), { ssr: false });

/**
 * Walk recorder: follows the phone's GPS, draws the path as you go, and records time, distance,
 * live and average speed, stops of 3+ seconds, steps, and pee/poop marks. The walk in progress is
 * kept on the device so a reload or a dropped connection doesn't lose it; finished walks are saved
 * to the account (walk_sessions).
 */
const LIVE_KEY = 'mypetid.walk.live';
export const WALKS_EVENT = 'mypetid:walks';

export type SavedWalk = { id: string; name: string | null; started_at: string; ended_at: string; duration_s: number; moving_s: number; distance_m: number; avg_speed_mps: number | null; max_speed_mps: number | null; stops: number; avg_stop_s: number | null; steps: number | null; steps_source: string | null; path: [number, number, number][]; events: { kind: 'pee' | 'poop'; lng: number; lat: number; t: number }[] };
export type WalkResult = { distanceMi: number; durationMin: number; name: string };

function loadLive(): WalkState | null {
  try { const raw = localStorage.getItem(LIVE_KEY); return raw ? JSON.parse(raw) as WalkState : null; } catch { return null; }
}
function saveLive(w: WalkState | null) {
  try { if (w) localStorage.setItem(LIVE_KEY, JSON.stringify(w)); else localStorage.removeItem(LIVE_KEY); } catch { /* storage full */ }
}

type WakeLock = { release: () => Promise<void> };

export function WalkTracker({ dogName, petId, units, hasMap, onFinished }: { dogName: string; petId?: string | null; units: Units; hasMap: boolean; onFinished: (r: WalkResult) => void }) {
  const [walk, setWalk] = useState<WalkState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [gps, setGps] = useState<{ status: 'idle' | 'waiting' | 'ok' | 'weak' | 'denied' | 'unsupported'; accuracy?: number }>({ status: 'idle' });
  const [done, setDone] = useState<(ReturnType<typeof summary> & { saved: 'saving' | 'saved' | 'local' | 'error'; error?: string }) | null>(null);
  const watchId = useRef<number | null>(null);
  const wake = useRef<WakeLock | null>(null);
  const steps = useRef<ReturnType<typeof createStepCounter> | null>(null);
  const walkRef = useRef<WalkState | null>(null);
  walkRef.current = walk;

  const update = useCallback((fn: (w: WalkState) => WalkState) => {
    setWalk((w) => { if (!w) return w; const next = fn(w); if (next !== w) saveLive(next); return next; });
  }, []);

  const startSensors = useCallback(async () => {
    if (!('geolocation' in navigator)) { setGps({ status: 'unsupported' }); return; }
    setGps({ status: 'waiting' });
    watchId.current = navigator.geolocation.watchPosition((pos) => {
      const accuracy = pos.coords.accuracy;
      setGps({ status: accuracy <= 35 ? 'ok' : 'weak', accuracy });
      update((w) => addFix(w, { lat: pos.coords.latitude, lng: pos.coords.longitude, t: pos.timestamp || Date.now(), accuracy, speed: pos.coords.speed, heading: pos.coords.heading }));
    }, (err) => setGps({ status: err.code === err.PERMISSION_DENIED ? 'denied' : 'weak' }), { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
    try { wake.current = await (navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<WakeLock> } }).wakeLock?.request('screen') || null; } catch { wake.current = null; }
    steps.current?.stop();
    steps.current = createStepCounter((n) => update((w) => addSteps(w, n)));
    void steps.current.start();
  }, [update]);

  const stopSensors = useCallback(() => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    steps.current?.stop(); steps.current = null;
    void wake.current?.release().catch(() => undefined); wake.current = null;
  }, []);

  // Pick a walk back up after a reload.
  useEffect(() => {
    const live = loadLive();
    if (live && Date.now() - live.startedAt < 6 * 3600_000) { setWalk(live); if (!live.pausedAt) void startSensors(); }
    else saveLive(null);
    return () => stopSensors();
  }, [startSensors, stopSensors]);

  // Clock for the live numbers; also notices stops that are still happening.
  useEffect(() => {
    if (!walk) return;
    const id = window.setInterval(() => { const t = Date.now(); setNow(t); update((w) => tick(w, t)); }, 1000);
    // The screen lock can turn GPS off; get it back when the page is visible again.
    const onVisible = () => { if (document.visibilityState === 'visible' && walkRef.current && !walkRef.current.pausedAt && !wake.current) void startSensors(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
  }, [walk === null, update, startSensors]); // eslint-disable-line react-hooks/exhaustive-deps

  function start() {
    const w = newWalk(Date.now());
    saveLive(w); setWalk(w); setDone(null); setNow(Date.now());
    void startSensors();
  }
  function togglePause() {
    const t = Date.now();
    if (walk?.pausedAt) { update((w) => resume(w, t)); void startSensors(); }
    else { update((w) => pause(w, t)); stopSensors(); }
  }
  async function finish() {
    if (!walk) return;
    const t = Date.now();
    const s = summary(walk, t);
    stopSensors();
    if (s.durationS < 20 && s.distanceM < 10 && !window.confirm('This walk is very short. Save it anyway?')) { saveLive(null); setWalk(null); return; }
    setDone({ ...s, saved: 'saving' });
    const name = `${dogName} · ${new Date(walk.startedAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}`;
    onFinished({ distanceMi: s.distanceM / 1609.344, durationMin: s.durationS / 60, name });
    const row = {
      pet_id: petId || null, name, started_at: new Date(walk.startedAt).toISOString(), ended_at: new Date(t).toISOString(),
      duration_s: s.durationS, moving_s: s.movingS, distance_m: s.distanceM, avg_speed_mps: Number(s.avgSpeed.toFixed(3)), max_speed_mps: Number(s.maxSpeed.toFixed(3)),
      stops: s.stops, avg_stop_s: s.avgStopS || null, steps: s.steps, steps_source: s.stepsSource,
      path: thinPath(walk.path).map(([lng, lat, ms]) => [Number(lng.toFixed(6)), Number(lat.toFixed(6)), Math.round(ms / 1000)]),
      events: walk.marks.map((m) => ({ kind: m.kind, lng: Number(m.lng.toFixed(6)), lat: Number(m.lat.toFixed(6)), t: Math.round(m.t / 1000) })),
    };
    saveLive(null); setWalk(null);
    if (!supabase) { setDone({ ...s, saved: 'local' }); return; }
    const { data: auth } = await supabase.auth.getSession();
    if (!auth.session) { setDone({ ...s, saved: 'local' }); return; }
    const { error } = await supabase.from('walk_sessions').insert(row);
    if (error) {
      // Keep it on the device so it isn't lost; it can be retried later.
      try { const queue = JSON.parse(localStorage.getItem('mypetid.walk.unsaved') || '[]'); queue.push(row); localStorage.setItem('mypetid.walk.unsaved', JSON.stringify(queue.slice(-20))); } catch { /* ignore */ }
      setDone({ ...s, saved: 'error', error: /schema cache|does not exist|42P01/i.test(error.message) ? 'Walk history switches on after the latest database update; this walk is kept on your phone until then.' : error.message });
      return;
    }
    setDone({ ...s, saved: 'saved' });
    window.dispatchEvent(new CustomEvent(WALKS_EVENT));
  }

  const live = walk ? summary(walk, now) : null;
  const here = walk?.last || walk?.anchor;
  const path = useMemo(() => (walk?.path || []).map(([lng, lat]) => [lng, lat] as [number, number]), [walk?.path]);
  const pins: MapPin[] = useMemo(() => [
    ...(walk && walk.path.length ? [{ lng: walk.path[0][0], lat: walk.path[0][1], label: 'Start', tone: 'brand' as const, glyph: 'S' }] : []),
    ...(walk?.marks || []).map((m) => ({ lng: m.lng, lat: m.lat, label: m.kind === 'pee' ? 'Pee' : 'Poop', tone: m.kind === 'pee' ? 'gold' as const : 'violet' as const, glyph: m.kind === 'pee' ? '💧' : '💩' })),
  ], [walk?.path.length ? walk.path[0][0] : 0, walk?.marks]); // eslint-disable-line react-hooks/exhaustive-deps
  const gpsText = { idle: '', waiting: 'Finding your location…', ok: `GPS good${gps.accuracy ? ` (±${Math.round(gps.accuracy)} m)` : ''}`, weak: `Weak GPS${gps.accuracy ? ` (±${Math.round(gps.accuracy)} m)` : ''} — step outside or wait a moment`, denied: 'Location is blocked. Allow location for this site in your browser settings.', unsupported: 'This browser can’t share location.' }[gps.status];

  return (
    <>
      <section className="panel wide walkTracker">
        <div className="walkHead"><h2>{walk ? (walk.pausedAt ? 'Walk paused' : `Walking ${dogName}`) : `Walk ${dogName}`}</h2>{walk && <span className={`gpsChip ${gps.status}`}>{gpsText}</span>}</div>
        {hasMap ? <WalkMap3D current={here ? { lat: here.lat, lng: here.lng } : undefined} route={path.length > 1 ? { path, color: '#57d7ff' } : null} pins={pins} fitTo={null} height={360} />
          : <p className="formHint">The live map comes with a MyPetID plan. Your walk is still recorded below.</p>}
        {walk && live && <>
          <div className="walkStats">
            <div className="big"><small>Time</small><strong>{fmtDuration(live.durationS)}</strong></div>
            <div className="big"><small>Distance</small><strong>{fmtDistance(live.distanceM, units)}</strong></div>
            <div><small>Speed now</small><strong>{fmtSpeed(currentSpeed(walk, now), units)}</strong></div>
            <div><small>Average</small><strong>{fmtSpeed(live.avgSpeed, units)}</strong></div>
            <div><small>Stops (3s+)</small><strong>{live.stops}</strong></div>
            <div><small>Avg stop</small><strong>{live.stops ? fmtDuration(live.avgStopS) : '—'}</strong></div>
            <div><small>{walk.stepsSource === 'motion' ? 'Steps' : 'Steps (est.)'}</small><strong>{live.steps.toLocaleString()}</strong></div>
            <div><small>Pee · Poop</small><strong>{live.pee} · {live.poop}</strong></div>
          </div>
          <div className="walkMarks">
            <button type="button" className="markBtn pee" disabled={!here || Boolean(walk.pausedAt)} onClick={() => update((w) => mark(w, 'pee', Date.now()))}><span aria-hidden>💧</span> Pee</button>
            <button type="button" className="markBtn poop" disabled={!here || Boolean(walk.pausedAt)} onClick={() => update((w) => mark(w, 'poop', Date.now()))}><span aria-hidden>💩</span> Poop</button>
          </div>
          <div className="actions walkControls"><button type="button" onClick={togglePause}>{walk.pausedAt ? 'Resume' : 'Pause'}</button><button type="button" className="primary" onClick={finish}>End walk</button></div>
          <p className="formHint">Keep this screen open during the walk; phones stop sharing location with web apps when the screen locks.</p>
        </>}
        {!walk && <>
          {done && <div className="walkDone">
            <MascotPeek size={56} />
            <div><strong>Nice walk! {fmtDistance(done.distanceM, units)} in {fmtDuration(done.durationS)}</strong>
              <small>{fmtSpeed(done.avgSpeed, units)} average · {done.stops} stop{done.stops === 1 ? '' : 's'} · {done.steps.toLocaleString()} steps{done.stepsSource === 'estimate' ? ' (est.)' : ''} · {done.pee} pee · {done.poop} poop</small>
              <small className={done.saved === 'error' ? 'dangerText' : ''}>{done.saved === 'saving' ? 'Saving…' : done.saved === 'saved' ? 'Saved to your walk history.' : done.saved === 'local' ? 'Saved on this device. Sign in to keep walks in your account.' : done.error}</small></div>
          </div>}
          <div className="actions"><button className="primary walkStart" type="button" data-start-walk onClick={start}>Start walk</button></div>
          {gps.status === 'denied' && <p className="dangerText">{gpsText}</p>}
        </>}
      </section>
      <WalkShare walking={Boolean(walk && !walk.pausedAt)} point={here ? { lat: here.lat, lng: here.lng } : undefined} dogName={dogName} />
    </>
  );
}

// ---------- saved walks ----------

export type LocalWalk = { id: number; start: string; routeName?: string; distance: number; duration: number };

/** Walks saved to the account (newest first). `missing` = the walk history table isn't set up yet. */
export function useWalkSessions() {
  const [walks, setWalks] = useState<SavedWalk[] | null>(null);
  const [note, setNote] = useState('');
  const load = useCallback(async () => {
    if (!supabase) return setWalks([]);
    const { data: auth } = await supabase.auth.getSession();
    if (!auth.session) return setWalks([]);
    const since = new Date(Date.now() - 400 * 86_400_000).toISOString();
    const { data, error } = await supabase.from('walk_sessions').select('*').gte('started_at', since).order('started_at', { ascending: false }).limit(1000);
    if (error) { setNote(/schema cache|does not exist|42P01/i.test(error.message) ? 'Walk history switches on after the latest database update.' : error.message); return setWalks([]); }
    setWalks((data || []) as SavedWalk[]);
  }, []);
  useEffect(() => { void load(); const r = () => void load(); window.addEventListener(WALKS_EVENT, r); return () => window.removeEventListener(WALKS_EVENT, r); }, [load]);
  return { walks, note, reload: load };
}

/** Account walks when there are any; otherwise the walks kept on this device (each walk is also kept locally, so never both). */
export function walkRecords(saved: SavedWalk[] | null, local: LocalWalk[]): WalkRecord[] {
  if (saved && saved.length) return saved.map((w) => ({
    start: new Date(w.started_at).getTime(), durationS: w.duration_s, movingS: w.moving_s, distanceM: Number(w.distance_m), steps: w.steps ?? null, stepsEstimated: w.steps_source !== 'motion', stops: w.stops,
    pee: (w.events || []).filter((e) => e.kind === 'pee').length, poop: (w.events || []).filter((e) => e.kind === 'poop').length, maxSpeed: w.max_speed_mps === null ? null : Number(w.max_speed_mps),
  }));
  return local.filter((w) => w.distance > 0).map((w) => ({ start: w.id - w.duration * 60_000, durationS: Math.round(w.duration * 60), movingS: Math.round(w.duration * 60), distanceM: w.distance * 1609.344, steps: null, stops: 0, pee: 0, poop: 0, maxSpeed: null }));
}

type Metric = 'distance' | 'time' | 'steps' | 'walks';
const METRICS: { key: Metric; label: string }[] = [{ key: 'distance', label: 'Distance' }, { key: 'time', label: 'Time' }, { key: 'steps', label: 'Steps' }, { key: 'walks', label: 'Walks' }];

function Change({ now, before }: { now: number; before: number }) {
  const pct = change(now, before);
  if (pct === null) return <em className="statChange up">new</em>;
  if (pct === 0) return <em className="statChange">same</em>;
  return <em className={`statChange ${pct > 0 ? 'up' : 'down'}`}>{pct > 0 ? '▲' : '▼'} {Math.abs(pct)}%</em>;
}

/** Today, this week vs last week, a 7-day chart, averages and bests. */
export function WalkStatsPanel({ units, localWalks, dogName, weeklyGoalMi }: { units: Units; localWalks: LocalWalk[]; dogName: string; weeklyGoalMi?: number }) {
  const { walks } = useWalkSessions();
  const [metric, setMetric] = useState<Metric>('distance');
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); }, []);
  if (walks === null || now === null) return null;
  const records = walkRecords(walks, localWalks);
  const st = walkStats(records, now);
  if (!records.length) return <section className="panel wide"><h2>Walk stats</h2><div className="memoEmpty"><MascotPeek size={54} /><p className="formHint">Your daily and weekly stats show up here after your first recorded walk.</p></div></section>;
  const value = (t: { distanceM: number; durationS: number; steps: number; walks: number }) => metric === 'distance' ? (units === 'km' ? t.distanceM / 1000 : t.distanceM / 1609.344) : metric === 'time' ? t.durationS / 60 : metric === 'steps' ? t.steps : t.walks;
  const label = (v: number) => metric === 'distance' ? v.toFixed(v >= 10 ? 0 : 1) : metric === 'time' ? `${Math.round(v)}m` : metric === 'steps' ? (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v))) : String(v);
  const vals = st.days.map(value);
  const max = Math.max(...vals, 0.0001);
  const goalWeekM = weeklyGoalMi ? weeklyGoalMi * 1609.344 : 0;
  const goalPct = goalWeekM ? Math.min(100, Math.round((st.week.distanceM / goalWeekM) * 100)) : 0;
  return (
    <section className="panel wide walkStatsPanel">
      <h2>{dogName}’s walk stats</h2>
      <div className="statBlocks">
        <div className="statBlock">
          <h3>Today</h3>
          <dl><div><dt>Walks</dt><dd>{st.today.walks}</dd></div><div><dt>Distance</dt><dd>{fmtDistance(st.today.distanceM, units)}</dd></div><div><dt>Time</dt><dd>{fmtDuration(st.today.durationS)}</dd></div><div><dt>{st.today.stepsKnown ? 'Steps' : 'Steps (est.)'}</dt><dd>{st.today.steps.toLocaleString()}</dd></div><div><dt>Pee · Poop</dt><dd>{st.today.pee} · {st.today.poop}</dd></div></dl>
        </div>
        <div className="statBlock">
          <h3>This week <small>vs last week so far</small></h3>
          <dl>
            <div><dt>Walks</dt><dd>{st.week.walks} <Change now={st.week.walks} before={st.lastWeekSoFar.walks} /></dd></div>
            <div><dt>Distance</dt><dd>{fmtDistance(st.week.distanceM, units)} <Change now={st.week.distanceM} before={st.lastWeekSoFar.distanceM} /></dd></div>
            <div><dt>Time</dt><dd>{fmtDuration(st.week.durationS)} <Change now={st.week.durationS} before={st.lastWeekSoFar.durationS} /></dd></div>
            <div><dt>{st.week.stepsKnown ? 'Steps' : 'Steps (est.)'}</dt><dd>{st.week.steps.toLocaleString()} <Change now={st.week.steps} before={st.lastWeekSoFar.steps} /></dd></div>
            <div><dt>Days walked</dt><dd>{st.activeDaysThisWeek} of 7</dd></div>
          </dl>
          {goalWeekM > 0 && <div className="weekGoal"><div className="progress"><span style={{ width: `${goalPct}%` }} /></div><small>{goalPct}% of the {fmtDistance(goalWeekM, units)} weekly goal for {dogName}</small></div>}
        </div>
      </div>
      <div className="recTabs" role="tablist" aria-label="Chart">{METRICS.map((m) => <button key={m.key} type="button" role="tab" aria-selected={metric === m.key} className={metric === m.key ? 'active' : ''} onClick={() => setMetric(m.key)}>{m.label}</button>)}</div>
      <svg className="walkChart" viewBox="0 0 700 220" role="img" aria-label={`Last 7 days, ${metric}`}>
        {st.days.map((d, i) => {
          const h = Math.max(vals[i] > 0 ? 4 : 0, (vals[i] / max) * 150);
          const x = 20 + i * 96;
          const isToday = i === 6;
          return <g key={d.day}>
            <rect x={x} y={180 - h} width={64} height={h} rx={10} className={isToday ? 'bar today' : 'bar'} />
            {vals[i] > 0 && <text x={x + 32} y={172 - h} textAnchor="middle" className="barValue">{label(vals[i])}</text>}
            <text x={x + 32} y={205} textAnchor="middle" className="barDay">{isToday ? 'Today' : new Date(d.day).toLocaleDateString(undefined, { weekday: 'short' })}</text>
          </g>;
        })}
        <line x1="10" y1="180.5" x2="690" y2="180.5" className="barBase" />
      </svg>
      <div className="walkStats compact">
        <div><small>Streak</small><strong>{st.streak} day{st.streak === 1 ? '' : 's'}</strong></div>
        <div><small>Avg walk</small><strong>{st.avg ? fmtDistance(st.avg.distanceM, units) : '—'}</strong></div>
        <div><small>Avg time</small><strong>{st.avg ? fmtDuration(st.avg.durationS) : '—'}</strong></div>
        <div><small>Avg speed</small><strong>{st.avg ? fmtSpeed(st.avg.speed, units) : '—'}</strong></div>
        <div><small>Stops / walk</small><strong>{st.avg ? st.avg.stops.toFixed(1) : '—'}</strong></div>
        <div><small>Longest walk</small><strong>{st.longest ? fmtDistance(st.longest.distanceM, units) : '—'}</strong></div>
        <div><small>All walks</small><strong>{st.all.walks}</strong></div>
        <div><small>All distance</small><strong>{fmtDistance(st.all.distanceM, units)}</strong></div>
      </div>
    </section>
  );
}

// ---------- history ----------

export function WalkHistory({ units, hasMap, localWalks }: { units: Units; hasMap: boolean; localWalks: LocalWalk[] }) {
  const { walks, note: loadNote, reload: load } = useWalkSessions();
  const [open, setOpen] = useState<SavedWalk | null>(null);
  const [note, setNote] = useState('');
  async function remove(w: SavedWalk) {
    if (!supabase || !window.confirm('Delete this walk from your history?')) return;
    const { error } = await supabase.from('walk_sessions').delete().eq('id', w.id);
    if (error) return setNote(error.message);
    setOpen(null); void load();
  }
  const total = (walks || []).reduce((s, w) => s + Number(w.distance_m), 0);
  const week = (walks || []).filter((w) => Date.now() - new Date(w.started_at).getTime() < 7 * 86_400_000);
  if (walks === null) return null;
  return (
    <section className="panel wide">
      <h2>Walk history</h2>
      {(note || loadNote) && <p className="formHint">{note || loadNote}</p>}
      {walks.length > 0 && <div className="walkStats compact">
        <div><small>This week</small><strong>{fmtDistance(week.reduce((s, w) => s + Number(w.distance_m), 0), units)}</strong></div>
        <div><small>Walks this week</small><strong>{week.length}</strong></div>
        <div><small>All time</small><strong>{fmtDistance(total, units)}</strong></div>
      </div>}
      {walks.length === 0 && localWalks.length === 0 ? <div className="memoEmpty"><MascotPeek size={54} /><p className="formHint">No walks recorded yet. Start one from Walk now.</p></div> : (
        <ul className="memoRows">
          {walks.map((w) => <li key={w.id}><button type="button" className="memoRow" onClick={() => setOpen(w)}>
            <span className="memoRowDate">{new Date(w.started_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
            <span className="memoRowTitle">{fmtDuration(w.duration_s)} · {w.stops} stops · {(w.events || []).filter((e) => e.kind === 'pee').length}💧 {(w.events || []).filter((e) => e.kind === 'poop').length}💩</span>
            <span className="memoRowTime">{fmtDistance(Number(w.distance_m), units)}</span>
          </button></li>)}
          {walks.length === 0 && localWalks.map((w) => <li key={`local-${w.id}`}><div className="memoRow"><span className="memoRowDate">{w.start}</span><span className="memoRowTitle">{w.routeName || 'Walk'} · on this device</span><span className="memoRowTime">{w.distance.toFixed(2)} mi · {Math.round(w.duration)} min</span></div></li>)}
        </ul>
      )}
      {open && <BottomSheet title={open.name || 'Walk'} onClose={() => setOpen(null)}>
        {hasMap && (open.path || []).length > 1 && <WalkMap3D route={{ path: open.path.map(([lng, lat]) => [lng, lat] as [number, number]), color: '#57d7ff' }} fitTo="route" height={260}
          pins={[{ lng: open.path[0][0], lat: open.path[0][1], label: 'Start', tone: 'brand', glyph: 'S' }, ...(open.events || []).map((e) => ({ lng: e.lng, lat: e.lat, label: e.kind === 'pee' ? 'Pee' : 'Poop', tone: e.kind === 'pee' ? 'gold' as const : 'violet' as const, glyph: e.kind === 'pee' ? '💧' : '💩' }))]} />}
        <div className="walkStats">
          <div><small>Started</small><strong>{new Date(open.started_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', ...hourOptions() })}</strong></div>
          <div><small>Time</small><strong>{fmtDuration(open.duration_s)}</strong></div>
          <div><small>Distance</small><strong>{fmtDistance(Number(open.distance_m), units)}</strong></div>
          <div><small>Moving time</small><strong>{fmtDuration(open.moving_s)}</strong></div>
          <div><small>Average</small><strong>{fmtSpeed(Number(open.avg_speed_mps || 0), units)}</strong></div>
          <div><small>Top speed</small><strong>{fmtSpeed(Number(open.max_speed_mps || 0), units)}</strong></div>
          <div><small>Stops</small><strong>{open.stops}</strong></div>
          <div><small>Avg stop</small><strong>{open.avg_stop_s ? fmtDuration(open.avg_stop_s) : '—'}</strong></div>
          <div><small>{open.steps_source === 'motion' ? 'Steps' : 'Steps (est.)'}</small><strong>{(open.steps || 0).toLocaleString()}</strong></div>
          <div><small>Pee · Poop</small><strong>{(open.events || []).filter((e) => e.kind === 'pee').length} · {(open.events || []).filter((e) => e.kind === 'poop').length}</strong></div>
        </div>
        <div className="actions"><button type="button" className="dangerLink" onClick={() => remove(open)}>Delete walk</button></div>
      </BottomSheet>}
    </section>
  );
}
