/**
 * Walk recording maths (pure, no React): cleans GPS fixes, builds the path, and works out
 * distance, moving time, speed, stops and steps.
 *
 * GPS on phones jitters by several metres even when standing still, so a fix only counts as
 * movement when it is accurate enough and far enough from the last counted point. A stop is a
 * stretch of at least STOP_MIN_S seconds without real movement.
 */

export type Fix = { lat: number; lng: number; t: number; accuracy: number; speed?: number | null; heading?: number | null };
export type WalkMark = { kind: 'pee' | 'poop'; lat: number; lng: number; t: number };
export type StopSpan = { start: number; end: number };

export type WalkState = {
  startedAt: number;
  /** Time spent paused (ms), excluded from the walk time. */
  pausedMs: number;
  pausedAt: number | null;
  /** Counted path points: [lng, lat, ms since start]. */
  path: [number, number, number][];
  distanceM: number;
  movingMs: number;
  maxSpeed: number;
  last: Fix | null;
  /** Last fix that counted as movement. */
  anchor: Fix | null;
  stillSince: number | null;
  stops: StopSpan[];
  marks: WalkMark[];
  steps: number;
  stepsSource: 'motion' | 'estimate';
  /** Recent movement for the live speed: [ms, cumulative metres]. */
  recent: [number, number][];
  /** Accepted fixes from the last few seconds, for stop detection: [ms, lat, lng]. */
  window: [number, number, number][];
  /** Where the current stop began (stops end once the dog is STILL_M away from it). */
  stopAt: { lat: number; lng: number } | null;
  /** Time of the last fix received, used or not (GPS can go quiet when standing still). */
  lastSeen: number;
  /** First real movement; standing around before it isn't a stop. */
  firstMoveAt: number | null;
};

export const MAX_ACCURACY_M = 35;
export const STOP_MIN_S = 3;
/** Standing still = moved less than this over the last STOP_MIN_S seconds (GPS wobble included). */
export const STILL_M = 3;
const MAX_HUMAN_SPEED = 7; // m/s; anything faster between fixes is a GPS jump (or a car)
const STRIDE_M = 0.75;

export function newWalk(now: number): WalkState {
  return { startedAt: now, pausedMs: 0, pausedAt: null, path: [], distanceM: 0, movingMs: 0, maxSpeed: 0, last: null, anchor: null, stillSince: null, stops: [], marks: [], steps: 0, stepsSource: 'estimate', recent: [], window: [], stopAt: null, lastSeen: now, firstMoveAt: null };
}

export function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000, toRad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toRad, dLng = (b.lng - a.lng) * toRad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function bearing(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = Math.PI / 180;
  const y = Math.sin((b.lng - a.lng) * toRad) * Math.cos(b.lat * toRad);
  const x = Math.cos(a.lat * toRad) * Math.sin(b.lat * toRad) - Math.sin(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.cos((b.lng - a.lng) * toRad);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

/** Elapsed walk time (ms), not counting pauses. */
export function elapsedMs(w: WalkState, now: number) {
  const pausedNow = w.pausedAt ? now - w.pausedAt : 0;
  return Math.max(0, now - w.startedAt - w.pausedMs - pausedNow);
}

function closeStop(w: WalkState, until: number): WalkState {
  if (w.stillSince === null) return w;
  const span = (until - w.stillSince) / 1000;
  const real = span >= STOP_MIN_S && w.firstMoveAt !== null && w.stillSince >= w.firstMoveAt;
  return real ? { ...w, stops: [...w.stops, { start: w.stillSince - w.startedAt, end: until - w.startedAt }], stillSince: null, stopAt: null } : { ...w, stillSince: null, stopAt: null };
}

/** True when the dog has moved less than STILL_M over the last STOP_MIN_S seconds. */
function isStill(win: [number, number, number][], now: number) {
  const span = win.filter(([t]) => now - t <= STOP_MIN_S * 1000 + 500);
  if (!span.length || now - span[0][0] < STOP_MIN_S * 1000 - 500) return false;
  const [, lat0, lng0] = span[0];
  return span.every(([, lat, lng]) => haversine({ lat: lat0, lng: lng0 }, { lat, lng }) < STILL_M);
}

/** Starts a stop after STOP_MIN_S seconds without real movement; ends it once the dog leaves the spot. */
function updateStop(w: WalkState, fix: Fix, prevT: number): WalkState {
  if (w.stillSince !== null) {
    if (w.stopAt && haversine(w.stopAt, fix) >= STILL_M) return closeStop(w, prevT);
    return w;
  }
  if (isStill(w.window, fix.t)) {
    const span = w.window.filter(([t]) => fix.t - t <= STOP_MIN_S * 1000 + 500);
    return { ...w, stillSince: span[0][0], stopAt: { lat: span[0][1], lng: span[0][2] } };
  }
  return w;
}

/** Adds one GPS fix. Returns the same object when the fix is ignored. */
export function addFix(w: WalkState, fix: Fix): WalkState {
  if (w.pausedAt) return { ...w, last: fix, lastSeen: fix.t };
  // The very first fix may be rough; later ones must be reasonably accurate.
  const limit = w.anchor ? MAX_ACCURACY_M : Math.max(MAX_ACCURACY_M, 60);
  if (!Number.isFinite(fix.lat) || !Number.isFinite(fix.lng) || fix.accuracy > limit) return { ...w, lastSeen: fix.t };
  const prevT = w.last ? w.last.t : fix.t;
  const win = [...w.window.filter(([t]) => fix.t - t <= 10000), [fix.t, fix.lat, fix.lng] as [number, number, number]];
  if (!w.anchor) {
    return { ...w, anchor: fix, last: fix, lastSeen: fix.t, path: [[fix.lng, fix.lat, Math.max(0, fix.t - w.startedAt)]], recent: [[fix.t, 0]], window: win };
  }
  const d = haversine(w.anchor, fix);
  const dt = Math.max(1, fix.t - w.anchor.t) / 1000;
  // A point only counts once it is clear of the GPS wobble around the last counted point.
  const wobble = Math.max(2, Math.min(6, (fix.accuracy + w.anchor.accuracy) * 0.15));
  let next: WalkState = { ...w, last: fix, lastSeen: fix.t, window: win };
  if (d >= wobble) {
    const speed = d / dt;
    if (speed > MAX_HUMAN_SPEED) return { ...w, last: fix, lastSeen: fix.t }; // GPS jump: skip it, keep the anchor
    next = {
      ...next,
      anchor: fix,
      firstMoveAt: next.firstMoveAt ?? fix.t,
      distanceM: next.distanceM + d,
      movingMs: next.movingMs + Math.min(dt, 10) * 1000,
      maxSpeed: Math.max(next.maxSpeed, Math.min(speed, MAX_HUMAN_SPEED)),
      path: [...next.path, [fix.lng, fix.lat, fix.t - w.startedAt]],
      recent: [...next.recent.filter(([t]) => fix.t - t <= 15000), [fix.t, next.distanceM + d]],
    };
    if (next.stepsSource === 'estimate') next.steps = Math.round(next.distanceM / STRIDE_M);
  }
  return updateStop(next, fix, prevT);
}

/** Called on a timer so a stop that is still going on shows up live (GPS may go quiet when standing). */
export function tick(w: WalkState, now: number): WalkState {
  if (w.pausedAt || !w.anchor) return w;
  // Only when no fix at all has arrived for a while (some phones stop sending them when you stand still).
  if (w.stillSince === null && w.firstMoveAt !== null && now - w.lastSeen >= STOP_MIN_S * 1000) {
    const at = w.last || w.anchor;
    return { ...w, stillSince: w.lastSeen, stopAt: at ? { lat: at.lat, lng: at.lng } : null };
  }
  return w;
}

export function pause(w: WalkState, now: number): WalkState { return w.pausedAt ? w : { ...closeStop(w, now), pausedAt: now }; }
export function resume(w: WalkState, now: number): WalkState { return w.pausedAt ? { ...w, pausedMs: w.pausedMs + (now - w.pausedAt), pausedAt: null, anchor: null, stillSince: null, stopAt: null, window: [], lastSeen: now } : w; }

export function mark(w: WalkState, kind: WalkMark['kind'], now: number): WalkState {
  const at = w.last || w.anchor;
  if (!at) return w;
  return { ...w, marks: [...w.marks, { kind, lat: at.lat, lng: at.lng, t: now - w.startedAt }] };
}

/** Steps from the phone's motion sensor replace the stride estimate once they start arriving. */
export function addSteps(w: WalkState, n: number): WalkState {
  return w.stepsSource === 'motion' ? { ...w, steps: w.steps + n } : { ...w, stepsSource: 'motion', steps: n };
}

/** Live speed (m/s) over the last ~15 seconds; 0 when stopped. */
export function currentSpeed(w: WalkState, now: number) {
  if (w.stillSince !== null && now - w.stillSince >= STOP_MIN_S * 1000) return 0;
  const r = w.recent;
  if (r.length < 2) return 0;
  const [t0, d0] = r[0], [t1, d1] = r[r.length - 1];
  return t1 > t0 ? (d1 - d0) / ((t1 - t0) / 1000) : 0;
}

export function summary(w: WalkState, now: number) {
  const finished = closeStop(w, now);
  const durationS = Math.round(elapsedMs(w, now) / 1000);
  const movingS = Math.round(finished.movingMs / 1000);
  const stopTotal = finished.stops.reduce((s, x) => s + (x.end - x.start), 0) / 1000;
  return {
    durationS, movingS,
    distanceM: Math.round(finished.distanceM * 10) / 10,
    avgSpeed: durationS > 0 ? finished.distanceM / durationS : 0,
    movingSpeed: movingS > 0 ? finished.distanceM / movingS : 0,
    maxSpeed: finished.maxSpeed,
    stops: finished.stops.length,
    avgStopS: finished.stops.length ? Math.round(stopTotal / finished.stops.length) : 0,
    steps: finished.steps,
    stepsSource: finished.stepsSource,
    pee: finished.marks.filter((m) => m.kind === 'pee').length,
    poop: finished.marks.filter((m) => m.kind === 'poop').length,
  };
}

/** Keeps saved paths small: drops points closer than `minM` to the previous kept point. */
export function thinPath(path: [number, number, number][], minM = 4, max = 5000) {
  if (path.length <= 2) return path;
  const out: [number, number, number][] = [path[0]];
  for (let i = 1; i < path.length - 1; i += 1) {
    const prev = out[out.length - 1];
    if (haversine({ lng: prev[0], lat: prev[1] }, { lng: path[i][0], lat: path[i][1] }) >= minM) out.push(path[i]);
  }
  out.push(path[path.length - 1]);
  if (out.length <= max) return out;
  const step = Math.ceil(out.length / max);
  return out.filter((_, i) => i % step === 0 || i === out.length - 1);
}

// ---------- display ----------

export type Units = 'miles' | 'km';
export const fmtDistance = (m: number, u: Units) => u === 'km' ? `${(m / 1000).toFixed(2)} km` : `${(m / 1609.344).toFixed(2)} mi`;
export const fmtSpeed = (mps: number, u: Units) => u === 'km' ? `${(mps * 3.6).toFixed(1)} km/h` : `${(mps * 2.23694).toFixed(1)} mph`;
export function fmtDuration(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}

// ---------- step counter (DeviceMotion) ----------

/**
 * Counts steps from the accelerometer: a step is a peak in the smoothed acceleration magnitude
 * above a moving baseline, at least 280 ms after the last one. Works with the phone in a hand or
 * pocket on Android Chrome; iOS needs a permission tap first.
 */
export function createStepCounter(onSteps: (n: number) => void) {
  let smooth = 9.81, baseline = 9.81, lastStep = 0, rising = false, peak = 0, pending = 0;
  const handler = (e: DeviceMotionEvent) => {
    const a = e.accelerationIncludingGravity;
    if (!a || a.x === null || a.y === null || a.z === null) return;
    const mag = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
    smooth = smooth * 0.75 + mag * 0.25;
    baseline = baseline * 0.98 + smooth * 0.02;
    const now = performance.now();
    if (smooth > baseline + 0.9) { rising = true; peak = Math.max(peak, smooth); }
    else if (rising && smooth < baseline) {
      rising = false;
      if (now - lastStep > 280 && peak - baseline > 1.2) { lastStep = now; pending += 1; }
      peak = 0;
    }
  };
  const flush = window.setInterval(() => { if (pending) { onSteps(pending); pending = 0; } }, 1000);
  return {
    async start() {
      const DM = (window as unknown as { DeviceMotionEvent?: { requestPermission?: () => Promise<string> } }).DeviceMotionEvent;
      if (!DM) return false;
      try { if (typeof DM.requestPermission === 'function' && (await DM.requestPermission()) !== 'granted') return false; } catch { return false; }
      window.addEventListener('devicemotion', handler);
      return true;
    },
    stop() { window.removeEventListener('devicemotion', handler); window.clearInterval(flush); },
  };
}
