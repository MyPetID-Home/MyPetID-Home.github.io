"use client";

import { useEffect, useState } from 'react';

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

export function InstallSettingsButton() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | undefined>();
  const [status, setStatus] = useState('Install prompt not available yet. On Android Chrome, use the browser menu → Add to Home screen if the button stays disabled.');

  useEffect(() => {
    const sync = () => {
      setInstallEvent(window.__mypetidInstallEvent);
      if (isInstalled()) setStatus('MyPetID is already installed on this device.');
      else if (window.__mypetidInstallEvent) setStatus('Ready to install MyPetID on this device.');
    };
    sync();
    window.addEventListener('mypetid-install-ready', sync);
    window.addEventListener('appinstalled', sync);
    return () => {
      window.removeEventListener('mypetid-install-ready', sync);
      window.removeEventListener('appinstalled', sync);
    };
  }, []);

  async function install() {
    if (!installEvent) {
      setStatus('Use Chrome menu → Add to Home screen. We will keep this install option here in Settings instead of popping it up everywhere.');
      return;
    }
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    window.__mypetidInstallEvent = undefined;
    setInstallEvent(undefined);
    setStatus(choice.outcome === 'accepted' ? 'Install accepted. MyPetID should now open like an app.' : 'Install dismissed. You can try again here later or use the browser menu.');
  }

  return <div className="installSettingsCard"><h3>Install MyPetID app</h3><p>Put MyPetID on the home screen for app-style launch, Android location prompts, and quick tag access.</p><button type="button" onClick={install} disabled={isInstalled()}>Install / add to home screen</button><small>{status}</small></div>;
}
