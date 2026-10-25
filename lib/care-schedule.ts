/**
 * Care schedule maths (pure, no React). Items live in pets.profile.care_schedule; times are
 * wall-clock 'HH:MM' in the owner's IANA zone (pets.profile.timezone).
 */

export type CareKind = 'medicine' | 'meal' | 'walk' | 'play' | 'grooming' | 'vet' | 'other';
export const CARE_KINDS: CareKind[] = ['medicine', 'meal', 'walk', 'play', 'grooming', 'vet', 'other'];

export type CareItem = {
  id: string;
  kind: CareKind;
  label: string;
  /** 'HH:MM' 24h wall-clock times. */
  times: string[];
  /** 0 = Sunday .. 6 = Saturday; empty = every day. */
  days: number[];
  dose?: string;
  note?: string;
  alarm: boolean;
  /** Shown to a finder on the public scan page. */
  public: boolean;
};

export type CareLogEntry = { id: string; at: string };

export type CareIconName = 'Heart' | 'Bowl' | 'Footprints' | 'Sparkles' | 'Scissors' | 'Stethoscope' | 'Bell';
export type CareTone = '' | 'green' | 'blue' | 'red' | 'violet';

export const KIND_META: Record<CareKind, { label: string; icon: CareIconName; tone: CareTone }> = {
  medicine: { label: 'Medicine', icon: 'Heart', tone: 'red' },
  meal: { label: 'Meal', icon: 'Bowl', tone: '' },
  walk: { label: 'Walk', icon: 'Footprints', tone: 'green' },
  play: { label: 'Play', icon: 'Sparkles', tone: 'violet' },
  grooming: { label: 'Grooming', icon: 'Scissors', tone: 'blue' },
  vet: { label: 'Vet', icon: 'Stethoscope', tone: 'blue' },
  other: { label: 'Other', icon: 'Bell', tone: '' },
};

export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MAX_CARE_LOG = 200;

const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

export function isValidTime(value: string) {
  return TIME_RE.test(value.trim());
}

/** Normalises 'H:MM' to 'HH:MM'; returns '' if invalid. */
export function normalizeTime(value: string) {
  const m = TIME_RE.exec(value.trim());
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Narrows untrusted JSON (profile.care_schedule) into CareItems, dropping anything unusable. */
export function parseSchedule(raw: unknown): CareItem[] {
  if (!Array.isArray(raw)) return [];
  const out: CareItem[] = [];
  for (const entry of raw as unknown[]) {
    if (!isRecord(entry)) continue;
    const id = typeof entry.id === 'string' && entry.id ? entry.id : '';
    if (!id) continue;
    const kind = CARE_KINDS.includes(entry.kind as CareKind) ? (entry.kind as CareKind) : 'other';
    const times = Array.isArray(entry.times)
      ? Array.from(new Set((entry.times as unknown[]).filter((t): t is string => typeof t === 'string').map(normalizeTime).filter(Boolean))).sort()
      : [];
    const days = Array.isArray(entry.days)
      ? Array.from(new Set((entry.days as unknown[]).filter((d): d is number => typeof d === 'number' && Number.isInteger(d) && d >= 0 && d <= 6))).sort()
      : [];
    const label = typeof entry.label === 'string' && entry.label.trim() ? entry.label.trim() : KIND_META[kind].label;
    out.push({
      id,
      kind,
      label,
      times,
      days,
      dose: typeof entry.dose === 'string' && entry.dose.trim() ? entry.dose.trim() : undefined,
      note: typeof entry.note === 'string' && entry.note.trim() ? entry.note.trim() : undefined,
      alarm: entry.alarm === true,
      public: typeof entry.public === 'boolean' ? entry.public : kind === 'medicine',
    });
  }
  return out;
}

export function parseCareLog(raw: unknown): CareLogEntry[] {
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[]).filter((e): e is CareLogEntry => isRecord(e) && typeof e.id === 'string' && typeof e.at === 'string' && !Number.isNaN(Date.parse(e.at)));
}

export function isValidTimeZone(tz: string | undefined | null): tz is string {
  if (!tz) return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; }
}

export function deviceTimeZone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
}

const partsCache = new Map<string, Intl.DateTimeFormat>();
function zoneFormatter(timeZone: string) {
  let f = partsCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
    partsCache.set(timeZone, f);
  }
  return f;
}

/** Wall-clock fields of an instant in a zone. */
export function zonedParts(date: Date, timeZone: string) {
  const parts = zoneFormatter(timeZone).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value || 0);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour') % 24, minute: get('minute'), second: get('second') };
}

/** Offset of the zone from UTC at an instant, in ms (e.g. -4h for New York in summer). */
export function zoneOffsetMs(date: Date, timeZone: string) {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - (date.getTime() - date.getMilliseconds());
}

/**
 * The instant at which the zone's wall clock reads y-m-d h:mi. For a time skipped by a DST jump
 * this lands just after the jump; for a repeated hour it picks the first occurrence.
 */
export function zonedTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, timeZone: string) {
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  let guess = wall - zoneOffsetMs(new Date(wall), timeZone);
  const second = wall - zoneOffsetMs(new Date(guess), timeZone);
  if (second !== guess) {
    // Offset changed between guesses (DST edge). Prefer the earlier candidate that still maps to this wall time.
    const earlier = Math.min(guess, second);
    const later = Math.max(guess, second);
    const check = zonedParts(new Date(earlier), timeZone);
    guess = check.hour === hour && check.minute === minute ? earlier : later;
  }
  return new Date(guess);
}

function safeZone(timeZone: string) {
  return isValidTimeZone(timeZone) ? timeZone : 'UTC';
}

/**
 * Next occurrence of an item at or after (now - graceMs), honoring its days and times in timeZone.
 * graceMs lets callers keep a just-passed occurrence (to show "12 min overdue"). Null when the item has no times.
 */
export function nextOccurrence(item: Pick<CareItem, 'times' | 'days'>, now: Date, timeZone: string, graceMs = 0): Date | null {
  const times = item.times.map(normalizeTime).filter(Boolean).sort();
  if (!times.length) return null;
  const tz = safeZone(timeZone);
  const from = now.getTime() - Math.max(0, graceMs);
  const start = zonedParts(new Date(from), tz);
  for (let offset = -1; offset <= 8; offset += 1) {
    const cal = new Date(Date.UTC(start.year, start.month - 1, start.day + offset));
    const weekday = cal.getUTCDay();
    if (item.days.length && !item.days.includes(weekday)) continue;
    for (const t of times) {
      const [h, m] = t.split(':').map(Number);
      const at = zonedTimeToUtc(cal.getUTCFullYear(), cal.getUTCMonth() + 1, cal.getUTCDate(), h, m, tz);
      if (at.getTime() >= from) return at;
    }
  }
  return null;
}

/** True when a Done tap in the log covers the occurrence at `at` (tapped up to an hour early, or any time after). */
export function isOccurrenceDone(itemId: string, at: Date, log: CareLogEntry[] | undefined) {
  if (!log?.length) return false;
  const earliest = at.getTime() - 60 * 60_000;
  return log.some((e) => e.id === itemId && Date.parse(e.at) >= earliest);
}

/** Next occurrence that hasn't been marked done (skips ones covered by the log). */
export function nextPending(item: CareItem, now: Date, timeZone: string, graceMs = 0, log?: CareLogEntry[]): Date | null {
  let at = nextOccurrence(item, now, timeZone, graceMs);
  for (let i = 0; at && i < 8 && isOccurrenceDone(item.id, at, log); i += 1) {
    at = nextOccurrence(item, new Date(Math.max(at.getTime(), now.getTime() - graceMs) + 60_000), timeZone, 0);
  }
  return at;
}

export type UpcomingEntry<T extends CareItem = CareItem> = { item: T; at: Date; ms: number };

/** Upcoming occurrences across items, soonest first. */
export function upcoming<T extends CareItem>(items: T[], now: Date, timeZone: string, limit = 5, options: { graceMs?: number; log?: CareLogEntry[] } = {}): UpcomingEntry<T>[] {
  const list: UpcomingEntry<T>[] = [];
  for (const item of items) {
    const at = nextPending(item, now, timeZone, options.graceMs ?? 0, options.log);
    if (at) list.push({ item, at, ms: at.getTime() - now.getTime() });
  }
  list.sort((a, b) => a.at.getTime() - b.at.getTime());
  return list.slice(0, Math.max(0, limit));
}

function hm(totalMin: number) {
  const days = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (days) return h ? `${days} d ${h} h` : `${days} d`;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** ms until the occurrence (negative = past): "in 15 min", "in 2 h 5 min", "now", "12 min overdue". */
export function formatCountdown(ms: number) {
  if (Math.abs(ms) < 60_000) return 'now';
  if (ms > 0) return `in ${hm(Math.ceil(ms / 60_000))}`;
  return `${hm(Math.floor(-ms / 60_000))} overdue`;
}

/** '18:30' -> '6:30 PM' (locale aware). */
export function formatClock(time: string, locale?: string) {
  const t = normalizeTime(time);
  if (!t) return time;
  const [h, m] = t.split(':').map(Number);
  return new Date(Date.UTC(2000, 0, 1, h, m)).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
}

/** An instant's time in the viewer's zone (or a given zone), e.g. '6:00 PM'. */
export function formatInstant(date: Date, timeZone?: string) {
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', ...(timeZone && isValidTimeZone(timeZone) ? { timeZone } : {}) });
}

export function formatDays(days: number[]) {
  if (!days.length || days.length === 7) return 'Every day';
  const sorted = [...days].sort();
  if (sorted.join() === '1,2,3,4,5') return 'Weekdays';
  if (sorted.join() === '0,6') return 'Weekends';
  return sorted.map((d) => DAY_LABELS[d]).join(', ');
}

/** "today" / "tomorrow" / weekday name, relative to now in the viewer's zone. */
export function dayWord(at: Date, now: Date) {
  const a = new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime();
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diff = Math.round((a - b) / 86_400_000);
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff === -1) return 'yesterday';
  return at.toLocaleDateString(undefined, { weekday: 'long' });
}

export function newCareId() {
  const c = typeof globalThis !== 'undefined' ? (globalThis as { crypto?: Crypto }).crypto : undefined;
  if (c?.randomUUID) return c.randomUUID();
  return `care-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Appends a Done tap, keeping the last MAX_CARE_LOG entries. */
export function appendCareLog(log: CareLogEntry[], itemId: string, at = new Date()) {
  return [...log, { id: itemId, at: at.toISOString() }].slice(-MAX_CARE_LOG);
}
