"use client";

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { Session } from '@supabase/supabase-js';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../lib/supabase';
import { PUBLIC_APP_URL } from '../lib/public-url';
import { useEntitlement } from '../lib/entitlement';
import { Home, Lock, Users } from './icons';
import styles from './household.module.css';

/**
 * Households: more than one person on one dog (Silver/Diamond).
 * Backed by docs/migrations/2026-10-household-export-delete.sql. The database decides who can
 * see what: members only have access while the OWNER's plan is paid and has a free seat, so
 * this UI just explains it. All writes go through SECURITY DEFINER RPCs.
 *
 * <Household petId />   owner view (invite / roles / remove) or member view (leave)
 * <HouseholdJoin />     handles ?household=<code> and lists dogs shared with me
 */

type Role = 'caretaker' | 'viewer';
type Member = { id: string; member_id: string | null; name: string | null; role: Role | 'owner'; status: 'invited' | 'active' | 'removed'; invited_email: string | null; created_at: string | null; accepted_at: string | null; expires_at: string | null; is_me: boolean; is_owner: boolean };
type SharedPet = { pet_id: string; pet_name: string; photo_url: string | null; owner_name: string | null; role: Role; has_access: boolean; accepted_at: string | null };

const NOT_READY = /could not find the function|does not exist|schema cache/i;
const PENDING_KEY = 'mypetid.pendingHousehold';
export const HOUSEHOLD_JOIN_PATH = '/dashboard/';

export const HOUSEHOLD_CAN_DO: Record<Role, string[]> = {
  viewer: ['See the dog\'s profile, photo and ID details', 'See health records and weights'],
  caretaker: ['Everything a viewer can', 'Tick off and edit the care schedule (meals, meds, walks)'],
};
export const HOUSEHOLD_CANNOT_DO = 'Members can\'t delete the dog, change its profile, tags, contact details or lost mode, see scans, documents or walks, or invite other people.';

function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    if (!supabase) { setChecked(true); return; }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setChecked(true); });
    const { data: listener } = supabase.auth.onAuthStateChange((_e, next) => setSession(next));
    return () => listener.subscription.unsubscribe();
  }, []);
  return { session, checked };
}

function shortDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
}

function friendly(message: string) {
  return message.replace(/^.*?ERROR:\s*/i, '');
}

function Header({ title }: { title: string }) {
  return <div className="panelTitleRow"><div><p className="eyebrow">Household</p><h2>{title}</h2></div><span className="iconBubble green"><Home /></span></div>;
}

export function Household({ petId }: { petId?: string | null }) {
  const { session, checked } = useSession();
  const ent = useEntitlement();
  const me = session?.user.id || '';
  const [ready, setReady] = useState(true);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [petName, setPetName] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState<Role>('caretaker');
  const [email, setEmail] = useState('');
  const [invite, setInvite] = useState<{ url: string; expires: string } | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!supabase || !me || !petId) return;
    const { data: pet } = await supabase.from('pets').select('id,name,owner_id').eq('id', petId).maybeSingle();
    setOwnerId((pet as { owner_id?: string } | null)?.owner_id || null);
    setPetName((pet as { name?: string } | null)?.name || '');
    setLoaded(true);
    if (!pet) return;
    const { data, error } = await supabase.rpc('household_members', { p_pet: petId });
    if (error) { if (NOT_READY.test(error.message)) setReady(false); else setNotice(friendly(error.message)); return; }
    setMembers((data || []) as Member[]);
  }, [me, petId]);

  useEffect(() => { load(); }, [load]);

  const isOwner = Boolean(me && ownerId && ownerId === me);
  const maxUsers = ent.maxUsers;
  const allowed = ent.paid && maxUsers >= 2;
  const active = members.filter((m) => !m.is_owner && m.status === 'active');
  const pending = members.filter((m) => m.status === 'invited');
  const seatsUsed = 1 + active.length;
  const seatLimit = typeof maxUsers === 'number' && maxUsers < 100 ? maxUsers : null;
  const seatFree = seatLimit === null || seatsUsed < seatLimit;

  async function createInvite(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase || !petId) return;
    setBusy(true); setNotice(''); setInvite(null);
    const { data, error } = await supabase.rpc('create_household_invite', { p_pet: petId, p_role: role, p_email: email.trim() || null });
    setBusy(false);
    if (error) return setNotice(NOT_READY.test(error.message) ? 'Households switch on as soon as the database update is applied.' : friendly(error.message));
    const row = (Array.isArray(data) ? data[0] : data) as { code: string; expires_at: string } | null;
    if (!row?.code) return setNotice('Couldn\'t create an invite. Try again.');
    setInvite({ url: `${PUBLIC_APP_URL}${HOUSEHOLD_JOIN_PATH}?household=${row.code}`, expires: row.expires_at });
    setEmail('');
    setNotice('Share this link or QR code. It works once and expires in 7 days.');
    load();
  }

  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setNotice('Invite link copied.'); } catch { setNotice('Copy didn\'t work here. Press and hold the link to copy it.'); }
  }

  async function share(url: string) {
    if (navigator.share) {
      try { await navigator.share({ title: `Help look after ${petName || 'my dog'} on MyPetID`, url }); } catch { /* cancelled */ }
    } else copy(url);
  }

  async function changeRole(member: Member, next: Role) {
    if (!supabase) return;
    const { error } = await supabase.rpc('household_set_role', { p_id: member.id, p_role: next });
    if (error) return setNotice(friendly(error.message));
    setNotice(`${member.name || 'Invite'} is now a ${next}.`);
    load();
  }

  async function remove(member: Member, leaving = false) {
    if (!supabase) return;
    const question = leaving ? `Leave ${petName || 'this dog'}'s household? You'll lose access until you're invited again.` : member.status === 'invited' ? 'Cancel this invite? The link will stop working.' : `Remove ${member.name || 'this person'} from ${petName || 'your dog'}'s household?`;
    if (!window.confirm(question)) return;
    const { error } = await supabase.rpc('household_remove', { p_id: member.id });
    if (error) return setNotice(friendly(error.message));
    setNotice(leaving ? 'You left the household.' : member.status === 'invited' ? 'Invite cancelled.' : 'Removed.');
    if (leaving) { setMembers([]); setOwnerId(null); return; }
    load();
  }

  if (!checked) return null;
  if (!supabase || !session) {
    return (
      <section className="panel full">
        <Header title="Share your dog with family" />
        <p>Sign in to add the people who help look after your dog.</p>
        <div className="actions"><Link className="button primary" href="/">Sign in</Link></div>
      </section>
    );
  }
  if (!petId) {
    return (
      <section className="panel full">
        <Header title="Share your dog with family" />
        <p className="formHint">Save your dog to your MyPetID account first, then you can invite family and caretakers.</p>
      </section>
    );
  }
  if (!ready) {
    return (
      <section className="panel full">
        <Header title="Coming online soon" />
        <p>Households switch on as soon as the database update is applied.</p>
      </section>
    );
  }

  if (!loaded) return null;
  if (!ownerId) {
    return (
      <section className="panel full">
        <Header title="Household" />
        {notice && <p className="authMessage" role="status">{notice}</p>}
        <p className="formHint">This dog isn&apos;t available to you right now. If it was shared with you, the owner&apos;s plan may no longer include households.</p>
      </section>
    );
  }

  // Someone else's dog that's shared with me
  if (ownerId && !isOwner) {
    const mine = members.find((m) => m.is_me && !m.is_owner);
    const owner = members.find((m) => m.is_owner);
    return (
      <section className="panel full">
        <Header title={`${petName || 'This dog'}'s household`} />
        {notice && <p className="authMessage" role="status">{notice}</p>}
        <p>{owner?.name || 'The owner'} shared {petName || 'this dog'} with you{mine ? <> as a <strong>{mine.role}</strong></> : null}.</p>
        {mine && mine.role !== 'owner' && <ul className={styles.can}>{HOUSEHOLD_CAN_DO[mine.role].map((line) => <li key={line}>{line}</li>)}</ul>}
        <p className="formHint">{HOUSEHOLD_CANNOT_DO} Access lasts while the owner&apos;s plan includes households.</p>
        {mine && <div className="actions"><button type="button" className={styles.danger} onClick={() => remove(mine, true)}>Leave household</button></div>}
      </section>
    );
  }

  if (ent.loading) return null;

  if (!allowed) {
    return (
      <section className="panel full">
        <Header title="Share your dog with family" />
        <div className={styles.locked}>
          <p><Lock /> Households are part of the <strong>Silver</strong> and <strong>Diamond</strong> plans. Add a partner, roommate or dog walker so they can see {petName || 'your dog'}&apos;s profile and health records, and help with the care schedule.</p>
          {active.length > 0 && <p className="notice">{active.length === 1 ? '1 person is' : `${active.length} people are`} paused in this household. They get access back as soon as your plan includes households again.</p>}
          <div className="actions"><Link className="button primary" href="/subscribe/">See plans</Link></div>
        </div>
      </section>
    );
  }

  return (
    <section className="panel full">
      <Header title={`Who helps with ${petName || 'your dog'}`} />
      <div className={styles.wrap}>
        {notice && <p className="authMessage" role="status">{notice}</p>}
        <div className={styles.seats} aria-label="Household seats">
          <Users />
          {seatLimit !== null ? <>{Array.from({ length: seatLimit }, (_, i) => <span key={i} className={`${styles.seatDot} ${i < seatsUsed ? styles.filled : ''}`} />)}<span>{seatsUsed} of {seatLimit} people (you count as one)</span></> : <span>{seatsUsed} {seatsUsed === 1 ? 'person' : 'people'}</span>}
        </div>

        <ul className={styles.list}>
          {members.filter((m) => m.status !== 'removed').map((m) => (
            <li key={m.id} className={styles.item}>
              <span className={styles.avatar}>{(m.name || m.invited_email || '?').slice(0, 1).toUpperCase()}</span>
              <span className={styles.itemMain}>
                <strong>{m.is_owner ? `${m.name || 'You'} (you)` : m.name || m.invited_email || 'Invite link'}</strong>
                <small>
                  {m.is_owner ? 'Owner' : m.status === 'invited' ? <><span className={`${styles.badge} ${styles.pending}`}>Invited</span> expires {shortDate(m.expires_at)}</> : `Joined ${shortDate(m.accepted_at)}`}
                </small>
              </span>
              {!m.is_owner && (
                <span className={styles.itemActions}>
                  <select aria-label="Role" value={m.role} onChange={(e) => changeRole(m, e.target.value as Role)}>
                    <option value="caretaker">Caretaker</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <button type="button" className={styles.danger} onClick={() => remove(m)}>{m.status === 'invited' ? 'Cancel' : 'Remove'}</button>
                </span>
              )}
            </li>
          ))}
        </ul>

        {seatFree ? (
          <form className={styles.inviteForm} onSubmit={createInvite}>
            <div className="grid2">
              <label>Role
                <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
                  <option value="caretaker">Caretaker: can update the care schedule</option>
                  <option value="viewer">Viewer: can only look</option>
                </select>
              </label>
              <label>Their email <small>(optional, just a reminder for you)</small>
                <input type="email" value={email} maxLength={254} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
              </label>
            </div>
            <ul className={styles.can}>{HOUSEHOLD_CAN_DO[role].map((line) => <li key={line}>{line}</li>)}</ul>
            <p className="formHint">{HOUSEHOLD_CANNOT_DO}</p>
            <div className="actions"><button type="submit" className="button primary" disabled={busy}>{busy ? 'Creating...' : 'Create invite link'}</button></div>
            {invite && (
              <div className={styles.inviteResult}>
                <div className={styles.qr}><QRCodeSVG value={invite.url} size={140} marginSize={2} /></div>
                <div className={styles.inviteLink}>
                  <input readOnly value={invite.url} onFocus={(e) => e.target.select()} aria-label="Household invite link" />
                  <div className="actions">
                    <button type="button" onClick={() => copy(invite.url)}>Copy link</button>
                    <button type="button" onClick={() => share(invite.url)}>Share</button>
                  </div>
                  <p className="formHint">Works once, until {new Date(invite.expires).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}. We only keep a fingerprint of the code, so copy it now.</p>
                </div>
              </div>
            )}
          </form>
        ) : (
          <p className="notice">Your household is full{pending.length ? ' (open invites can\'t be accepted until a seat frees up)' : ''}. Remove someone or <Link href="/subscribe/">upgrade your plan</Link> to add more people.</p>
        )}
      </div>
    </section>
  );
}

/** Accepts ?household=<code> (saved across sign-in) and lists dogs shared with the signed-in user. */
export function HouseholdJoin({ onJoined }: { onJoined?: (petId: string) => void }) {
  const { session, checked } = useSession();
  const me = session?.user.id || '';
  const [notice, setNotice] = useState('');
  const [shared, setShared] = useState<SharedPet[]>([]);
  const [hasCode, setHasCode] = useState(false);

  const loadShared = useCallback(async () => {
    if (!supabase || !me) return;
    const { data, error } = await supabase.rpc('my_household_pets');
    if (!error) setShared((data || []) as SharedPet[]);
  }, [me]);

  // Keep the code across sign-in, and strip it from the address bar.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const code = url.searchParams.get('household');
    if (!code) { try { setHasCode(Boolean(localStorage.getItem(PENDING_KEY))); } catch { /* storage blocked */ } return; }
    try { localStorage.setItem(PENDING_KEY, code); } catch { /* storage blocked */ }
    setHasCode(true);
    url.searchParams.delete('household');
    window.history.replaceState(null, '', url.toString());
  }, []);

  useEffect(() => {
    if (!supabase || !me) return;
    (async () => {
      let code = '';
      try { code = localStorage.getItem(PENDING_KEY) || ''; } catch { /* storage blocked */ }
      if (code) {
        try { localStorage.removeItem(PENDING_KEY); } catch { /* storage blocked */ }
        setHasCode(false);
        const { data, error } = await supabase!.rpc('accept_household_invite', { p_code: code });
        if (error) setNotice(NOT_READY.test(error.message) ? 'Households aren\'t switched on yet. Ask the owner to try again soon.' : friendly(error.message));
        else {
          const row = (Array.isArray(data) ? data[0] : data) as { pet_id: string; pet_name: string; role: Role } | null;
          setNotice(row ? `You joined ${row.pet_name || 'the dog'}'s household as a ${row.role}.` : 'You joined the household.');
          if (row?.pet_id) onJoined?.(row.pet_id);
        }
      }
      await loadShared();
    })();
  }, [me, loadShared, onJoined]);

  if (!checked) return null;
  if (!session) {
    if (!hasCode) return null;
    return (
      <section className="panel full">
        <Header title="You've been invited to a household" />
        <p>Sign in or create a free MyPetID account to accept. We&apos;ll finish joining as soon as you&apos;re signed in.</p>
        <div className="actions"><Link className="button primary" href="/">Sign in to accept</Link></div>
      </section>
    );
  }
  if (!notice && shared.length === 0) return null;

  return (
    <section className="panel full">
      <Header title="Dogs shared with you" />
      {notice && <p className="authMessage" role="status">{notice}</p>}
      {shared.length > 0 && (
        <ul className={styles.list}>
          {shared.map((p) => (
            <li key={p.pet_id} className={styles.item}>
              <span className={styles.avatar}>{p.photo_url ? <img src={p.photo_url} alt="" width={36} height={36} style={{ borderRadius: '50%', objectFit: 'cover' }} /> : (p.pet_name || '?').slice(0, 1)}</span>
              <span className={styles.itemMain}>
                <strong>{p.pet_name}</strong>
                <small>{p.owner_name ? `${p.owner_name}'s dog` : 'Shared dog'} - {p.role}</small>
              </span>
              {!p.has_access && <span className={`${styles.badge} ${styles.off}`} title="The owner's plan doesn't include households right now">Paused</span>}
            </li>
          ))}
        </ul>
      )}
      {shared.some((p) => !p.has_access) && <p className="formHint">Paused dogs come back automatically when the owner&apos;s plan includes households again.</p>}
    </section>
  );
}
