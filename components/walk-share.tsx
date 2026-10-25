"use client";

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Footprints, Users } from './icons';

/**
 * "I'm walking" sharing for the Walks page. While a walk is running and sharing is on,
 * the owner's rough area (~1 km, rounded in the database) and "walking now" are shared
 * with their Dog Pack, or with verified owners nearby too. It clears when the walk ends.
 */
type Audience = 'off' | 'pack' | 'area';
type Walker = { name: string; dog_name: string | null; minutes_ago: number };

export function WalkShare({ walking, point, dogName }: { walking: boolean; point?: { lat: number; lng: number }; dogName: string }) {
  const [signedIn, setSignedIn] = useState(false);
  const [audience, setAudience] = useState<Audience>('off');
  const [walkers, setWalkers] = useState<Walker[]>([]);
  const [note, setNote] = useState('');
  const lastSent = useRef(0);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
    try { const saved = localStorage.getItem('mypetid.walkShare') as Audience | null; if (saved) setAudience(saved); } catch { /* storage blocked */ }
  }, []);

  // Friends out walking now (refreshes every minute)
  useEffect(() => {
    if (!supabase || !signedIn) return;
    const load = () => supabase!.rpc('pack_walking_now').then(({ data, error }) => { if (!error) setWalkers((data || []) as Walker[]); });
    load();
    const timer = window.setInterval(load, 60000);
    return () => window.clearInterval(timer);
  }, [signedIn]);

  // Publish while walking; clear when the walk ends or sharing is turned off
  useEffect(() => {
    if (!supabase || !signedIn) return;
    (async () => {
      const { data } = await supabase!.auth.getSession();
      const me = data.session?.user.id;
      if (!me) return;
      if (!walking || audience === 'off') {
        await supabase!.from('owner_presence').update({ walking: false }).eq('profile_id', me);
        return;
      }
      if (!point || Date.now() - lastSent.current < 55000) return;
      lastSent.current = Date.now();
      const { error } = await supabase!.from('owner_presence').upsert({ profile_id: me, lat_round: point.lat, lng_round: point.lng, dog_name: dogName || null, walking: true, audience });
      setNote(error ? (/verified|row-level/i.test(error.message) ? 'Verify your email to share walks.' : 'Walk sharing isn’t available yet.') : audience === 'pack' ? 'Your Dog Pack can see you’re out walking.' : 'Your Dog Pack and nearby owners can see you’re out walking (about 1 km accuracy).');
    })();
  }, [walking, audience, point, signedIn, dogName]);

  function choose(next: Audience) {
    setAudience(next);
    lastSent.current = 0;
    try { localStorage.setItem('mypetid.walkShare', next); } catch { /* storage blocked */ }
  }

  if (!signedIn) return null;
  return (
    <section className="panel full walkShare">
      <div className="panelTitleRow"><div><p className="eyebrow">Walk together</p><h3 style={{ margin: 0 }}>Share that you’re walking</h3></div><span className="iconBubble green"><Footprints /></span></div>
      <div className="authTabs three" role="radiogroup" aria-label="Who can see your walk">
        {(['off', 'pack', 'area'] as Audience[]).map((a) => <button key={a} type="button" role="radio" aria-checked={audience === a} className={audience === a ? 'active' : ''} onClick={() => choose(a)}>{a === 'off' ? 'Private' : a === 'pack' ? 'My Dog Pack' : 'Pack + nearby'}</button>)}
      </div>
      <p className="formHint">{walking ? note || 'Sharing starts as soon as your phone has a GPS fix.' : 'Starts when you start a walk and stops when you end it.'}</p>
      <h4 className="walkersHead"><Users /> Out walking now</h4>
      {walkers.length === 0 ? <p className="formHint">None of your Dog Pack is out right now.</p> : <ul className="friendList">{walkers.map((w, i) => <li key={i}><span className="nearbyRow"><span className="avatarDot">{w.name.slice(0, 1)}</span><span><strong>{w.name}</strong><small>{w.dog_name ? `walking ${w.dog_name}` : 'walking'} · {w.minutes_ago < 2 ? 'just now' : `${w.minutes_ago} min ago`}</small></span></span></li>)}</ul>}
    </section>
  );
}
