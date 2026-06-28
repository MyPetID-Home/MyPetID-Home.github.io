"use client";

import { useEffect, useState } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export function PwaInstallClient() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }
    const ready = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone;
    setShowHint(!ready && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setShowHint(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === 'accepted') setShowHint(false);
    setInstallEvent(null);
  }

  if (!showHint) return null;
  return (
    <aside className="installPill" aria-label="Install MyPetID">
      <span>Install MyPetID on your home screen for Android app-style location prompts.</span>
      {installEvent ? <button type="button" onClick={install}>Install</button> : <small>Chrome menu → Add to Home screen</small>}
      <button type="button" aria-label="Dismiss install hint" onClick={() => setShowHint(false)}>×</button>
    </aside>
  );
}
