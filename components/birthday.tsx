"use client";

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Sparkles } from './icons';
import styles from './care-schedule.module.css';

/** Parses 'YYYY-MM-DD' (or a full ISO string) or 'MM-DD' into month/day (+ year when present). */
function parseBirthday(value: string | undefined): { year: number | null; month: number; day: number } | null {
  if (!value) return null;
  const v = value.trim();
  const full = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(v);
  const short = full ? null : /^(\d{1,2})-(\d{1,2})$/.exec(v);
  const year = full ? Number(full[1]) : null;
  const month = Number(full ? full[2] : short?.[1]);
  const day = Number(full ? full[3] : short?.[2]);
  if (!month || !day || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

function isLeap(year: number) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** The birthday's local date in a given year (Feb 29 falls on Feb 28 in non-leap years). */
function birthdayInYear(month: number, day: number, year: number) {
  const d = month === 2 && day === 29 && !isLeap(year) ? 28 : day;
  return new Date(year, month - 1, d);
}

export function isBirthdayToday(birthdayIsoOrMd: string | undefined, now: Date = new Date()) {
  const b = parseBirthday(birthdayIsoOrMd);
  if (!b) return false;
  const target = birthdayInYear(b.month, b.day, now.getFullYear());
  return target.getMonth() === now.getMonth() && target.getDate() === now.getDate();
}

/** Whole days until the next birthday (0 = today). */
export function daysUntilBirthday(birthdayIsoOrMd: string | undefined, now: Date = new Date()): number | null {
  const b = parseBirthday(birthdayIsoOrMd);
  if (!b) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = birthdayInYear(b.month, b.day, today.getFullYear());
  if (next.getTime() < today.getTime()) next = birthdayInYear(b.month, b.day, today.getFullYear() + 1);
  return Math.round((next.getTime() - today.getTime()) / 86_400_000);
}

const CONFETTI_COLORS = ['var(--brand)', 'var(--brand2)', 'var(--violet)', 'var(--warn)', 'var(--danger)'];
const PIECES = Array.from({ length: 26 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  delay: `${((i * 0.27) % 3.4).toFixed(2)}s`,
  duration: `${(2.8 + ((i * 0.41) % 1.6)).toFixed(2)}s`,
  drift: `${((i % 2 ? 1 : -1) * (10 + ((i * 13) % 40)))}px`,
  y: `${8 + ((i * 29) % 80)}%`,
  r: `${(i * 47) % 180}deg`,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  round: i % 3 === 0,
}));

export function BirthdayBanner({ petName, birthday, ageYears }: { petName: string; birthday: string | undefined; ageYears?: number }) {
  const [now, setNow] = useState<Date | null>(null);
  const [shareNote, setShareNote] = useState('');

  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 60 * 60_000);
    return () => { window.clearTimeout(first); window.clearInterval(timer); };
  }, []);

  const name = petName.trim() || 'Your pet';
  const info = useMemo(() => {
    if (!now) return null;
    const days = daysUntilBirthday(birthday, now);
    if (days === null) return null;
    const parsed = parseBirthday(birthday);
    const age = typeof ageYears === 'number' && Number.isFinite(ageYears) ? Math.max(0, Math.round(ageYears))
      : parsed?.year ? now.getFullYear() - parsed.year : null;
    return { today: isBirthdayToday(birthday, now), days, age: age !== null && age > 0 ? age : null };
  }, [now, birthday, ageYears]);

  if (!info) return null;

  if (info.today) {
    const headline = `Happy birthday, ${name}! 🎂${info.age ? ` ${info.age} today` : ''}`;
    const share = async () => {
      const text = `It's ${name}'s birthday${info.age ? ` (${info.age} today)` : ''}! 🎂🐾`;
      const url = typeof window !== 'undefined' ? window.location.href : undefined;
      try {
        if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
          await navigator.share({ title: `${name}'s birthday`, text, url });
          return;
        }
        await navigator.clipboard.writeText(url ? `${text} ${url}` : text);
        setShareNote('Copied. Paste it anywhere to share.');
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setShareNote('Sharing is not available on this device.');
      }
    };
    return (
      <section className={`panel full ${styles.birthday}`} aria-label={`${name}'s birthday`}>
        <div className={styles.confetti} aria-hidden>
          {PIECES.map((p, i) => (
            <span key={i} style={{
              left: p.left, background: p.color, animationDelay: p.delay, animationDuration: p.duration,
              borderRadius: p.round ? '50%' : undefined, width: p.round ? 9 : undefined, height: p.round ? 9 : undefined,
              '--drift': p.drift, '--y': p.y, '--r': p.r,
            } as CSSProperties} />
          ))}
        </div>
        <span className="iconBubble violet"><Sparkles /></span>
        <h2>{headline}</h2>
        <p className="mutedLine">Extra treats and belly rubs are officially allowed.</p>
        <div className="actions compact">
          <button type="button" className="primary" onClick={share}>Share the celebration</button>
        </div>
        {shareNote && <p className="formHint" role="status">{shareNote}</p>}
      </section>
    );
  }

  if (info.days > 0 && info.days <= 7) {
    return (
      <p className={`mutedLine ${styles.birthdaySoon}`}><Sparkles /> {name}&apos;s birthday is {info.days === 1 ? 'tomorrow' : `in ${info.days} days`}</p>
    );
  }
  return null;
}
