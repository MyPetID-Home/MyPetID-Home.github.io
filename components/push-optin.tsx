"use client";

import { useCallback, useEffect, useId, useState } from 'react';
import { isAdminEmail, supabase } from '../lib/supabase';
import { apiFetch, bearer } from '../lib/api-client';
import { Bell } from './icons';

/**
 * Web push opt-in: alerts (tag scans, lost-dog alerts, announcements, reminders) arrive even when
 * MyPetID is closed. Permission is only requested when the owner taps the button.
 * On iPhone/iPad, Safari only allows web push for a site added to the Home Screen (iOS 16.4+).
 */
const VAPID_PUBLIC_KEY = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '').trim();
/** True when this build can subscribe to web push. */
export const PUSH_AVAILABLE = Boolean(VAPID_PUBLIC_KEY);

type Support = 'checking' | 'ok' | 'unsupported' | 'ios-browser';

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

async function registration() {
  const existing = await navigator.serviceWorker.getRegistration();
  if (!existing) await navigator.serviceWorker.register('/sw.js');
  return navigator.serviceWorker.ready;
}

export function PushOptIn({ compact = false }: { compact?: boolean }) {
  const titleId = useId();
  const [token, setToken] = useState('');
  const [admin, setAdmin] = useState(false);
  const [support, setSupport] = useState<Support>('checking');
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  // Everything browser-specific is read after mount so the static HTML matches the first render.
  useEffect(() => {
    const hasPush = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    if (isIos() && !isStandalone()) setSupport('ios-browser');
    else setSupport(hasPush ? 'ok' : 'unsupported');
    if ('Notification' in window) setPermission(Notification.permission);
    if (hasPush) registration().then((reg) => reg.pushManager.getSubscription()).then((sub) => setSubscribed(Boolean(sub))).catch(() => undefined);
    if (!supabase) return;
    let cancelled = false;
    supabase.auth.getSession().then(async ({ data }) => {
      const session = data.session;
      if (!session || cancelled) return;
      setToken(session.access_token);
      let isAdmin = isAdminEmail(session.user.email);
      if (!isAdmin && supabase) {
        const { data: profile } = await supabase.from('profiles').select('is_admin,tier').eq('id', session.user.id).maybeSingle();
        isAdmin = Boolean(profile && (profile.is_admin || profile.tier === 'admin'));
      }
      if (!cancelled) setAdmin(isAdmin);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const freshToken = useCallback(async () => {
    if (!supabase) return token;
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || token;
  }, [token]);

  async function enable() {
    setBusy(true);
    setStatus('');
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== 'granted') {
        setStatus(result === 'denied' ? 'Notifications are blocked for this site. Allow them in your browser or phone settings, then try again.' : 'No problem. You can turn push alerts on any time.');
        return;
      }
      const reg = await registration();
      const key = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      let sub = await reg.pushManager.getSubscription();
      if (sub) {
        // A subscription made with an older key cannot be reused.
        const current = sub.options.applicationServerKey ? new Uint8Array(sub.options.applicationServerKey) : null;
        if (!current || current.length !== key.length || current.some((b, i) => b !== key[i])) { await sub.unsubscribe(); sub = null; }
      }
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      const response = await apiFetch('/api/push/subscribe/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: bearer(await freshToken()) },
        body: JSON.stringify({ subscription: sub.toJSON(), userAgent: navigator.userAgent.slice(0, 300) }),
      });
      const json = await response.json();
      if (!response.ok) {
        await sub.unsubscribe().catch(() => undefined);
        setSubscribed(false);
        setStatus(json.error || 'Could not turn on push alerts.');
        return;
      }
      setSubscribed(true);
      setStatus(json.message || 'Push alerts are on for this device.');
    } catch (error) {
      setStatus(error instanceof Error ? `Could not turn on push alerts: ${error.message}` : 'Could not turn on push alerts.');
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setStatus('');
    try {
      const reg = await registration();
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await apiFetch('/api/push/subscribe/', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: bearer(await freshToken()) }, body: JSON.stringify({ action: 'unsubscribe', endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
      setSubscribed(false);
      setStatus('Push alerts are off on this device. You still see alerts in the bell inside the app.');
    } catch {
      setStatus('Could not turn push alerts off. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    const response = await apiFetch('/api/push/test/', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: bearer(await freshToken()) }, body: '{}' });
    const json = await response.json();
    setStatus(response.ok ? json.message : json.error || 'Test push failed.');
    setBusy(false);
  }

  if (!token || support === 'checking') return null;
  if (!VAPID_PUBLIC_KEY) return admin ? <p className="formHint pushOptIn">Push alerts aren’t configured yet (NEXT_PUBLIC_VAPID_PUBLIC_KEY is missing from this build). See docs/push-setup.md.</p> : null;

  return (
    <section className={`pushOptIn ${compact ? 'compact' : ''}`} style={{ display: 'grid', gap: 8 }} aria-labelledby={titleId}>
      {!compact && <h3 id={titleId}><Bell /> Alerts when the app is closed</h3>}
      {compact && <strong id={titleId}>Phone alerts</strong>}
      <p className="formHint">Get a notification on this device when someone scans your dog’s tag, a lost-dog alert goes out nearby, or a reminder is due, even when MyPetID isn’t open.</p>
      {support === 'ios-browser' && <p className="formHint">On iPhone and iPad, push alerts only work after you add MyPetID to your Home Screen: tap Share in Safari, then “Add to Home Screen”, and open MyPetID from that icon to turn alerts on.</p>}
      {support === 'unsupported' && <p className="formHint">This browser doesn’t support push alerts. Alerts still show in the bell inside the app.</p>}
      {support === 'ok' && <div className="actions compact">
        {subscribed
          ? <button type="button" onClick={disable} disabled={busy}>Turn off on this device</button>
          : <button className="primary" type="button" onClick={enable} disabled={busy || permission === 'denied'}>{busy ? 'Turning on…' : 'Turn on push alerts'}</button>}
        {admin && subscribed && <button type="button" onClick={test} disabled={busy}>Send a test push</button>}
      </div>}
      {support === 'ok' && permission === 'denied' && !subscribed && <p className="formHint">Notifications are blocked for this site. Allow them in your browser or phone settings first.</p>}
      <div role="status" aria-live="polite">{status && <p className="authMessage">{status}</p>}</div>
    </section>
  );
}
