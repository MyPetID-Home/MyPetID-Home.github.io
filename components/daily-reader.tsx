"use client";

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { STAGE_LABELS, TOPIC_LABELS, dailyReads, getReadLog, markRead, personalAchievements, personalGoals, profileFor, readStreak, recommendations, type Counters, type DogFacts, type ReadLog, type ReadTopic } from '../lib/dog-guide';
import { MascotPeek } from './mascot';
import { Check, ChevronRight } from './icons';

/** Adds medicine side effects and status tags from the account so reads match what's going on. */
function useCloudFlags() {
  const [flags, setFlags] = useState<string[]>([]);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(async ({ data }) => {
      const uid = data.session?.user.id;
      if (!uid || !supabase) return;
      const { data: row } = await supabase.from('pets').select('profile,medical_public,behavior_public').eq('owner_id', uid).order('created_at').limit(1).maybeSingle();
      if (!row) return;
      const p = (row.profile || {}) as Record<string, unknown>;
      const meds = Array.isArray(p.medications) ? (p.medications as Record<string, unknown>[]) : [];
      setFlags([
        ...meds.flatMap((m) => [String(m.reason || ''), String(m.outcome || ''), String(m.side_effects || ''), m.side_effects ? 'side effect' : '']),
        ...(Array.isArray(p.status_tags) ? (p.status_tags as string[]) : []),
        String(row.medical_public || ''), String(row.behavior_public || ''),
        (p.details as Record<string, unknown> | undefined)?.microchip ? 'microchip' : '',
      ].filter(Boolean));
    });
  }, []);
  return flags;
}

function useReadLog() {
  const [log, setLog] = useState<ReadLog>([]);
  useEffect(() => {
    const load = () => setLog(getReadLog());
    load();
    window.addEventListener('mypetid:reads', load);
    return () => window.removeEventListener('mypetid:reads', load);
  }, []);
  return log;
}

export function useReadStats() {
  const log = useReadLog();
  return { readsTotal: new Set(log.map((x) => `${x.day}:${x.id}`)).size, readStreak: readStreak(log) };
}

const TOPICS: ReadTopic[] = ['food', 'exercise', 'training', 'grooming', 'health'];

/** Home card: today's three reads and one calm recommendation at a time. */
export function DailyReader({ facts, onXp }: { facts: DogFacts; onXp?: (xp: number, why: string) => void }) {
  const cloudFlags = useCloudFlags();
  const log = useReadLog();
  const [open, setOpen] = useState('');
  const [topic, setTopic] = useState<ReadTopic>('food');
  const [today, setToday] = useState<Date | null>(null);
  useEffect(() => { setToday(new Date()); }, []);
  const merged = useMemo(() => ({ ...facts, flags: [...(facts.flags || []), ...cloudFlags] }), [facts, cloudFlags]);
  const day = today?.toISOString().slice(0, 10) || '';
  const done = log.filter((x) => x.day === day).map((x) => x.id);
  const reads = useMemo(() => (today ? dailyReads(merged, 3, today, log.map((x) => x.id)) : []), [merged, today, log]);
  const recs = useMemo(() => (today ? recommendations(merged, today) : null), [merged, today]);
  if (!today || !recs) return null;
  const dog = recs.dog;

  function read(id: string) {
    setOpen(open === id ? '' : id);
    if (!done.includes(id)) { markRead(id); onXp?.(10, 'Daily read'); }
  }

  return (
    <section className="memoCard readerCard">
      <header className="memoCardHead"><h3>Daily reads for {facts.name}</h3><span className="readerMeta">{dog.breed?.name || facts.breed || 'Your dog'} · {STAGE_LABELS[dog.stage]}</span></header>
      <ul className="readList">{reads.map((r) => {
        const isDone = done.includes(r.id);
        return (
          <li key={r.id} className={isDone ? 'done' : ''}>
            <button type="button" className="readHead" aria-expanded={open === r.id} onClick={() => read(r.id)}>
              <span className={`readTopic ${r.topic}`}>{TOPIC_LABELS[r.topic]}</span><strong>{r.title}</strong>{isDone ? <Check /> : <ChevronRight />}
            </button>
            {open === r.id && <div className="readBody"><p>{r.body}</p>{r.link && <a href={r.link.url} target="_blank" rel="noopener noreferrer">{r.link.label}</a>}</div>}
          </li>
        );
      })}</ul>
      {reads.length > 0 && done.length >= reads.length && <div className="readerDone"><MascotPeek size={54} /><p>All read today. Nice work!</p></div>}
      <div className="recBox">
        <div className="recTabs" role="tablist" aria-label="Recommendations">{TOPICS.map((t) => <button key={t} type="button" role="tab" aria-selected={topic === t} className={topic === t ? 'active' : ''} onClick={() => setTopic(t)}>{TOPIC_LABELS[t]}</button>)}</div>
        <p className="recText">{recs.items.find((i) => i.topic === topic)?.text}</p>
        <p className="formHint">General guidance for {dog.breed ? `a ${dog.breed.name}` : 'your dog'} at this age. Your vet knows {facts.name} best.</p>
      </div>
    </section>
  );
}

/** Goals tab: goals and achievements tuned to this dog's breed, age and activity. */
function useCloudSchedule() {
  const [counts, setCounts] = useState({ scheduleItems: 0, scheduleDoneToday: 0 });
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(async ({ data }) => {
      const uid = data.session?.user.id;
      if (!uid || !supabase) return;
      const { data: row } = await supabase.from('pets').select('profile').eq('owner_id', uid).order('created_at').limit(1).maybeSingle();
      const p = ((row as { profile?: Record<string, unknown> } | null)?.profile) || {};
      const items = Array.isArray(p.care_schedule) ? p.care_schedule.length : 0;
      const today = new Date().toISOString().slice(0, 10);
      const log = Array.isArray(p.care_log) ? (p.care_log as { id?: string; at?: string }[]) : [];
      setCounts({ scheduleItems: items, scheduleDoneToday: new Set(log.filter((e) => (e.at || '').startsWith(today)).map((e) => e.id)).size });
    });
  }, []);
  return counts;
}

export function PersonalProgress({ facts, counters }: { facts: DogFacts; counters: Omit<Counters, 'readsTotal' | 'readStreak' | 'scheduleItems' | 'scheduleDoneToday'> }) {
  const reads = useReadStats();
  const schedule = useCloudSchedule();
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); }, []);
  if (!now) return null;
  const c: Counters = { ...counters, ...reads, ...schedule };
  const dog = profileFor(facts, now);
  const goals = personalGoals(facts, c, now);
  const awards = personalAchievements(facts, c, now);
  const earned = awards.filter((a) => a.done);
  return (
    <section className="memoCard full">
      <header className="memoCardHead"><h3>Made for {facts.name}</h3><span className="readerMeta">{dog.breed?.name || 'Your dog'} · {STAGE_LABELS[dog.stage]}</span></header>
      <p className="formHint">These goals change with {facts.name}’s breed, age and routine, so every dog gets its own list.</p>
      <ul className="goalList">{goals.map((g) => {
        const pct = Math.min(100, Math.round((g.current / Math.max(1, g.target)) * 100));
        return (
          <li key={g.id} className={pct >= 100 ? 'done' : ''}>
            <div className="goalTop"><strong>{g.title}</strong><span>{Math.min(g.current, g.target).toLocaleString(undefined, { maximumFractionDigits: 1 })}/{g.target} {g.unit} · +{g.xp} XP</span></div>
            <div className="progress"><span style={{ width: `${pct}%` }} /></div>
            <small>{g.detail}</small>
          </li>
        );
      })}</ul>
      <h4 style={{ margin: '18px 0 8px' }}>Achievements · {earned.length}/{awards.length}</h4>
      <div className="awardGrid">{awards.map((a) => <div key={a.id} className={`awardChip ${a.done ? 'earned' : ''}`}><strong>{a.done ? '🏅 ' : ''}{a.title}</strong><small>{a.requirement}</small><em>+{a.xp} XP</em></div>)}</div>
    </section>
  );
}
