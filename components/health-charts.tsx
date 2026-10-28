"use client";

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatDay, isMissingRelation, todayIso, useOwnerPets } from '../lib/owner-pets';
import styles from './health-charts.module.css';

/**
 * Weight log (public.pet_weights) with a hand-rolled SVG line chart, the change since the last
 * weigh-in, a simple body condition note, and vet visits per year from pet_health_records.
 */

type Weight = { id: string; pet_id: string; weighed_on: string; weight_lb: number; note: string | null };
type Range = '3m' | '1y' | 'all';
const RANGES: { key: Range; label: string; days: number | null }[] = [
  { key: '3m', label: '3M', days: 92 },
  { key: '1y', label: '1Y', days: 366 },
  { key: 'all', label: 'All', days: null },
];

const dayMs = 86_400_000;
const toTime = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const lb = (n: number) => `${Number(n.toFixed(1))} lb`;

function niceTicks(min: number, max: number, count = 4) {
  const span = Math.max(max - min, 1);
  const rough = span / count;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((s) => s * pow).find((s) => s >= rough) || rough;
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Number(v.toFixed(4)));
  return ticks;
}

/** Plain-language trend note. Not a diagnosis: points the owner at the rib check and their vet. */
function conditionNote(points: Weight[], name: string) {
  if (points.length < 2) return `Log ${name}’s weight every few weeks to see a trend. A healthy dog’s ribs are easy to feel under a thin layer of fat, with a visible waist from above.`;
  const last = points[points.length - 1];
  const target = toTime(last.weighed_on) - 90 * dayMs;
  const base = [...points].reverse().find((p) => toTime(p.weighed_on) <= target) || points[0];
  const days = Math.max(1, Math.round((toTime(last.weighed_on) - toTime(base.weighed_on)) / dayMs));
  const pct = ((last.weight_lb - base.weight_lb) / base.weight_lb) * 100;
  const since = `since ${formatDay(base.weighed_on)} (${days} days)`;
  if (Math.abs(pct) < 3) return `Steady: ${name} is within ${Math.abs(pct).toFixed(1)}% ${since}. Keep checking: ribs easy to feel, waist visible from above, belly tucked up from the side.`;
  if (pct >= 10 || pct <= -10) return `${pct > 0 ? 'Up' : 'Down'} ${Math.abs(pct).toFixed(0)}% ${since}. That is a big change for a grown dog. Worth mentioning to your vet, especially if appetite or energy changed too.`;
  return `${pct > 0 ? 'Gaining' : 'Losing'} ${Math.abs(pct).toFixed(1)}% ${since}. ${pct > 0 ? 'Check the ribs: if they are getting hard to feel, trim treats or portions a little.' : 'If this was not planned, keep an eye on appetite and check the ribs and hip bones.'}`;
}

function WeightChart({ points, name }: { points: Weight[]; name: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const Wd = 700; const Ht = 260; const L = 52; const R = 18; const T = 16; const B = 34;
  if (points.length === 0) return null;
  const times = points.map((p) => toTime(p.weighed_on));
  const values = points.map((p) => Number(p.weight_lb));
  let t0 = Math.min(...times); let t1 = Math.max(...times);
  if (t1 - t0 < 14 * dayMs) { t0 -= 7 * dayMs; t1 += 7 * dayMs; }
  const ticks = niceTicks(Math.min(...values) - 1, Math.max(...values) + 1);
  const v0 = ticks[0]; const v1 = ticks[ticks.length - 1];
  const x = (t: number) => L + ((t - t0) / (t1 - t0)) * (Wd - L - R);
  const y = (v: number) => T + (1 - (v - v0) / (v1 - v0 || 1)) * (Ht - T - B);
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(times[i]).toFixed(1)} ${y(values[i]).toFixed(1)}`).join(' ');
  const area = `${line} L${x(times[times.length - 1]).toFixed(1)} ${Ht - B} L${x(times[0]).toFixed(1)} ${Ht - B} Z`;
  // About five date labels, evenly spaced in time.
  const spanDays = (t1 - t0) / dayMs;
  const dateTicks = Array.from({ length: 5 }, (_, i) => t0 + ((t1 - t0) * i) / 4);
  const fmt = (t: number) => new Date(t).toLocaleDateString(undefined, spanDays > 300 ? { month: 'short', year: '2-digit', timeZone: 'UTC' } : { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const first = points[0]; const last = points[points.length - 1];
  return (
    <svg className={styles.chart} viewBox={`0 0 ${Wd} ${Ht}`} role="img" aria-labelledby={`${uid}-t ${uid}-d`}>
      <title id={`${uid}-t`}>{`${name}’s weight over time`}</title>
      <desc id={`${uid}-d`}>{`${points.length} weigh-ins from ${formatDay(first.weighed_on)} (${lb(first.weight_lb)}) to ${formatDay(last.weighed_on)} (${lb(last.weight_lb)}). The full list is in the table below the chart.`}</desc>
      {ticks.map((v) => <g key={v}><line x1={L} x2={Wd - R} y1={y(v)} y2={y(v)} className={styles.grid} /><text x={L - 8} y={y(v) + 4} textAnchor="end" className={styles.axis}>{v}</text></g>)}
      {dateTicks.map((t, i) => <text key={i} x={x(t)} y={Ht - 10} textAnchor={i === 0 ? 'start' : i === 4 ? 'end' : 'middle'} className={styles.axis}>{fmt(t)}</text>)}
      {points.length > 1 && <path d={area} className={styles.area} />}
      {points.length > 1 && <path d={line} className={styles.line} />}
      {points.map((p, i) => <circle key={p.id} cx={x(times[i])} cy={y(values[i])} r={i === points.length - 1 ? 6 : points.length > 60 ? 2.5 : 4.5} className={`${styles.dot} ${i === points.length - 1 ? styles.dotLast : ''}`}><title>{`${formatDay(p.weighed_on)}: ${lb(values[i])}${p.note ? ` (${p.note})` : ''}`}</title></circle>)}
    </svg>
  );
}

function VisitsChart({ years, name }: { years: { year: number; count: number }[]; name: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  if (!years.length) return null;
  const Wd = 700; const Ht = 200; const B = 30; const T = 26;
  const max = Math.max(...years.map((y) => y.count), 1);
  const slot = (Wd - 20) / years.length;
  const barW = Math.min(70, slot * 0.6);
  return (
    <svg className={styles.chart} viewBox={`0 0 ${Wd} ${Ht}`} role="img" aria-labelledby={`${uid}-t ${uid}-d`}>
      <title id={`${uid}-t`}>{`${name}’s vet visits per year`}</title>
      <desc id={`${uid}-d`}>{years.map((y) => `${y.year}: ${y.count}`).join(', ')}</desc>
      {years.map((y, i) => {
        const h = (y.count / max) * (Ht - B - T);
        const cx = 10 + slot * i + slot / 2;
        return <g key={y.year}>
          <rect x={cx - barW / 2} y={Ht - B - h} width={barW} height={Math.max(h, 2)} rx="8" className={styles.bar} />
          <text x={cx} y={Ht - B - h - 7} textAnchor="middle" className={styles.barValue}>{y.count}</text>
          <text x={cx} y={Ht - 8} textAnchor="middle" className={styles.axis}>{y.year}</text>
        </g>;
      })}
      <line x1="10" x2={Wd - 10} y1={Ht - B + 0.5} y2={Ht - B + 0.5} className={styles.grid} />
    </svg>
  );
}

export function HealthCharts({ petId, dogName }: { petId?: string; dogName?: string }) {
  const { state, pets, pet, selected, setSelected, error: petError, reload: reloadPets } = useOwnerPets(petId);
  const [weights, setWeights] = useState<Weight[] | null>(null);
  const [visits, setVisits] = useState<string[]>([]);
  const [range, setRange] = useState<Range>('1y');
  const [draft, setDraft] = useState({ weighed_on: '', weight: '', note: '' });
  const [message, setMessage] = useState('');
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const name = pet?.name || dogName || 'Your dog';

  useEffect(() => { setDraft((d) => (d.weighed_on ? d : { ...d, weighed_on: todayIso() })); }, []);

  const load = useCallback(async () => {
    if (!supabase || !pet) return;
    const [w, v] = await Promise.all([
      supabase.from('pet_weights').select('id,pet_id,weighed_on,weight_lb,note').eq('pet_id', pet.id).order('weighed_on').order('created_at'),
      supabase.from('pet_health_records').select('given_on').eq('pet_id', pet.id).eq('kind', 'visit').not('given_on', 'is', null),
    ]);
    if (w.error) { if (isMissingRelation(w.error)) setMissing(true); else setMessage(w.error.message); setWeights([]); }
    else { setMissing(false); setWeights(((w.data || []) as Weight[]).map((r) => ({ ...r, weight_lb: Number(r.weight_lb) }))); }
    setVisits(v.error ? [] : ((v.data || []) as { given_on: string }[]).map((r) => r.given_on));
  }, [pet]);
  useEffect(() => { setWeights(null); void load(); }, [load]);

  const inRange = useMemo(() => {
    const list = weights || [];
    const days = RANGES.find((r) => r.key === range)?.days;
    if (!days || !list.length) return list;
    const cutoff = toTime(list[list.length - 1].weighed_on) - days * dayMs;
    return list.filter((p) => toTime(p.weighed_on) >= cutoff);
  }, [weights, range]);

  const visitYears = useMemo(() => {
    const counts = new Map<number, number>();
    for (const day of visits) { const y = Number(day.slice(0, 4)); if (y) counts.set(y, (counts.get(y) || 0) + 1); }
    if (!counts.size) return [];
    const ys = Array.from(counts.keys());
    const out: { year: number; count: number }[] = [];
    for (let y = Math.min(...ys); y <= Math.max(...ys); y += 1) out.push({ year: y, count: counts.get(y) || 0 });
    return out.slice(-10);
  }, [visits]);

  if (!supabase) return null;
  if (state === 'signedOut' || state === 'loading') return null;
  if (state === 'error') return <section className="panel wide"><p className="eyebrow">Health charts</p><p className="formHint">{petError}</p></section>;
  if (state === 'noPets' || !pet) return <section className="panel wide"><p className="eyebrow">Health charts</p><h2>Weight & vet visits</h2><p className="formHint">Add {dogName || 'your dog'} to your account to start a weight log.</p></section>;

  const list = weights || [];
  const last = list[list.length - 1];
  const prev = list[list.length - 2];
  const change = last && prev ? last.weight_lb - prev.weight_lb : null;
  const minW = list.length ? Math.min(...list.map((p) => p.weight_lb)) : 0;
  const maxW = list.length ? Math.max(...list.map((p) => p.weight_lb)) : 0;

  async function add(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase || !pet) return;
    const value = Number(draft.weight);
    if (!Number.isFinite(value) || value <= 0 || value >= 400) return setMessage('Enter a weight in pounds, like 52.4');
    if (!draft.weighed_on) return setMessage('Pick the date.');
    setBusy(true);
    const { data: auth } = await supabase.auth.getSession();
    const { error } = await supabase.from('pet_weights').insert({ pet_id: pet.id, owner_id: auth.session?.user.id, weighed_on: draft.weighed_on, weight_lb: Math.round(value * 100) / 100, note: draft.note.trim() || null });
    if (error) { setBusy(false); return setMessage(isMissingRelation(error) ? 'The weight log switches on after the latest database update.' : error.message); }
    // The newest weigh-in also becomes the profile weight (ID card, poster).
    let note = 'Weight saved.';
    if (!last || draft.weighed_on >= last.weighed_on) {
      const fresh = await supabase.from('pets').select('profile').eq('id', pet.id).maybeSingle();
      const profile = ((fresh.data as { profile?: Record<string, any> } | null)?.profile) || {};
      const { error: profileError } = await supabase.from('pets').update({ profile: { ...profile, details: { ...(profile.details || {}), weight_lb: Math.round(value * 10) / 10 } } }).eq('id', pet.id);
      if (!profileError) { note = 'Weight saved and the profile weight updated.'; void reloadPets(); }
    }
    setBusy(false);
    setMessage(note);
    setDraft({ weighed_on: todayIso(), weight: '', note: '' });
    await load();
  }

  async function remove(w: Weight) {
    if (!supabase || !window.confirm(`Delete the ${lb(w.weight_lb)} weigh-in from ${formatDay(w.weighed_on)}?`)) return;
    const { error } = await supabase.from('pet_weights').delete().eq('id', w.id);
    if (error) return setMessage(error.message);
    setMessage('Weigh-in deleted.');
    await load();
  }

  return (
    <section className="panel wide">
      <div className="panelTitleRow">
        <div><p className="eyebrow">Health charts</p><h2>{name}’s weight</h2></div>
        {pets.length > 1 && !petId && <select value={selected} onChange={(e) => setSelected(e.target.value)} aria-label="Choose dog" style={{ width: 'auto' }}>{pets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>}
      </div>
      {missing && <p className="formHint">The weight log switches on after the latest database update.</p>}
      {message && <p className="authMessage" role="status">{message}</p>}

      {!missing && <div className={styles.wrap}>
        {list.length > 0 && <div className={styles.stats}>
          <div><small>Latest</small><strong>{lb(last.weight_lb)}</strong><span className="formHint">{formatDay(last.weighed_on)}</span></div>
          <div><small>Change</small><strong className={change === null ? styles.flat : change > 0.05 ? styles.up : change < -0.05 ? styles.down : styles.flat}>{change === null ? '—' : `${change > 0 ? '+' : ''}${change.toFixed(1)} lb`}</strong><span className="formHint">{prev ? `vs ${formatDay(prev.weighed_on)}` : 'first entry'}</span></div>
          <div><small>Range</small><strong>{list.length > 1 ? `${Number(minW.toFixed(1))}–${Number(maxW.toFixed(1))}` : '—'}</strong><span className="formHint">{list.length} weigh-in{list.length === 1 ? '' : 's'}</span></div>
        </div>}

        {list.length > 0 && <>
          <div className={styles.tabs} role="tablist" aria-label="Chart range">{RANGES.map((r) => <button key={r.key} type="button" role="tab" aria-selected={range === r.key} className={range === r.key ? styles.active : ''} onClick={() => setRange(r.key)}>{r.label}</button>)}</div>
          <WeightChart points={inRange} name={name} />
        </>}
        <p className={styles.condition}><strong>Body condition: </strong>{conditionNote(list, name)}</p>

        <form className={styles.form} onSubmit={add}>
          <label>Date<input type="date" value={draft.weighed_on} max={todayIso()} onChange={(e) => setDraft({ ...draft, weighed_on: e.target.value })} required /></label>
          <label>Weight (lb)<input inputMode="decimal" value={draft.weight} onChange={(e) => setDraft({ ...draft, weight: e.target.value.replace(/[^\d.]/g, '') })} placeholder={last ? String(last.weight_lb) : '52.4'} required /></label>
          <label className={styles.noteField}>Note (optional)<input value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} maxLength={300} placeholder="Vet scale, after a walk…" /></label>
          <button className="primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Add weight'}</button>
        </form>

        {list.length > 0 && <details className={styles.details}>
          <summary>All weigh-ins ({list.length})</summary>
          <div className={styles.scroll}>
            <table className={styles.table}>
              <caption className="formHint" style={{ textAlign: 'left', marginBottom: 6 }}>{name}’s weight log, newest first</caption>
              <thead><tr><th scope="col">Date</th><th scope="col">Weight</th><th scope="col">Change</th><th scope="col">Note</th><th scope="col"><span className={styles.srOnly}>Actions</span></th></tr></thead>
              <tbody>{[...list].reverse().map((w, i, arr) => {
                const before = arr[i + 1];
                const diff = before ? w.weight_lb - before.weight_lb : null;
                return <tr key={w.id}><td>{formatDay(w.weighed_on)}</td><td>{lb(w.weight_lb)}</td><td>{diff === null ? '—' : `${diff > 0 ? '+' : ''}${diff.toFixed(1)}`}</td><td>{w.note || ''}</td><td><button type="button" className={styles.danger} onClick={() => remove(w)} aria-label={`Delete ${formatDay(w.weighed_on)}`}>Delete</button></td></tr>;
              })}</tbody>
            </table>
          </div>
        </details>}

        {visitYears.length > 0 && <div>
          <p className={styles.sectionHead}>Vet visits per year</p>
          <VisitsChart years={visitYears} name={name} />
          <details className={styles.details}>
            <summary>Visits table</summary>
            <table className={styles.table}><thead><tr><th scope="col">Year</th><th scope="col">Visits</th></tr></thead><tbody>{visitYears.map((y) => <tr key={y.year}><td>{y.year}</td><td>{y.count}</td></tr>)}</tbody></table>
          </details>
        </div>}
      </div>}
    </section>
  );
}
