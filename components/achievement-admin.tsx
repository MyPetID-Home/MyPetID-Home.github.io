"use client";

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Trophy } from './icons';

/** Admin-only editor for achievements (award_rules). RLS lets only admins write these. */
type Rule = { id: string; title: string; category: string; icon: string; trigger_key: string; target: number; points: number; requirement: string; active: boolean; admin_locked: boolean };
const TRIGGERS = ['profile_completion', 'profile_photo', 'tag_claimed', 'contact_public', 'lost_resolved', 'scan_shared', 'walks_completed', 'walk_streak_days', 'miles_walked', 'walks_before_8am', 'walks_after_8pm', 'new_places', 'dog_parks_visited', 'meals_completed', 'meal_streak_days', 'water_logged', 'tricks_mastered', 'training_sessions', 'play_minutes', 'documents_uploaded', 'vaccines_current', 'vet_visits', 'grooming_logged', 'reminders_set', 'pack_friends', 'meetups_joined', 'meetups_hosted', 'birthday', 'days_member', 'custom'];
const blank: Omit<Rule, 'id'> = { title: '', category: 'Custom', icon: '🏆', trigger_key: 'custom', target: 1, points: 25, requirement: '', active: true, admin_locked: true };

function RuleForm({ rule, onSave, onDelete, saving }: { rule: Omit<Rule, 'id'> & { id?: string }; onSave: (r: Omit<Rule, 'id'> & { id?: string }) => void; onDelete?: () => void; saving: boolean }) {
  const [draft, setDraft] = useState(rule);
  const changed = JSON.stringify(draft) !== JSON.stringify(rule);
  return (
    <form className={`achRule ${draft.active ? '' : 'off'}`} onSubmit={(e) => { e.preventDefault(); onSave(draft); }}>
      <input className="achIcon" value={draft.icon} onChange={(e) => setDraft({ ...draft, icon: e.target.value.slice(0, 4) })} aria-label="Icon" />
      <input className="achTitle" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Achievement name" required aria-label="Title" />
      <input value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} aria-label="Category" placeholder="Category" />
      <select value={draft.trigger_key} onChange={(e) => setDraft({ ...draft, trigger_key: e.target.value })} aria-label="Trigger">{TRIGGERS.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}</select>
      <label className="achNum">Target<input type="number" step="any" min={0} value={draft.target} onChange={(e) => setDraft({ ...draft, target: Number(e.target.value) })} /></label>
      <label className="achNum">XP<input type="number" min={0} value={draft.points} onChange={(e) => setDraft({ ...draft, points: Number(e.target.value) })} /></label>
      <input className="achReq" value={draft.requirement} onChange={(e) => setDraft({ ...draft, requirement: e.target.value })} placeholder="What the owner has to do" required aria-label="Requirement" />
      <label className="toggleRow achActive"><input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} /> Active</label>
      <div className="actions compact">
        <button className="primary" type="submit" disabled={saving || (!changed && Boolean(rule.id))}>{rule.id ? 'Save' : 'Add'}</button>
        {onDelete && <button type="button" className="ghost" onClick={onDelete} disabled={saving}>Delete</button>}
      </div>
    </form>
  );
}

export function AchievementAdmin() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [filter, setFilter] = useState('All');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [adding, setAdding] = useState(false);

  async function load() {
    if (!supabase) return;
    const { data, error } = await supabase.from('award_rules').select('*').order('category').order('points');
    if (error) return setMessage(error.message);
    setRules((data || []) as Rule[]);
  }
  useEffect(() => { load(); }, []);
  const categories = useMemo(() => ['All', ...Array.from(new Set(rules.map((r) => r.category)))], [rules]);
  const shown = rules.filter((r) => filter === 'All' || r.category === filter);

  async function save(rule: Omit<Rule, 'id'> & { id?: string }) {
    if (!supabase) return;
    setSaving(true);
    const { id, ...fields } = rule;
    const { error } = id ? await supabase.from('award_rules').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', id) : await supabase.from('award_rules').insert(fields);
    setSaving(false);
    if (error) return setMessage(error.message);
    setMessage(id ? `Saved “${rule.title}”.` : `Added “${rule.title}”.`);
    setAdding(false);
    load();
  }
  async function remove(rule: Rule) {
    if (!supabase || !window.confirm(`Delete “${rule.title}”? Owners who earned it keep their XP.`)) return;
    const { error } = await supabase.from('award_rules').delete().eq('id', rule.id);
    if (error) return setMessage(error.message);
    setMessage(`Deleted “${rule.title}”.`);
    load();
  }

  return (
    <article className="panel wide adminLivePanel achAdmin">
      <div className="panelTitleRow"><div><p className="eyebrow">Admin · achievements</p><h3 style={{ margin: 0 }}>{rules.length} achievements · {rules.filter((r) => r.active).length} active</h3></div><span className="iconBubble"><Trophy /></span></div>
      <p className="formHint">Owners earn these automatically; only admins can change them.</p>
      <div className="chipCloud">{categories.map((c) => <button key={c} type="button" className={filter === c ? 'activeMini' : ''} onClick={() => setFilter(c)}>{c}</button>)}<button type="button" className="primary" onClick={() => setAdding(!adding)}>{adding ? 'Cancel' : 'New achievement'}</button></div>
      {message && <p className="authMessage" role="status">{message}</p>}
      {adding && <RuleForm rule={blank} onSave={save} saving={saving} />}
      <div className="achList">{shown.map((rule) => <RuleForm key={`${rule.id}-${rule.points}-${rule.target}-${rule.active}-${rule.title}`} rule={rule} onSave={save} onDelete={() => remove(rule)} saving={saving} />)}</div>
    </article>
  );
}
