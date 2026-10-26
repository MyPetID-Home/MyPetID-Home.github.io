"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { Session } from '@supabase/supabase-js';
import { QRCodeSVG } from 'qrcode.react';
import { PUBLIC_APP_URL } from '../lib/public-url';
import { supabase } from '../lib/supabase';
import { apiFetch, bearer } from '../lib/api-client';
import { Chat, MapPinned, ShieldCheck, Users, Check, Sparkles } from './icons';

/**
 * Dog Pack, backed by Supabase (docs/migrations/2026-10-dog-pack-social.sql):
 * invite friends, chat with them, find or host meetups, and opt in to "nearby owners".
 * The database enforces who can see and do what; this UI just explains it kindly.
 */
type Friend = { profile_id: string; name: string; dog_name: string | null; since: string | null };
type Message = { id: string; sender_id: string; receiver_id: string; body: string; created_at: string };
type Meetup = { id: string; title: string; details: string | null; starts_at: string; place_name: string | null; lat: number; lng: number; visibility: 'public' | 'pack'; max_dogs: number; host_name: string; is_host: boolean; going: number; i_am_going: boolean; km: number };
type Nearby = { name: string; dog_name: string | null; approx_km: number; minutes_ago: number; is_friend: boolean };
type Place = { name: string; lat: number; lng: number };

const NOT_READY = /could not find the function|does not exist|schema cache/i;

function when(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
function locate(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('This browser can’t share a location.'));
    navigator.geolocation.getCurrentPosition((p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }), () => reject(new Error('Location wasn’t allowed.')), { enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 });
  });
}

export function DogPackCloud({ dogName }: { dogName: string }) {
  const [session, setSession] = useState<Session | null>(null);
  const [checked, setChecked] = useState(false);
  const [verified, setVerified] = useState(true);
  const [ready, setReady] = useState(true);
  const [notice, setNotice] = useState('');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [invite, setInvite] = useState('');
  const [packCode, setPackCode] = useState('');
  const [chatWith, setChatWith] = useState<Friend | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
  const [meetups, setMeetups] = useState<Meetup[]>([]);
  const [nearby, setNearby] = useState<Nearby[]>([]);
  const [sharing, setSharing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: `${dogName || 'Dog'} park meetup`, when: '', details: '', visibility: 'public' as 'public' | 'pack', maxDogs: '8' });
  const [placeQuery, setPlaceQuery] = useState('');
  const [places, setPlaces] = useState<Place[]>([]);
  const [place, setPlace] = useState<Place | null>(null);
  const chatEnd = useRef<HTMLDivElement>(null);
  const me = session?.user.id || '';

  useEffect(() => {
    if (!supabase) { setChecked(true); return; }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setChecked(true); });
    const { data: listener } = supabase.auth.onAuthStateChange((_e, next) => setSession(next));
    return () => listener.subscription.unsubscribe();
  }, []);

  const handle = useCallback((error: { message: string } | null, fallback?: string) => {
    if (!error) return false;
    if (NOT_READY.test(error.message)) { setReady(false); return true; }
    setNotice(fallback || error.message);
    return true;
  }, []);

  const loadFriends = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.rpc('pack_friends');
    if (!handle(error)) setFriends((data || []) as Friend[]);
  }, [handle]);

  // First load once signed in: verification status, friends, and any invite in the URL
  useEffect(() => {
    if (!supabase || !me) return;
    (async () => {
      const { data: isVerified, error } = await supabase!.rpc('mypetid_is_verified');
      if (handle(error)) return;
      setVerified(Boolean(isVerified));
      const { data: myCode } = await supabase!.rpc('my_pack_code');
      if (typeof myCode === 'string') setPackCode(myCode);
      // Joining by someone's personal Dog Pack QR (?join=CODE), possibly saved from before sign-in
      let joinCode = new URLSearchParams(window.location.search).get('join') || '';
      try { joinCode = joinCode || localStorage.getItem('mypetid.pendingJoin') || ''; localStorage.removeItem('mypetid.pendingJoin'); } catch { /* storage blocked */ }
      if (joinCode) {
        const { data: who, error: joinError } = await supabase!.rpc('join_pack_by_code', { p_code: joinCode });
        if (!handle(joinError)) setNotice(`You’re now in ${who || 'their'}’s Dog Pack!`);
        const url = new URL(window.location.href); url.searchParams.delete('join'); window.history.replaceState(null, '', url.toString());
      }
      const code = new URLSearchParams(window.location.search).get('invite');
      if (code) {
        const { error: acceptError } = await supabase!.rpc('accept_pack_invite', { p_code: code });
        if (!handle(acceptError)) setNotice('You joined their Dog Pack! Say hi below.');
        const url = new URL(window.location.href); url.searchParams.delete('invite'); window.history.replaceState(null, '', url.toString());
      }
      await loadFriends();
    })();
  }, [me, handle, loadFriends]);

  // Chat: load the conversation and listen for new messages addressed to me
  useEffect(() => {
    if (!supabase || !me || !chatWith) return;
    let active = true;
    supabase.from('pack_messages').select('*')
      .or(`and(sender_id.eq.${me},receiver_id.eq.${chatWith.profile_id}),and(sender_id.eq.${chatWith.profile_id},receiver_id.eq.${me})`)
      .order('created_at', { ascending: true }).limit(200)
      .then(({ data, error }) => { if (active && !handle(error)) setMessages((data || []) as Message[]); });
    const channel = supabase.channel(`pack-${me}-${chatWith.profile_id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pack_messages', filter: `receiver_id=eq.${me}` }, (payload) => {
        const msg = payload.new as Message;
        if (msg.sender_id === chatWith.profile_id) setMessages((list) => (list.some((m) => m.id === msg.id) ? list : [...list, msg]));
      })
      .subscribe();
    return () => { active = false; supabase?.removeChannel(channel); };
  }, [me, chatWith, handle]);
  useEffect(() => { chatEnd.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [messages]);

  async function createInvite() {
    if (!session) return;
    setNotice('Creating your invite…');
    try {
      const response = await apiFetch('/api/dog-pack/invites/', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: bearer(session.access_token) }, body: JSON.stringify({ maxUses: 1 }) });
      const json = await response.json();
      if (!response.ok) return setNotice(json.error || 'Couldn’t create an invite.');
      setInvite(json.inviteUrl); setNotice('Share this link or QR code with a friend. It works once.');
    } catch { setNotice('We couldn’t reach the MyPetID server. Try again in a moment.'); }
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase || !chatWith || !draft.trim()) return;
    const body = draft.trim();
    setDraft('');
    const { data, error } = await supabase.from('pack_messages').insert({ receiver_id: chatWith.profile_id, body }).select('*').single();
    if (handle(error, verified ? 'Message not sent. You can only message friends in your Dog Pack.' : 'Verify your email to send messages.')) { setDraft(body); return; }
    setMessages((list) => [...list, data as Message]);
  }

  const loadMeetups = useCallback(async (point: { lat: number; lng: number }) => {
    if (!supabase) return;
    const { data, error } = await supabase.rpc('meetups_near', { p_lat: point.lat, p_lng: point.lng, p_km: 40 });
    if (!handle(error)) setMeetups((data || []) as Meetup[]);
    const { data: owners, error: nearbyError } = await supabase.rpc('nearby_owners', { p_lat: point.lat, p_lng: point.lng, p_km: 10 });
    if (!handle(nearbyError)) setNearby((owners || []) as Nearby[]);
    const { data: mine } = await supabase.from('owner_presence').select('updated_at').eq('profile_id', me).maybeSingle();
    setSharing(Boolean(mine && Date.now() - new Date(mine.updated_at).getTime() < 3 * 3600 * 1000));
  }, [handle, me]);

  async function useMyArea() {
    try { const point = await locate(); setHere(point); await loadMeetups(point); setNotice(''); } catch (error) { setNotice(error instanceof Error ? error.message : 'Location unavailable.'); }
  }

  async function toggleSharing() {
    if (!supabase) return;
    if (sharing) {
      await supabase.from('owner_presence').delete().eq('profile_id', me);
      setSharing(false); setNotice('You’re hidden from nearby owners.');
      return;
    }
    try {
      const point = here || await locate();
      setHere(point);
      const { error } = await supabase.from('owner_presence').upsert({ profile_id: me, lat_round: point.lat, lng_round: point.lng, dog_name: dogName || null });
      if (handle(error, 'Verify your email to appear to nearby owners.')) return;
      setSharing(true); setNotice('Nearby owners can see your first name, your dog and roughly how far away you are (never your exact spot) for 3 hours.');
      await loadMeetups(point);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Location unavailable.'); }
  }

  async function searchPlaces(event: React.FormEvent) {
    event.preventDefault();
    if (!placeQuery.trim()) return;
    try {
      const bias = here ? `&lat=${here.lat}&lon=${here.lng}` : '';
      const json = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(placeQuery.trim())}&limit=5${bias}`).then((r) => r.json()) as { features: { geometry: { coordinates: [number, number] }; properties: { name?: string; city?: string; state?: string } }[] };
      setPlaces(json.features.map((f) => ({ name: [f.properties.name, f.properties.city, f.properties.state].filter(Boolean).join(', '), lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] })));
    } catch { setNotice('Place search is unavailable right now.'); }
  }

  async function createMeetup(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase || !place || !form.when) return setNotice('Pick a place and a time.');
    const { error } = await supabase.from('meetups').insert({ title: form.title.trim(), details: form.details.trim() || null, starts_at: new Date(form.when).toISOString(), place_name: place.name, lat: place.lat, lng: place.lng, visibility: form.visibility, max_dogs: Number(form.maxDogs) || 8 });
    if (handle(error, verified ? 'Couldn’t post the meetup. Check the title and time.' : 'Verify your email to host meetups.')) return;
    setCreating(false); setPlace(null); setPlaces([]); setPlaceQuery('');
    setNotice('Meetup posted!');
    await loadMeetups(here || place);
  }

  async function join(meetup: Meetup) {
    if (!supabase) return;
    const { error } = meetup.i_am_going
      ? await supabase.from('meetup_attendees').delete().eq('meetup_id', meetup.id).eq('profile_id', me)
      : await supabase.from('meetup_attendees').insert({ meetup_id: meetup.id, dog_name: dogName || null });
    if (handle(error)) return;
    if (here) loadMeetups(here);
  }
  async function cancel(meetup: Meetup) {
    if (!supabase) return;
    const { error } = await supabase.from('meetups').update({ status: 'cancelled' }).eq('id', meetup.id);
    if (!handle(error) && here) loadMeetups(here);
  }
  async function report(meetup: Meetup) {
    if (!supabase) return;
    const reason = window.prompt('What’s wrong with this meetup? (MyPetID reviews every report)');
    if (!reason || reason.trim().length < 3) return;
    const { error } = await supabase.from('meetup_reports').insert({ meetup_id: meetup.id, reason: reason.trim() });
    if (!handle(error, 'You already reported this meetup.')) setNotice('Thanks. We’ll take a look.');
  }

  const minWhen = useMemo(() => { const d = new Date(Date.now() + 30 * 60000); d.setSeconds(0, 0); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }, []);

  if (!checked) return null;
  if (!supabase || !session) {
    return (
      <section className="panel full packCloud">
        <div className="panelTitleRow"><div><p className="eyebrow">Dog Pack</p><h2>Meet other dog owners</h2></div><span className="iconBubble violet"><Users /></span></div>
        <p>Sign in to invite friends, chat, join meetups at dog parks and see who’s out walking nearby.</p>
        <div className="actions"><Link className="button primary" href="/">Sign in or create an account</Link></div>
      </section>
    );
  }
  if (!ready) {
    return (
      <section className="panel full packCloud">
        <div className="panelTitleRow"><div><p className="eyebrow">Dog Pack</p><h2>Coming online soon</h2></div><span className="iconBubble violet"><Sparkles /></span></div>
        <p>Friends, chat and meetups are almost ready. They switch on as soon as the Dog Pack database update is applied.</p>
      </section>
    );
  }

  return (
    <section className="panel full packCloud">
      <div className="panelTitleRow"><div><p className="eyebrow">Dog Pack</p><h2>Your pack & meetups</h2></div><span className="iconBubble violet"><Users /></span></div>
      {!verified && <p className="notice"><ShieldCheck /> To keep everyone safe, only owners with a verified email can message, host or join meetups. Verify your email in Account.</p>}
      {notice && <p className="authMessage" role="status">{notice}</p>}

      <div className="packGrid">
        <article className="shareTile">
          <h3><Users /> Friends</h3>
          {friends.length === 0 ? <p className="formHint">No friends yet. Send an invite to start your pack.</p> : <ul className="friendList">{friends.map((f) => (
            <li key={f.profile_id}><button type="button" className={chatWith?.profile_id === f.profile_id ? 'activeMini' : ''} onClick={() => setChatWith(f)}><span className="avatarDot">{f.name.slice(0, 1)}</span><span><strong>{f.name}</strong><small>{f.dog_name ? `with ${f.dog_name}` : 'Dog Pack friend'}</small></span><Chat /></button></li>
          ))}</ul>}
          {packCode && <div className="inviteBox myPackQr"><p className="eyebrow">My Dog Pack QR</p><div className="codeBox"><QRCodeSVG value={`${PUBLIC_APP_URL}/dashboard/pack/?join=${packCode}`} size={150} marginSize={2} /></div><p className="formHint">Friends scan this with their phone camera to join your pack. Code <code>{packCode}</code></p></div>}
          <button type="button" onClick={createInvite}>Send an invite link</button>
          {invite && <div className="inviteBox"><div className="codeBox"><QRCodeSVG value={invite} size={132} marginSize={2} /></div><input readOnly value={invite} onFocus={(e) => e.target.select()} aria-label="Invite link" /><button type="button" onClick={() => navigator.clipboard?.writeText(invite).then(() => setNotice('Invite link copied.'))}>Copy link</button></div>}
        </article>

        <article className="shareTile chatTile">
          <h3><Chat /> {chatWith ? `Chat with ${chatWith.name}` : 'Chat'}</h3>
          {!chatWith ? <p className="formHint">Pick a friend to start chatting.</p> : <>
            <div className="chatLog" aria-live="polite">
              {messages.length === 0 && <p className="formHint">No messages yet. Say hi!</p>}
              {messages.map((m) => <p key={m.id} className={`chatMsg ${m.sender_id === me ? 'mine' : ''}`}><span>{m.body}</span><small>{new Date(m.created_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</small></p>)}
              <div ref={chatEnd} />
            </div>
            <form className="copyRow" onSubmit={send}><input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Plan a walk…" maxLength={1000} aria-label="Message" /><button className="primary" type="submit">Send</button></form>
          </>}
        </article>
      </div>

      <div className="panelTitleRow" style={{ marginTop: 22 }}><h3 style={{ margin: 0 }}>Meetups & nearby owners</h3><div className="actions compact"><button type="button" onClick={useMyArea}><MapPinned /> {here ? 'Refresh my area' : 'Use my area'}</button><button className={sharing ? 'primary' : ''} type="button" onClick={toggleSharing}>{sharing ? <><Check /> Visible nearby</> : 'Show me nearby'}</button><button type="button" onClick={() => setCreating(!creating)}>{creating ? 'Close' : 'Host a meetup'}</button></div></div>

      {creating && <form className="meetupForm" onSubmit={createMeetup}>
        <label>Title<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={80} required /></label>
        <label>When<input type="datetime-local" min={minWhen} value={form.when} onChange={(e) => setForm({ ...form, when: e.target.value })} required /></label>
        <label>Who can see it<select value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value as 'public' | 'pack' })}><option value="public">Verified MyPetID owners</option><option value="pack">Only my Dog Pack</option></select></label>
        <label>Max dogs<input type="number" min={2} max={50} value={form.maxDogs} onChange={(e) => setForm({ ...form, maxDogs: e.target.value })} /></label>
        <label className="span2">Details<textarea value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} maxLength={600} placeholder="Leash rules, what to bring, how to find you…" /></label>
        <div className="span2"><div className="copyRow"><input value={placeQuery} onChange={(e) => setPlaceQuery(e.target.value)} placeholder="Search for the park or trail" aria-label="Meetup place" /><button type="button" onClick={searchPlaces}>Find</button></div>
          {places.length > 0 && <div className="chipCloud" style={{ marginTop: 8 }}>{places.map((p) => <button key={`${p.lat},${p.lng}`} type="button" className={place?.name === p.name ? 'activeMini' : ''} onClick={() => setPlace(p)}>{p.name}</button>)}</div>}
          {place && <p className="formHint" style={{ marginTop: 8 }}>Meeting at <strong>{place.name}</strong></p>}
        </div>
        <div className="span2 actions"><button className="primary" type="submit">Post meetup</button></div>
      </form>}

      {!here ? <p className="formHint">Tap “Use my area” to see meetups and owners near you. We only use it to search; it isn’t saved unless you choose “Show me nearby”.</p> : <div className="packGrid">
        <div className="meetupList">
          {meetups.length === 0 ? <p className="formHint">No upcoming meetups within 40 km. Why not host one?</p> : meetups.map((m) => (
            <article key={m.id} className="meetupCard">
              <div className="meetupDate"><strong>{new Date(m.starts_at).getDate()}</strong><small>{new Date(m.starts_at).toLocaleString(undefined, { month: 'short' })}</small></div>
              <div className="meetupBody">
                <h4>{m.title}</h4>
                <p className="mutedLine">{when(m.starts_at)} · {m.place_name || 'Map pin'} · {m.km} km away</p>
                {m.details && <p className="formHint">{m.details}</p>}
                <p className="mutedLine">Hosted by {m.is_host ? 'you' : m.host_name} · {m.going}/{m.max_dogs} dogs going{m.visibility === 'pack' ? ' · Dog Pack only' : ''}</p>
                <div className="actions compact">
                  {!m.is_host && <button className={m.i_am_going ? '' : 'primary'} type="button" disabled={!m.i_am_going && m.going >= m.max_dogs} onClick={() => join(m)}>{m.i_am_going ? 'Leave' : m.going >= m.max_dogs ? 'Full' : 'Join'}</button>}
                  <a className="button" href={`https://www.openstreetmap.org/directions?to=${m.lat},${m.lng}`} target="_blank" rel="noreferrer">Directions</a>
                  {m.is_host ? <button type="button" onClick={() => cancel(m)}>Cancel meetup</button> : <button className="ghost" type="button" onClick={() => report(m)}>Report</button>}
                </div>
              </div>
            </article>
          ))}
        </div>
        <article className="shareTile">
          <h3><MapPinned /> Out walking nearby</h3>
          {nearby.length === 0 ? <p className="formHint">{sharing ? 'Nobody else is sharing nearby right now.' : 'Turn on “Show me nearby” to see and be seen by owners out walking.'}</p> : <ul className="friendList">{nearby.map((n, i) => <li key={i}><span className="nearbyRow"><span className="avatarDot">{n.name.slice(0, 1)}</span><span><strong>{n.name}{n.is_friend ? ' · friend' : ''}</strong><small>{n.dog_name ? `with ${n.dog_name} · ` : ''}about {n.approx_km} km · {n.minutes_ago < 5 ? 'just now' : `${n.minutes_ago} min ago`}</small></span></span></li>)}</ul>}
          <p className="formHint">Locations are rounded to about 1 km and disappear after 3 hours.</p>
        </article>
      </div>}
    </section>
  );
}
