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

/**
 * Side view of the logo dog (a muscular, prick-eared yellow pit mix), facing right. While
 * `walking`, the legs move in a real dog walk: diagonal pairs swing together, with the far legs
 * a shade darker. `facing` flips him to face left. He stands still when not walking.
 */
export function MascotWalker({ size = 64, walking = true, facing = 'right' }: { size?: number; walking?: boolean; facing?: 'left' | 'right' }) {
  // One shape per leg, paw included: a tapered leg that ends in a rounded paw on the ground line.
  const leg = (x: number, y: number, far: boolean, phase: 'a' | 'b', front: boolean) => (
    <g className={`${styles.leg} ${phase === 'a' ? styles.phaseA : styles.phaseB}`} style={{ transformOrigin: `${x + 6}px ${y}px` }}>
      <path d={front
        ? `M${x} ${y} C${x} ${y + 12} ${x + 1} ${y + 24} ${x + 1} ${y + 33} C${x - 2} ${y + 34} ${x - 3} ${y + 38} ${x} ${y + 39} L${x + 13} ${y + 39} C${x + 15} ${y + 36} ${x + 13} ${y + 33} ${x + 11} ${y + 33} C${x + 11} ${y + 22} ${x + 12} ${y + 12} ${x + 12} ${y} Z`
        : `M${x - 3} ${y - 4} C${x - 4} ${y + 8} ${x + 2} ${y + 14} ${x + 2} ${y + 20} C${x + 1} ${y + 26} ${x + 1} ${y + 30} ${x + 1} ${y + 34} C${x - 2} ${y + 35} ${x - 3} ${y + 39} ${x} ${y + 40} L${x + 13} ${y + 40} C${x + 15} ${y + 37} ${x + 13} ${y + 34} ${x + 11} ${y + 34} C${x + 11} ${y + 26} ${x + 13} ${y + 18} ${x + 15} ${y + 10} C${x + 16} ${y + 4} ${x + 14} ${y - 2} ${x + 12} ${y - 4} Z`}
        fill={far ? SHADE : FUR} stroke={INK} strokeWidth="2.8" strokeLinejoin="round" />
      <path d={`M${x + 3} ${y + 36} v3 M${x + 7} ${y + 36} v3`} stroke={INK} strokeWidth="1.4" strokeLinecap="round" opacity=".55" />
    </g>
  );
  return (
    <svg className={`${styles.walker} ${walking ? styles.walking : ''}`} width={size} height={size * 0.72} viewBox="0 0 150 108" style={facing === 'left' ? { transform: 'scaleX(-1)' } : undefined} aria-hidden="true">
      <ellipse cx="74" cy="102" rx="50" ry="5" fill="rgba(0,0,0,.28)" />
      {/* far legs (behind the body) */}
      {leg(44, 58, true, 'b', false)}
      {leg(100, 60, true, 'a', true)}
      {/* tail */}
      <path className={styles.tail} d="M36 50 Q22 46 18 30" fill="none" stroke={INK} strokeWidth="8" strokeLinecap="round" />
      <path className={styles.tail} d="M36 50 Q22 46 18 30" fill="none" stroke={FUR} strokeWidth="4" strokeLinecap="round" />
      {/* body: deep chest at the front, tucked waist, strong hindquarters */}
      <path d="M34 50 C33 38 46 33 62 35 C78 37 90 33 104 31 C116 29 122 36 121 48 C120 60 112 68 101 68 C92 68 86 63 78 62 C68 61 60 66 50 66 C40 66 35 60 34 50 Z" fill={FUR} stroke={INK} strokeWidth="3.2" strokeLinejoin="round" />
      <path d="M88 64 C96 69 106 70 114 63" fill="none" stroke={LIGHT} strokeWidth="5" strokeLinecap="round" />
      <path d="M58 40 C66 43 74 43 84 39" fill="none" stroke={SHADE} strokeWidth="2.4" strokeLinecap="round" />
      {/* near legs */}
      {leg(48, 58, false, 'a', false)}
      {leg(106, 60, false, 'b', true)}
      {/* neck and head */}
      <g className={styles.headBob}>
        <path d="M104 36 C108 26 116 20 124 20 L128 40 C122 44 112 46 106 46 Z" fill={FUR} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
        <path d="M110 38 Q118 44 128 38" fill="none" stroke="#57d7ff" strokeWidth="4.5" strokeLinecap="round" />
        <circle cx="119" cy="44" r="3.2" fill="#c9a227" stroke={INK} strokeWidth="1.6" />
        <path d="M120 10 L124 -6 L133 9 Z" fill={FUR} stroke={INK} strokeWidth="2.8" strokeLinejoin="round" />
        <path d="M123 4 L125 -1 L128 6 Z" fill={SHADE} />
        <path d="M112 20 C112 8 130 4 138 12 C142 16 142 22 140 25 L148 27 C152 28 152 36 147 38 L134 40 C124 42 112 34 112 20 Z" fill={FUR} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
        <path d="M138 26 C142 30 146 31 150 30" fill="none" stroke={INK} strokeWidth="1.6" strokeLinecap="round" opacity=".5" />
        <path d="M134 37 C140 40 146 39 148 36" fill={LIGHT} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
        <ellipse cx="149" cy="29.5" rx="3.6" ry="3" fill={INK} />
        <circle cx="128" cy="19" r="2.6" fill={INK} /><circle cx="128.8" cy="18.2" r=".8" fill="#fff" />
        <path d="M124 14 Q128 12 132 14" fill="none" stroke={SHADE} strokeWidth="2" strokeLinecap="round" />
      </g>
    </svg>
  );
}
