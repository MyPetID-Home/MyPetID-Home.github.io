"use client";

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { hasSupabaseConfig, supabaseHealthCheck } from '../lib/supabase';

/**
 * Friendly screens for when something isn't working: offline, the database or maps are down,
 * a page or tag can't be found, an app error, or planned maintenance. Each has its own little scene.
 */
export type StatusKind = 'offline' | 'database' | 'maps' | 'notFound' | 'tagNotFound' | 'error' | 'maintenance';

const COPY: Record<StatusKind, { eyebrow: string; title: string; message: string }> = {
  offline: { eyebrow: 'No connection', title: 'Looks like we lost the leash', message: 'You’re offline. Anything you change on this device is kept and syncs when you’re back online.' },
  database: { eyebrow: 'Cloud account', title: 'Our servers are napping', message: 'We can’t reach MyPetID’s cloud right now. Your dog’s info on this device still works, and tag scans keep showing the last saved profile. Try again in a minute.' },
  maps: { eyebrow: 'Maps', title: 'The map ran off chasing a squirrel', message: 'The map tiles aren’t loading. Walk tracking and saved walks still work, and the map comes back as soon as the map service does.' },
  notFound: { eyebrow: '404', title: 'We sniffed everywhere', message: 'This page isn’t here. It may have moved, or the link has a typo.' },
  tagNotFound: { eyebrow: 'Tag not found', title: 'This tag isn’t linked yet', message: 'We couldn’t find a dog for this tag. If you found a dog, check its collar for a phone number or take it to a vet or shelter to scan for a microchip.' },
  error: { eyebrow: 'Something broke', title: 'Somebody chewed through a wire', message: 'An unexpected error stopped this page. It’s been noted. Try again, and if it keeps happening let us know.' },
  maintenance: { eyebrow: 'Maintenance', title: 'Getting a fresh grooming', message: 'MyPetID is being updated. Tag scans still work. Everything else is back shortly.' },
};

/** A friendly dog with a prop that changes with the problem. */
function Scene({ kind }: { kind: StatusKind }) {
  return (
    <svg className={`statusScene ${kind}`} viewBox="0 0 220 150" aria-hidden="true">
      <defs><linearGradient id={`ss-${kind}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="var(--brand)" /><stop offset="1" stopColor="var(--brand2)" /></linearGradient></defs>
      <ellipse cx="110" cy="138" rx="80" ry="8" fill="rgba(0,0,0,.25)" />
      {/* dog */}
      <g className="ssDog">
        <path d="M70 128 q-4 -40 40 -46 q44 6 40 46 z" fill="#c98d4d" />
        <circle cx="110" cy="66" r="30" fill="#d9a066" />
        <path className="ssEar l" d="M84 50 q-18 6 -14 34 q12 -4 18 -20 z" fill="#8a5a2b" />
        <path className="ssEar r" d="M136 50 q18 6 14 34 q-12 -4 -18 -20 z" fill="#8a5a2b" />
        <ellipse cx="110" cy="78" rx="14" ry="10" fill="#f1d3ad" />
        <ellipse cx="110" cy="73" rx="5" ry="3.5" fill="#1c2430" />
        {kind === 'database'
          ? <g stroke="#1c2430" strokeWidth="2.5" strokeLinecap="round" fill="none"><path d="M93 61 q5 5 10 0" /><path d="M117 61 q5 5 10 0" /></g>
          : kind === 'error'
          ? <g stroke="#1c2430" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"><path d="M94 58 l7 4 l-7 4" /><path d="M126 58 l-7 4 l7 4" /></g>
          :<g fill="#1c2430"><circle className="ssEye" cx="98" cy="62" r="3.5" /><circle className="ssEye" cx="122" cy="62" r="3.5" /></g>}
        <path d={kind === 'notFound' || kind === 'tagNotFound' || kind === 'maintenance' ? 'M104 84 q6 4 12 0' : 'M104 87 q6 -4 12 0'} stroke="#1c2430" strokeWidth="2" fill="none" strokeLinecap="round" />
        <rect x="88" y="94" width="44" height="7" rx="3.5" fill={`url(#ss-${kind})`} />
        <circle cx="110" cy="104" r="5" fill="#ffd36b" stroke="#9a6500" strokeWidth="1.5" />
      </g>
      {/* prop */}
      {kind === 'offline' && <g className="ssProp" stroke={`url(#ss-${kind})`} strokeWidth="4" fill="none" strokeLinecap="round"><path d="M110 104 q20 20 50 10 q20 -8 26 6" /><path d="M14 120 q16 -16 30 -8" strokeDasharray="3 6" /><path d="M186 120 l10 -6 M190 128 l12 -2" stroke="#ff7a7a" /></g>}
      {kind === 'database' && <g className="ssProp"><g fill={`url(#ss-${kind})`} opacity=".9"><ellipse cx="180" cy="74" rx="22" ry="7" /><rect x="158" y="74" width="44" height="40" /><ellipse cx="180" cy="114" rx="22" ry="7" /></g><path d="M166 90 h28 M166 102 h28" stroke="rgba(0,0,0,.25)" strokeWidth="2" /><text x="180" y="62" textAnchor="middle" fontSize="16" fill="var(--text, #fff)">z z</text></g>}
      {kind === 'maps' && <g className="ssProp"><path d="M156 80 l16 -6 l16 6 l16 -6 v44 l-16 6 l-16 -6 l-16 6 z" fill="#e8f3df" stroke={`url(#ss-${kind})`} strokeWidth="3" /><path d="M172 74 v44 M188 80 v44" stroke="#9fb39a" strokeWidth="2" /><text x="180" y="66" textAnchor="middle" fontSize="22" fontWeight="700" fill="var(--brand2)">?</text></g>}
      {(kind === 'notFound' || kind === 'tagNotFound') && <g className="ssProp"><g fill={`url(#ss-${kind})`}><rect x="22" y="104" width="44" height="12" rx="4" /><circle cx="22" cy="104" r="7" /><circle cx="22" cy="116" r="7" /><circle cx="66" cy="104" r="7" /><circle cx="66" cy="116" r="7" /></g><text x="44" y="96" textAnchor="middle" fontSize="18" fontWeight="800" fill="var(--text, #fff)">{kind === 'notFound' ? '404' : '?'}</text><g fill="var(--brand)" opacity=".5"><ellipse cx="160" cy="130" rx="5" ry="3" /><ellipse cx="178" cy="124" rx="5" ry="3" /><ellipse cx="196" cy="130" rx="5" ry="3" /></g></g>}
      {kind === 'error' && <g className="ssProp" fill={`url(#ss-${kind})`}><g transform="rotate(-18 170 104)"><rect x="152" y="98" width="20" height="12" rx="3" /><circle cx="152" cy="98" r="7" /><circle cx="152" cy="110" r="7" /></g><g transform="rotate(22 196 110)"><rect x="180" y="104" width="20" height="12" rx="3" /><circle cx="200" cy="104" r="7" /><circle cx="200" cy="116" r="7" /></g><path d="M176 92 l4 -10 l4 10" stroke="#ff7a7a" strokeWidth="3" fill="none" /></g>}
      {kind === 'maintenance' && <g className="ssProp"><path d="M160 120 l30 -30 a10 10 0 1 1 8 8 l-30 30 z" fill={`url(#ss-${kind})`} /><circle cx="196" cy="88" r="4" fill="var(--bg, #101712)" /><g fill="#d9f2ff" opacity=".8"><circle cx="40" cy="70" r="7" /><circle cx="54" cy="58" r="5" /><circle cx="34" cy="50" r="4" /></g></g>}
    </svg>
  );
}

type Action = { label: string; href?: string; onClick?: () => void; primary?: boolean };

export function StatusScreen({ kind, title, message, actions, compact = false, detail }: { kind: StatusKind; title?: string; message?: string; actions?: Action[]; compact?: boolean; detail?: string }) {
  const copy = COPY[kind];
  const list = actions ?? [{ label: 'Try again', onClick: () => window.location.reload(), primary: true }, { label: 'Go home', href: '/' }];
  return (
    <section className={`statusScreen${compact ? ' compact' : ''}`} role={kind === 'error' || kind === 'database' ? 'alert' : 'status'}>
      <Scene kind={kind} />
      <div>
        <p className="eyebrow">{copy.eyebrow}</p>
        <h2>{title || copy.title}</h2>
        <p>{message || copy.message}</p>
        {detail && <p className="formHint"><code>{detail}</code></p>}
        {list.length > 0 && <div className="actions">{list.map((a) => a.href
          ? <Link key={a.label} className={a.primary ? 'button primary' : 'button'} href={a.href}>{a.label}</Link>
          : <button key={a.label} type="button" className={a.primary ? 'primary' : ''} onClick={a.onClick}>{a.label}</button>)}</div>}
      </div>
    </section>
  );
}

/**
 * Watches the connection and the cloud database. When either is down it shows a small
 * banner (the page underneath keeps working with what's on the device).
 */
export function ServiceStatusBanner() {
  const [offline, setOffline] = useState(false);
  const [dbDown, setDbDown] = useState(false);
  const [hidden, setHidden] = useState(false);

  const check = useCallback(async () => {
    if (!hasSupabaseConfig || !navigator.onLine) return;
    setDbDown(!(await supabaseHealthCheck()));
  }, []);

  useEffect(() => {
    setOffline(!navigator.onLine);
    const on = () => { setOffline(false); setHidden(false); check(); };
    const off = () => { setOffline(true); setHidden(false); };
    window.addEventListener('online', on); window.addEventListener('offline', off);
    // App code can report a failed request with: window.dispatchEvent(new Event('mypetid:db-down'))
    const down = () => { setHidden(false); check(); };
    window.addEventListener('mypetid:db-down', down);
    check();
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); window.removeEventListener('mypetid:db-down', down); };
  }, [check]);

  // While the database is down, look again every 30 seconds so the banner clears by itself.
  useEffect(() => {
    if (!dbDown) return;
    const id = window.setInterval(check, 30000);
    return () => window.clearInterval(id);
  }, [dbDown, check]);

  const kind: StatusKind | null = offline ? 'offline' : dbDown ? 'database' : null;
  if (!kind || hidden) return null;
  return (
    <div className="statusBanner" role="alert">
      <StatusScreen kind={kind} compact actions={[{ label: 'Try again', onClick: () => (offline ? window.location.reload() : check()), primary: true }, { label: 'Hide', onClick: () => setHidden(true) }]} />
    </div>
  );
}
