"use client";

import { useEffect, useState } from 'react';
import { PushOptIn } from './push-optin';
import { useT } from '../lib/i18n';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

declare global {
  interface Window { __mypetidInstallEvent?: BeforeInstallPromptEvent }
}

function isInstalled() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function PwaInstallClient() {
  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    const onPrompt = (event: Event) => {
      event.preventDefault();
      window.__mypetidInstallEvent = event as BeforeInstallPromptEvent;
      window.dispatchEvent(new Event('mypetid-install-ready'));
    };
    const onInstalled = () => {
      localStorage.setItem('mypetid.install.dismissed', 'installed');
      window.__mypetidInstallEvent = undefined;
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);
  return null;
}

// Fill these in when the store listings go live; until then the badges show "Coming soon".
export const PLAY_STORE_URL = '';
export const APP_STORE_URL = '';

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** Store badges plus "Add to home screen" for the web app. */
export function GetTheApp({ compact = false, i18n = false }: { compact?: boolean; i18n?: boolean }) {
  // `i18n` is set on the finder-facing pages; elsewhere the wording stays English.
  const { t } = useT(i18n);
  const L = (key: string, english: string) => (i18n ? t(key) : english);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | undefined>();
  // Resolved after mount; calling matchMedia during render caused a hydration mismatch.
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    const sync = () => { setInstallEvent(window.__mypetidInstallEvent); setInstalled(isInstalled()); };
    setIos(isIos());
    sync();
    window.addEventListener('mypetid-install-ready', sync);
    window.addEventListener('appinstalled', sync);
    return () => { window.removeEventListener('mypetid-install-ready', sync); window.removeEventListener('appinstalled', sync); };
  }, []);

  async function install() {
    if (ios) return setStatus(L('app.ios', 'On iPhone or iPad: tap the Share button in Safari, then “Add to Home Screen”.'));
    if (!installEvent) return setStatus(L('app.menu', 'Open your browser menu (⋮) and choose “Add to Home screen” or “Install app”.'));
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    window.__mypetidInstallEvent = undefined;
    setInstallEvent(undefined);
    setStatus(choice.outcome === 'accepted' ? L('app.installed', 'Installed! MyPetID now opens from your home screen like an app.') : L('app.dismissed', 'No problem. You can add it any time from here.'));
  }

  return (
    <div className={`getApp ${compact ? 'compact' : ''}`}>
      <div className="storeBadges">
        <a className={`storeBadge ${PLAY_STORE_URL ? '' : 'soon'}`} href={PLAY_STORE_URL || '#'} role={PLAY_STORE_URL ? undefined : 'button'} target={PLAY_STORE_URL ? '_blank' : undefined} rel="noreferrer" onClick={(e) => { if (!PLAY_STORE_URL) { e.preventDefault(); setStatus(L('app.androidSoon', 'The Android app is on its way to Google Play. Add the web app to your home screen in the meantime.')); } }}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#34A853" d="M3.6 2.3 13.8 12 3.6 21.7c-.4-.2-.6-.6-.6-1.1V3.4c0-.5.2-.9.6-1.1Z"/><path fill="#FBBC04" d="m17.2 8.6-3.4 3.4 3.4 3.4 3.9-2.2c.9-.5.9-1.9 0-2.4Z"/><path fill="#4285F4" d="M3.6 21.7 13.8 12l3.4 3.4L5.4 22c-.6.3-1.3.2-1.8-.3Z"/><path fill="#EA4335" d="M3.6 2.3c.5-.5 1.2-.6 1.8-.3l11.8 6.6-3.4 3.4Z"/></svg>
          <span><small>{PLAY_STORE_URL ? L('app.getItOn', 'Get it on') : L('app.comingSoonTo', 'Coming soon to')}</small>Google Play</span>
        </a>
        <a className={`storeBadge ${APP_STORE_URL ? '' : 'soon'}`} href={APP_STORE_URL || '#'} role={APP_STORE_URL ? undefined : 'button'} target={APP_STORE_URL ? '_blank' : undefined} rel="noreferrer" onClick={(e) => { if (!APP_STORE_URL) { e.preventDefault(); setStatus(L('app.iosSoon', 'An iPhone app is planned. For now, add the web app to your home screen.')); } }}>
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M16.4 12.6c0-2.4 2-3.6 2.1-3.7-1.2-1.7-3-1.9-3.6-2-1.5-.2-3 .9-3.7.9-.8 0-2-.9-3.2-.9-1.7 0-3.2 1-4 2.4-1.7 3-.4 7.4 1.2 9.8.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.1-.8s1.9.8 3.2.8c1.3 0 2.1-1.2 2.9-2.4.9-1.4 1.3-2.7 1.3-2.8-.1 0-2.5-.9-2.3-3.7ZM14 5.4c.7-.8 1.1-1.9 1-3-1 0-2.1.6-2.8 1.4-.6.7-1.2 1.8-1 2.9 1 .1 2.1-.5 2.8-1.3Z"/></svg>
          <span><small>{APP_STORE_URL ? L('app.downloadOn', 'Download on the') : L('app.laterOn', 'Later on the')}</small>App Store</span>
        </a>
        <button className="storeBadge homeScreen" type="button" onClick={install} disabled={installed}>
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="2" width="12" height="20" rx="3"/><path d="M12 8v7M9 12l3 3 3-3"/></svg>
          <span><small>{installed ? L('app.alreadyOn', 'Already on your') : L('app.addTo', 'Add the web app to your')}</small>{installed ? L('app.homeScreenLower', 'home screen') : L('app.homeScreen', 'Home screen')}</span>
        </button>
      </div>
      <div role="status" aria-live="polite">{status && <p className="authMessage">{status}</p>}</div>
    </div>
  );
}

export function InstallSettingsButton() {
  return <div className="installSettingsCard"><h3>Get the MyPetID app</h3><p>Use MyPetID like an app: quick tag access, walk tracking and alerts from your home screen.</p><GetTheApp compact /><PushOptIn /></div>;
}
