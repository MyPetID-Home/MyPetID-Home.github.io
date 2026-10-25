"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Bell, Footprints, Menu, PawPrint, Sparkles, User, Check } from './icons';

/**
 * First-visit tour of the dashboard. Each step spotlights an element marked with
 * data-tour="…"; steps whose target isn't on screen are shown centred instead.
 * Seen state is kept per signed-in user (or per device for guests).
 */
type Step = { target?: string; title: string; body: string; Icon: (props: { className?: string }) => React.JSX.Element };

const STEPS: Step[] = [
  { title: 'Welcome to MyPetID!', body: 'Here’s a 30-second look around. Everything for your dog lives in this app: their profile, tag, walks, health and alerts.', Icon: Sparkles },
  { target: 'overview', title: 'Your dog’s day', body: 'Home shows your dog at a glance: level and XP, profile progress, today’s care goals and any alerts.', Icon: PawPrint },
  { target: 'pet', title: 'The pet profile', body: 'Tap the paw to edit your dog’s profile, medical info, diet, training and the public page finders see when they scan the tag.', Icon: PawPrint },
  { target: 'walks', title: 'Walks', body: 'Start a walk to track distance with your phone’s GPS, save routes and work toward weekly goals.', Icon: Footprints },
  { target: 'alerts', title: 'Lost & found alerts', body: 'If someone scans your dog’s tag and shares a location, it shows up here. A red badge means something needs you.', Icon: Bell },
  { target: 'account', title: 'Your account', body: 'Your photo opens account details, contact info, your plan and app settings like light/dark mode.', Icon: User },
  { target: 'menu', title: 'Everything else', body: 'The menu has Dog Pack, settings and more, plus “Take the tour” if you ever want to see this again.', Icon: Menu },
  { title: 'You’re all set!', body: 'Start by adding your dog’s photo and details. The more you fill in, the faster they can get home if they’re ever lost.', Icon: Check },
];

const EVENT = 'mypetid:tour';
export function replayWalkthrough() { window.dispatchEvent(new Event(EVENT)); }

async function seenKey() {
  let id = 'guest';
  try { const { data } = await supabase?.auth.getSession() ?? { data: null }; if (data?.session?.user.id) id = data.session.user.id; } catch { /* guest */ }
  return `mypetid.tour.v1.${id}`;
}

type Rect = { top: number; left: number; width: number; height: number };

export function Walkthrough() {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [cardPos, setCardPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const step = STEPS[index];

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const key = await seenKey();
      try { if (!cancelled && !localStorage.getItem(key)) { setIndex(0); setOpen(true); } } catch { /* storage blocked */ }
    }, 900);
    const replay = () => { setIndex(0); setOpen(true); };
    window.addEventListener(EVENT, replay);
    return () => { cancelled = true; window.clearTimeout(timer); window.removeEventListener(EVENT, replay); };
  }, []);

  const measure = useCallback(() => {
    if (!open) return;
    const el = step.target ? document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`) : null;
    const box = el?.getBoundingClientRect();
    const visible = box && box.width > 0 && box.height > 0;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cardW = Math.min(380, vw - 24);
    const cardH = 250;
    if (!visible || !box) {
      setRect(null);
      setCardPos({ top: Math.max(12, vh / 2 - cardH / 2), left: Math.max(12, vw / 2 - cardW / 2) });
      return;
    }
    const pad = 8;
    const r = { top: box.top - pad, left: box.left - pad, width: box.width + pad * 2, height: box.height + pad * 2 };
    setRect(r);
    const below = r.top + r.height + 14;
    const top = below + cardH < vh ? below : Math.max(12, r.top - cardH - 14);
    const left = Math.min(Math.max(12, r.left + r.width / 2 - cardW / 2), vw - cardW - 12);
    setCardPos({ top, left });
  }, [open, step]);

  useLayoutEffect(() => {
    if (!open) return;
    const el = step.target ? document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`) : null;
    const box = el?.getBoundingClientRect();
    // Scroll tall-page targets (like the overview card) into view, but not fixed nav items.
    if (el && box && (box.top < 70 || box.bottom > window.innerHeight - 90) && getComputedStyle(el).position !== 'fixed') {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      window.setTimeout(measure, 380);
    }
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => { window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true); };
  }, [open, step, measure]);

  const finish = useCallback(async () => {
    setOpen(false);
    try { localStorage.setItem(await seenKey(), new Date().toISOString()); } catch { /* storage blocked */ }
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish();
      if (event.key === 'ArrowRight') setIndex((i) => Math.min(STEPS.length - 1, i + 1));
      if (event.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, finish]);

  if (!open) return null;
  const last = index === STEPS.length - 1;
  const { Icon } = step;
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="tour-title">
      <div className="tourScrim" onClick={finish} />
      <div className={`tourSpot ${rect ? '' : 'center'}`} style={rect ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height } : { top: '50%', left: '50%', width: 0, height: 0 }} />
      <div className="tourCard" key={index} style={{ top: cardPos.top, left: cardPos.left }}>
        {!last && <button className="tourSkip" type="button" onClick={finish}>Skip tour</button>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><span className="mascot" aria-hidden="true"><img src="/images/logo/MyPetID-Logo_Resized.jpg" alt="" /></span><span className="iconBubble"><Icon /></span></div>
        <h3 id="tour-title">{step.title}</h3>
        <p>{step.body}</p>
        <div className="tourFoot">
          <div className="tourDots" aria-label={`Step ${index + 1} of ${STEPS.length}`}>{STEPS.map((_, i) => <i key={i} className={i === index ? 'on' : ''} />)}</div>
          <div className="actions">
            {index > 0 && <button type="button" onClick={() => setIndex(index - 1)}>Back</button>}
            <button className="primary" type="button" onClick={() => (last ? finish() : setIndex(index + 1))} autoFocus>{last ? 'Let’s go' : 'Next'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
