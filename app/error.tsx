"use client";

import { useEffect } from 'react';
import { StatusScreen } from '../components/status-screen';

/** Shown when a page throws. Database and network failures get their own friendlier screen. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  const offline = typeof navigator !== 'undefined' && !navigator.onLine;
  const network = /fetch|network|load failed|supabase|timeout/i.test(error.message);
  return (
    <main className="statusPage">
      <StatusScreen kind={offline ? 'offline' : network ? 'database' : 'error'} detail={error.digest ? `Error ${error.digest}` : undefined} actions={[{ label: 'Try again', onClick: reset, primary: true }, { label: 'Go home', href: '/' }]} />
    </main>
  );
}
