/** 12 or 24 hour clock preference (per device), used wherever the app shows a time. */
export type ClockPref = 'auto' | '12' | '24';
const KEY = 'mypetid.clock';
export const CLOCK_EVENT = 'mypetid:clock';

export function getClockPref(): ClockPref {
  if (typeof window === 'undefined') return 'auto';
  try { const v = localStorage.getItem(KEY); return v === '12' || v === '24' ? v : 'auto'; } catch { return 'auto'; }
}

export function setClockPref(pref: ClockPref) {
  try { if (pref === 'auto') localStorage.removeItem(KEY); else localStorage.setItem(KEY, pref); } catch { /* storage blocked */ }
  window.dispatchEvent(new CustomEvent(CLOCK_EVENT, { detail: pref }));
}

/** Options to spread into toLocaleTimeString so it follows the preference. */
export function hourOptions(): { hour12?: boolean } {
  const pref = getClockPref();
  return pref === 'auto' ? {} : { hour12: pref === '12' };
}
