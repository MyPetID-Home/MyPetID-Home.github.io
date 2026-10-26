/**
 * Daily and weekly walk statistics (pure). Weeks start on Monday, days are the phone's local days.
 */

export type WalkRecord = { start: number; durationS: number; movingS: number; distanceM: number; steps: number | null; stepsEstimated?: boolean; stops: number; pee: number; poop: number; maxSpeed: number | null };
export type Totals = { walks: number; distanceM: number; durationS: number; movingS: number; steps: number; stepsKnown: boolean; stops: number; pee: number; poop: number };

const DAY = 86_400_000;

export function startOfDay(t: number) { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); }
export function startOfWeek(t: number) {
  const d = new Date(startOfDay(t));
  const offset = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - offset);
  return d.getTime();
}

export function totals(walks: WalkRecord[]): Totals {
  return walks.reduce<Totals>((t, w) => ({
    walks: t.walks + 1,
    distanceM: t.distanceM + w.distanceM,
    durationS: t.durationS + w.durationS,
    movingS: t.movingS + w.movingS,
    // Walks without a step count use the same stride estimate as the live tracker (0.75 m).
    steps: t.steps + (w.steps ?? Math.round(w.distanceM / 0.75)),
    stepsKnown: t.stepsKnown || (w.steps !== null && !w.stepsEstimated),
    stops: t.stops + w.stops,
    pee: t.pee + w.pee,
    poop: t.poop + w.poop,
  }), { walks: 0, distanceM: 0, durationS: 0, movingS: 0, steps: 0, stepsKnown: false, stops: 0, pee: 0, poop: 0 });
}

const between = (walks: WalkRecord[], from: number, to: number) => walks.filter((w) => w.start >= from && w.start < to);

/** Days in a row (ending today, or yesterday if there's no walk yet today) with at least one walk. */
export function streak(walks: WalkRecord[], now: number) {
  const days = new Set(walks.map((w) => startOfDay(w.start)));
  let day = startOfDay(now);
  if (!days.has(day)) day -= DAY;
  let n = 0;
  while (days.has(day)) { n += 1; day = startOfDay(day - DAY / 2); }
  return n;
}

export function walkStats(walks: WalkRecord[], now = Date.now()) {
  const today = startOfDay(now);
  const week = startOfWeek(now);
  const lastWeek = week - 7 * DAY;
  const thisWeekWalks = between(walks, week, week + 7 * DAY);
  // Last week up to the same point in the week, so the comparison is fair mid-week.
  const lastWeekSoFar = between(walks, lastWeek, lastWeek + (now - week));
  const days = Array.from({ length: 7 }, (_, i) => {
    const from = startOfDay(today - (6 - i) * DAY + DAY / 2);
    const to = startOfDay(from + DAY + DAY / 2);
    return { day: from, ...totals(between(walks, from, to)) };
  });
  const all = totals(walks);
  const longest = walks.reduce<WalkRecord | null>((best, w) => (!best || w.distanceM > best.distanceM ? w : best), null);
  const fastest = walks.filter((w) => w.durationS >= 120).reduce<WalkRecord | null>((best, w) => (!best || w.distanceM / w.durationS > best.distanceM / best.durationS ? w : best), null);
  return {
    today: totals(between(walks, today, today + DAY)),
    week: totals(thisWeekWalks),
    lastWeekSoFar: totals(lastWeekSoFar),
    lastWeek: totals(between(walks, lastWeek, week)),
    days,
    all,
    avg: all.walks ? { distanceM: all.distanceM / all.walks, durationS: all.durationS / all.walks, speed: all.durationS ? all.distanceM / all.durationS : 0, stops: all.stops / all.walks, steps: all.stepsKnown ? all.steps / all.walks : null } : null,
    longest,
    fastest,
    streak: streak(walks, now),
    activeDaysThisWeek: new Set(thisWeekWalks.map((w) => startOfDay(w.start))).size,
  };
}

/** Percentage change, or null when there's nothing to compare against. */
export function change(now: number, before: number) {
  if (before <= 0) return now > 0 ? null : 0;
  return Math.round(((now - before) / before) * 100);
}
