"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { apiFetch, bearer } from '../lib/api-client';
import { Bell } from './icons';
import { PUSH_AVAILABLE, PushOptIn } from './push-optin';

/** In-app notifications (bell + panel) and the admin announcement composer. */
type Note = { id: string; kind: string; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string };

function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now'; if (s < 3600) return `${Math.round(s / 60)} min ago`; if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function NotificationBell() {
  const [me, setMe] = useState('');
  const [notes, setNotes] = useState<Note[]>([]);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(40);
    if (data) setNotes(data as Note[]);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let channel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null;
    supabase.auth.getSession().then(({ data }) => {
      const id = data.session?.user.id;
      if (!id) return;
      setMe(id);
      load();
      channel = supabase!.channel(`notes-${id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `profile_id=eq.${id}` }, (payload) => {
        const note = payload.new as Note;
        setNotes((list) => [note, ...list.filter((n) => n.id !== note.id)]);
        // A system notification when the tab is in the background and the owner allowed it
        try { if (document.hidden && 'Notification' in window && Notification.permission === 'granted') new Notification(note.title, { body: note.body || undefined, icon: '/images/logo/icon-192.png' }); } catch { /* unsupported */ }
      }).subscribe();
    });
    return () => { if (channel) supabase?.removeChannel(channel); };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (box.current && !box.current.contains(event.target as Node)) setOpen(false); };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);

  if (!me) return null;
  const unread = notes.filter((n) => !n.read_at).length;
  async function markAll() {
    if (!supabase || !unread) return;
    const now = new Date().toISOString();
    setNotes((list) => list.map((n) => n.read_at ? n : { ...n, read_at: now }));
    await supabase.from('notifications').update({ read_at: now }).is('read_at', null).eq('profile_id', me);
  }
  async function openNote(note: Note) {
    if (supabase && !note.read_at) { await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', note.id); setNotes((list) => list.map((n) => n.id === note.id ? { ...n, read_at: new Date().toISOString() } : n)); }
    if (note.link) window.location.assign(note.link);
  }
  async function enablePhone() {
    if (!('Notification' in window)) return;
    await Notification.requestPermission();
  }

  return (
    <div className="noteBox" ref={box}>
      <button className="noteBell" type="button" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} aria-expanded={open} onClick={() => setOpen(!open)}><Bell />{unread > 0 && <span className="redAlert">{unread > 9 ? '9+' : unread}</span>}</button>
      {open && <div className="notePanel" role="dialog" aria-label="Notifications">
        <div className="notePanelHead"><strong>Notifications</strong>{unread > 0 && <button type="button" onClick={markAll}>Mark all read</button>}</div>
        {notes.length === 0 ? <p className="formHint">You’re all caught up.</p> : <ul>{notes.map((n) => <li key={n.id}><button type="button" className={n.read_at ? '' : 'unread'} onClick={() => openNote(n)}><span className={`noteDot ${n.kind}`} /><span><strong>{n.title}</strong>{n.body && <small>{n.body}</small>}<em>{ago(n.created_at)}</em></span></button></li>)}</ul>}
        {PUSH_AVAILABLE ? <div className="noteEnable"><PushOptIn compact /></div> : typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default' && <button className="noteEnable" type="button" onClick={enablePhone}>Also alert me on this device</button>}
      </div>}
    </div>
  );
}

type Announcement = { id: string; title: string; body: string; link: string | null; audience: string; send_email: boolean; recipients: number; emailed_at: string | null; created_at: string };

export function AnnouncementAdmin() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [draft, setDraft] = useState({ title: '', body: '', link: '', audience: 'all', send_email: false });
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(30);
    if (error) return setMessage(/schema cache|does not exist|42P01/i.test(error.message) ? 'Announcements switch on after the latest database update.' : error.message);
    setItems((data || []) as Announcement[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function email(id: string) {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;
    const response = await apiFetch('/api/admin/announce-email/', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: bearer(data.session.access_token) }, body: JSON.stringify({ announcementId: id }) });
    const json = await response.json().catch(() => ({}));
    setMessage(response.ok ? json.message : json.error || 'Email failed.');
    load();
  }
  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase || !draft.title.trim() || !draft.body.trim()) return;
    if (!window.confirm(`Send “${draft.title}” to ${draft.audience === 'all' ? 'everyone' : draft.audience}${draft.send_email ? ' and email them' : ''}?`)) return;
    setBusy(true);
    const { data, error } = await supabase.from('announcements').insert({ title: draft.title.trim(), body: draft.body.trim(), link: draft.link.trim() || null, audience: draft.audience, send_email: draft.send_email }).select('id,recipients').single();
    setBusy(false);
    if (error) return setMessage(error.message);
    setMessage('Announcement sent to the in-app inbox.');
    if (draft.send_email) await email((data as { id: string }).id);
    setDraft({ title: '', body: '', link: '', audience: 'all', send_email: false });
    load();
  }

  return (
    <article className="panel wide adminLivePanel">
      <div className="panelTitleRow"><div><p className="eyebrow">Admin · announcements</p><h3 style={{ margin: 0 }}>Send an announcement</h3></div><span className="iconBubble"><Bell /></span></div>
      {message && <p className="authMessage" role="status">{message}</p>}
      <form onSubmit={send}>
        <div className="grid2">
          <label>Title<input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} maxLength={120} required /></label>
          <label>Who gets it<select value={draft.audience} onChange={(e) => setDraft({ ...draft, audience: e.target.value })}><option value="all">Everyone</option><option value="members">Paying members</option><option value="free">Free accounts</option><option value="admins">Admins only (test)</option></select></label>
        </div>
        <label>Message<textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} maxLength={2000} required /></label>
        <div className="grid2">
          <label>Link (optional)<input value={draft.link} onChange={(e) => setDraft({ ...draft, link: e.target.value })} placeholder="/shop/" /></label>
          <label className="toggleRow"><input type="checkbox" checked={draft.send_email} onChange={(e) => setDraft({ ...draft, send_email: e.target.checked })} /> Also email it</label>
        </div>
        <div className="actions"><button className="primary" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send announcement'}</button></div>
      </form>
      <h4 style={{ margin: '18px 0 8px' }}>Sent</h4>
      {items.length === 0 ? <p className="formHint">No announcements yet.</p> : <ul className="friendList">{items.map((a) => <li key={a.id}><span className="nearbyRow"><span><strong>{a.title}</strong><small>{new Date(a.created_at).toLocaleString()} · {a.audience} · {a.recipients} inbox{a.recipients === 1 ? '' : 'es'} · {a.emailed_at ? 'emailed' : 'not emailed'}</small></span>{!a.emailed_at && <button type="button" onClick={() => email(a.id)}>Email it</button>}</span></li>)}</ul>}
    </article>
  );
}
