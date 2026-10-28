"use client";

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { apiFetch, bearer } from '../lib/api-client';
import { DataExport } from './data-export';
import { ShieldCheck } from './icons';
import styles from './account-delete.module.css';

/**
 * Delete my account: explains what goes, offers the data export first, asks for a typed
 * DELETE, then calls /api/account/delete (Vercel). The server insists on a sign-in from the
 * last 15 minutes; if it's older we sign the user out so they can sign straight back in.
 */
export function AccountDelete() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [needsReauth, setNeedsReauth] = useState(false);

  useEffect(() => {
    if (!supabase) { setSignedIn(false); return; }
    supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
  }, []);

  async function reauth() {
    if (!supabase) return;
    await supabase.auth.signOut();
    window.location.assign('/');
  }

  async function remove(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase || typed !== 'DELETE') return;
    setBusy(true); setMessage(''); setNeedsReauth(false);
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) { setBusy(false); setNeedsReauth(true); return setMessage('Please sign in again to delete your account.'); }
    const response = await apiFetch('/api/account/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: bearer(token) },
      body: JSON.stringify({ confirm: 'DELETE' }),
    });
    const json = await response.json();
    if (!response.ok) {
      setBusy(false);
      if (json?.code === 'reauth_required') setNeedsReauth(true);
      return setMessage(json?.error || 'Your account could not be deleted. Nothing was changed.');
    }
    setMessage('Your account was deleted. Goodbye, and give your dog a scratch from us.');
    try {
      await supabase.auth.signOut({ scope: 'local' });
      Object.keys(localStorage).filter((key) => key.startsWith('mypetid')).forEach((key) => localStorage.removeItem(key));
    } catch { /* already signed out / storage blocked */ }
    setTimeout(() => window.location.assign('/'), 1800);
  }

  if (signedIn === null || !signedIn) return null;

  return (
    <section className="panel full">
      <div className="panelTitleRow"><div><p className="eyebrow">Danger zone</p><h2>Delete my account</h2></div><span className="iconBubble red"><ShieldCheck /></span></div>
      <div className={styles.wrap}>
        <p>This permanently deletes your MyPetID account. It can&apos;t be undone.</p>
        <div className="grid2">
          <div>
            <h3 className={styles.head}>Deleted</h3>
            <ul className={styles.list}>
              <li>Your profile, sign-in and settings</li>
              <li>Your dogs, ID details, care schedule, health records and weights</li>
              <li>Photos, documents and card designs you uploaded</li>
              <li>Walks, saved routes, calendar, training and awards</li>
              <li>Dog Pack friends, messages, meetups you host, notifications</li>
              <li>Households you own, and your spot in other people&apos;s households</li>
              <li>Scan reports about your dogs</li>
            </ul>
          </div>
          <div>
            <h3 className={styles.head}>What happens to the rest</h3>
            <ul className={styles.list}>
              <li>Physical tags are unlinked from your dogs (the tag stops showing your info) and kept so they can be reissued</li>
              <li>Active Stripe subscriptions are cancelled. Patreon pledges are managed on Patreon, so cancel those there</li>
              <li>Order and payment records are kept without your account for bookkeeping</li>
            </ul>
          </div>
        </div>

        <div className={styles.exportBox}>
          <p><strong>Want a copy first?</strong> Download your data before you go.</p>
          <DataExport compact />
        </div>

        {!open ? (
          <div className="actions"><button type="button" className={styles.dangerButton} onClick={() => setOpen(true)}>I want to delete my account</button></div>
        ) : (
          <form className={styles.confirm} onSubmit={remove}>
            <label>Type <strong>DELETE</strong> to confirm
              <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="DELETE" aria-describedby="account-delete-hint" />
            </label>
            <p id="account-delete-hint" className="formHint">For your security you need to have signed in within the last 15 minutes.</p>
            <div className="actions">
              <button type="submit" className={styles.dangerButton} disabled={typed !== 'DELETE' || busy}>{busy ? 'Deleting...' : 'Delete my account forever'}</button>
              <button type="button" className="button" onClick={() => { setOpen(false); setTyped(''); setMessage(''); }} disabled={busy}>Cancel</button>
            </div>
          </form>
        )}
        {message && <p className="authMessage" role="status">{message}</p>}
        {needsReauth && <div className="actions"><button type="button" className="button primary" onClick={reauth}>Sign out and sign in again</button></div>}
      </div>
    </section>
  );
}
