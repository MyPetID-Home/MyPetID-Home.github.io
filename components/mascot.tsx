"use client";

import styles from './mascot.module.css';

/**
 * The MyPetID logo dog as a small drawn mascot: peeking over an edge (tips, walkthrough, empty
 * states) or walking side-on (the live walk marker on the map). Colors follow the logo.
 */

const FUR = '#f2b630';
const SHADE = '#d9961a';
const LIGHT = '#f8d27a';
const INK = '#3a2a12';

export function MascotHead({ size = 72, blink = true, className = '' }: { size?: number; blink?: boolean; className?: string }) {
  return (
    <svg className={`${styles.head} ${blink ? styles.blink : ''} ${className}`} width={size} height={size * 0.86} viewBox="0 0 120 103" aria-hidden="true">
      <path d="M24 46 L30 6 L52 34 Z" fill={FUR} stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M30 14 L33 34 L44 32 Z" fill={SHADE} />
      <path d="M96 46 L90 6 L68 34 Z" fill={FUR} stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M90 14 L87 34 L76 32 Z" fill={SHADE} />
      <ellipse cx="60" cy="58" rx="38" ry="33" fill={FUR} stroke={INK} strokeWidth="3.5" />
      <path d="M40 40 Q60 30 80 40" fill="none" stroke={SHADE} strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="60" cy="74" rx="20" ry="14" fill={LIGHT} stroke={INK} strokeWidth="3" />
      <g className={styles.eyes}><circle cx="45" cy="54" r="4.6" fill={INK} /><circle cx="75" cy="54" r="4.6" fill={INK} /><circle cx="46.5" cy="52.5" r="1.4" fill="#fff" /><circle cx="76.5" cy="52.5" r="1.4" fill="#fff" /></g>
      <ellipse cx="60" cy="66" rx="7.5" ry="5.5" fill={INK} />
      <path d="M52 78 Q60 84 68 78" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      <path d="M60 71 V78" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/** Head and two paws hooked over the bottom edge of whatever it sits on. */
export function MascotPeek({ size = 72, message, className = '' }: { size?: number; message?: string; className?: string }) {
  return (
    <div className={`${styles.peek} ${className}`} style={{ width: size }}>
      {message && <span className={styles.bubble}>{message}</span>}
      <MascotHead size={size} />
      <svg className={styles.paws} width={size} height={size * 0.22} viewBox="0 0 120 26" aria-hidden="true">
        <ellipse cx="34" cy="13" rx="15" ry="10" fill={FUR} stroke={INK} strokeWidth="3.5" />
        <path d="M28 8 v8 M34 7 v9 M40 8 v8" stroke={SHADE} strokeWidth="2" strokeLinecap="round" />
        <ellipse cx="86" cy="13" rx="15" ry="10" fill={FUR} stroke={INK} strokeWidth="3.5" />
        <path d="M80 8 v8 M86 7 v9 M92 8 v8" stroke={SHADE} strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
}

/** Side view, facing right. Legs and tail move while `walking`. */
export function MascotWalker({ size = 56, walking = true, heading = 0 }: { size?: number; walking?: boolean; heading?: number }) {
  // Face the way we're going: flip when heading west.
  const flip = heading > 180 && heading < 360;
  return (
    <svg className={`${styles.walker} ${walking ? styles.walking : ''}`} width={size} height={size * 0.66} viewBox="0 0 140 92" style={flip ? { transform: 'scaleX(-1)' } : undefined} aria-hidden="true">
      <ellipse cx="72" cy="86" rx="48" ry="5" fill="rgba(0,0,0,.25)" />
      <path className={styles.tail} d="M34 44 Q16 34 20 16" fill="none" stroke={INK} strokeWidth="9" strokeLinecap="round" />
      <path className={styles.tail} d="M34 44 Q16 34 20 16" fill="none" stroke={FUR} strokeWidth="5" strokeLinecap="round" />
      <g className={styles.legBack}><rect x="40" y="50" width="11" height="32" rx="5.5" fill={SHADE} stroke={INK} strokeWidth="3" /></g>
      <g className={styles.legFront}><rect x="92" y="50" width="11" height="32" rx="5.5" fill={SHADE} stroke={INK} strokeWidth="3" /></g>
      <ellipse cx="72" cy="48" rx="42" ry="19" fill={FUR} stroke={INK} strokeWidth="3.5" />
      <path d="M48 56 Q72 64 96 56" fill="none" stroke={LIGHT} strokeWidth="4" strokeLinecap="round" />
      <g className={styles.legFront}><rect x="54" y="52" width="11" height="32" rx="5.5" fill={FUR} stroke={INK} strokeWidth="3" /></g>
      <g className={styles.legBack}><rect x="104" y="52" width="11" height="32" rx="5.5" fill={FUR} stroke={INK} strokeWidth="3" /></g>
      <g className={styles.headBob}>
        <path d="M106 22 L110 0 L122 18 Z" fill={FUR} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
        <circle cx="114" cy="30" r="17" fill={FUR} stroke={INK} strokeWidth="3.5" />
        <ellipse cx="128" cy="36" rx="11" ry="8" fill={LIGHT} stroke={INK} strokeWidth="3" />
        <circle cx="137" cy="33" r="3.5" fill={INK} />
        <circle cx="117" cy="26" r="3" fill={INK} />
        <path d="M100 40 Q108 48 120 46" fill="none" stroke="#57d7ff" strokeWidth="4" strokeLinecap="round" />
      </g>
    </svg>
  );
}
