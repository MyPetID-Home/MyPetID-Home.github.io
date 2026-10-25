"use client";

import type { CareKind } from '../lib/care-schedule';
import styles from './alarm-art.module.css';

/** Big animated picture for each alarm kind, so a ringing alarm is obvious at a glance. */
export function AlarmArt({ kind }: { kind: CareKind }) {
  return (
    <div className={`${styles.art} ${styles[kind] || ''}`} aria-hidden="true">
      <span className={styles.ring} /><span className={`${styles.ring} ${styles.ring2}`} />
      <svg viewBox="0 0 120 120" className={styles.icon}>
        {kind === 'medicine' && <g className={styles.pill}><rect x="22" y="46" width="76" height="28" rx="14" fill="#fff" stroke="currentColor" strokeWidth="5" /><path d="M60 46 h24 a14 14 0 0 1 0 28 h-24 z" fill="currentColor" /></g>}
        {kind === 'meal' && <g><g className={styles.steam}><path d="M44 30 q6 -8 0 -16 M60 28 q6 -8 0 -16 M76 30 q6 -8 0 -16" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" /></g><g className={styles.wiggle}><path d="M18 58 h84 a42 34 0 0 1 -84 0 z" fill="currentColor" /><ellipse cx="60" cy="58" rx="42" ry="8" fill="#fff" opacity=".35" /></g></g>}
        {kind === 'walk' && <g className={styles.steps}><path d="M30 92 c-6 0 -9 -6 -9 -13 c0 -9 5 -16 10 -16 c5 0 8 7 8 15 c0 8 -3 14 -9 14z" fill="currentColor" /><path d="M66 62 c-6 0 -9 -6 -9 -13 c0 -9 5 -16 10 -16 c5 0 8 7 8 15 c0 8 -3 14 -9 14z" fill="currentColor" /><path d="M92 36 c-6 0 -9 -6 -9 -13 c0 -9 5 -16 10 -16 c5 0 8 7 8 15 c0 8 -3 14 -9 14z" fill="currentColor" /></g>}
        {kind === 'play' && <g className={styles.ball}><circle cx="60" cy="56" r="24" fill="currentColor" /><path d="M38 48 q22 14 44 0 M38 64 q22 -14 44 0" fill="none" stroke="#fff" strokeWidth="4" /></g>}
        {kind === 'grooming' && <g className={styles.sparkle}><path d="M60 18 l8 26 26 8 -26 8 -8 26 -8 -26 -26 -8 26 -8z" fill="currentColor" /><path d="M94 82 l3 9 9 3 -9 3 -3 9 -3 -9 -9 -3 9 -3z" fill="currentColor" /></g>}
        {kind === 'vet' && <g className={styles.pulse}><path d="M60 98 C 24 72 14 52 24 36 c10 -14 28 -10 36 4 c8 -14 26 -18 36 -4 c10 16 0 36 -36 62z" fill="currentColor" /><path d="M30 60 h18 l6 -12 8 24 6 -12 h22" fill="none" stroke="#fff" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" /></g>}
        {kind === 'other' && <g className={styles.bell}><path d="M60 16 c18 0 28 14 28 32 v18 l10 14 H22 l10 -14 V48 c0 -18 10 -32 28 -32z" fill="currentColor" /><circle cx="60" cy="92" r="9" fill="currentColor" /></g>}
      </svg>
    </div>
  );
}
