"use client";

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * The MyPetID loading animation: a bone spins, flips over and folds open into a little ID card.
 * One loop is 3.6 s, so a page transition always shows at least one full bone-to-card turn.
 */
export const LOADER_MIN_MS = 3600;

export function BoneLoader({ label = 'Loading MyPetID…', fullScreen = false }: { label?: string; fullScreen?: boolean }) {
  const body = (
    <div className="boneLoader" role="status" aria-live="polite">
      <div className="boneLoaderStage" aria-hidden="true">
        <svg className="boneLoaderBone" viewBox="0 0 160 70">
          <defs><linearGradient id="bl-bone" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="var(--brand)" /><stop offset="1" stopColor="var(--brand2)" /></linearGradient></defs>
          {/* Drawn twice: a wider white pass for the outline, then the fill, so the parts read as one bone. */}
          {(['rgba(255,255,255,.6)', 'url(#bl-bone)'] as const).map((fill, i) => <g key={fill} fill={fill} stroke={i ? 'none' : fill} strokeWidth={i ? 0 : 6}>
            <rect x="32" y="24" width="96" height="22" rx="4" /><circle cx="30" cy="22" r="15" /><circle cx="30" cy="48" r="15" /><circle cx="130" cy="22" r="15" /><circle cx="130" cy="48" r="15" />
          </g>)}
          <circle cx="62" cy="35" r="3" fill="rgba(255,255,255,.7)" /><circle cx="80" cy="35" r="3" fill="rgba(255,255,255,.7)" /><circle cx="98" cy="35" r="3" fill="rgba(255,255,255,.7)" />
        </svg>
        <svg className="boneLoaderCard" viewBox="0 0 160 100">
          <defs><linearGradient id="bl-card" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="var(--brand)" /><stop offset="1" stopColor="var(--brand2)" /></linearGradient><clipPath id="bl-clip"><rect x="2" y="2" width="156" height="96" rx="10" /></clipPath></defs>
          <rect x="2" y="2" width="156" height="96" rx="10" fill="#f4f7f1" stroke="url(#bl-card)" strokeWidth="3" />
          <g clipPath="url(#bl-clip)">
            <rect x="0" y="0" width="160" height="18" fill="url(#bl-card)" />
            <text x="80" y="13" textAnchor="middle" fontSize="9" fontWeight="700" fill="#071008" fontFamily="system-ui, sans-serif">PET DRIVERS LICENSE</text>
            <rect x="10" y="26" width="40" height="52" rx="5" fill="#cfe9d6" />
            <path d="M18 70 q12 -20 24 0 z" fill="#238a42" opacity=".55" /><circle cx="30" cy="44" r="9" fill="#238a42" opacity=".55" />
            <rect className="blRow r1" x="58" y="28" width="56" height="7" rx="3" fill="#1c2430" />
            <rect className="blRow r2" x="58" y="42" width="44" height="5" rx="2.5" fill="#6a776b" />
            <rect className="blRow r3" x="58" y="53" width="50" height="5" rx="2.5" fill="#6a776b" />
            <rect className="blRow r4" x="58" y="64" width="34" height="5" rx="2.5" fill="#6a776b" />
            <g fill="#1c2430"><rect x="124" y="28" width="26" height="26" rx="2" fill="none" stroke="#1c2430" strokeWidth="3" /><rect x="131" y="35" width="12" height="12" /></g>
            <g className="blBars" fill="#1c2430">{[0, 3, 5, 9, 11, 14, 17, 19, 23, 26, 28, 31].map((x) => <rect key={x} x={118 + x} y="62" width={x % 3 ? 1.5 : 2.5} height="14" />)}</g>
            <rect className="blShine" x="-60" y="0" width="40" height="100" fill="rgba(255,255,255,.55)" transform="skewX(-20)" />
          </g>
        </svg>
        <span className="boneLoaderShadow" />
      </div>
      <p>{label}</p>
    </div>
  );
  return fullScreen ? <div className="boneLoaderScreen">{body}</div> : body;
}

/** Pages where a finder needs the info right away: never hold them behind the animation. */
const URGENT = /^\/(scan|pet)(\/|$)/;

function isPageLink(event: MouseEvent): string | null {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  const a = (event.target as Element | null)?.closest?.('a');
  if (!a || a.target && a.target !== '_self' || a.hasAttribute('download')) return null;
  const href = a.getAttribute('href');
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return null;
  const url = new URL(a.href, window.location.href);
  if (url.origin !== window.location.origin) return null;
  // Only page-to-page moves (dashboard tabs switch instantly and don't need a loader).
  const top = (p: string) => p.split('/').filter(Boolean)[0] || '';
  if (top(url.pathname) === top(window.location.pathname)) return null;
  return url.pathname;
}

/** Shows the bone loader between pages and once on the first visit of a session. */
export function RouteLoader() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);
  const started = useRef(0);
  const target = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function minMs() {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 600 : LOADER_MIN_MS;
  }
  function hideAfterMin() {
    if (timer.current) clearTimeout(timer.current);
    const wait = Math.max(0, minMs() - (Date.now() - started.current));
    timer.current = setTimeout(() => { setShow(false); target.current = null; }, wait);
  }

  // First visit this session: play one loop while the app wakes up.
  useEffect(() => {
    let seen = false;
    try { seen = sessionStorage.getItem('mypetid-loaded') === '1'; sessionStorage.setItem('mypetid-loaded', '1'); } catch { seen = true; }
    if (seen || URGENT.test(window.location.pathname)) return;
    started.current = Date.now();
    setShow(true);
    const done = () => hideAfterMin();
    if (document.readyState === 'complete') done(); else window.addEventListener('load', done, { once: true });
    return () => window.removeEventListener('load', done);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const next = isPageLink(event);
      if (!next || URGENT.test(next)) return;
      target.current = next;
      started.current = Date.now();
      setShow(true);
      // Safety net: never leave the loader up if the navigation stalls or is cancelled.
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setShow(false), 9000);
    };
    window.addEventListener('click', onClick);
    return () => window.removeEventListener('click', onClick);
  }, []);

  // The new route rendered: finish the current loop, then fade out.
  useEffect(() => { if (target.current) hideAfterMin(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
  // Coming back with the browser's back button restores a cached page with the loader still up.
  useEffect(() => {
    const onShow = (event: PageTransitionEvent) => { if (event.persisted) setShow(false); };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, []);

  return show ? <BoneLoader fullScreen /> : null;
}
