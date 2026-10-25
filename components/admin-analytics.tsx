'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import { supabase } from '../lib/supabase';
import { Activity, Bell, FileText, Lock, MapPinned, PawPrint, ShieldCheck, Sparkles, Trophy, User, Users } from './icons';
import { friendlyRpcError } from './admin-support';
import styles from './admin-support.module.css';

type Json = Record<string, unknown>;
type DayCount = { day: string; n: number };
type NamedCount = { label: string; n: number };

type Stats = {
  accounts: number; verified: number; pets: number; guest_pets: number; lost_now: number;
  tags_claimed: number; tags_unclaimed: number; scans_30d: number; found_reports_30d: number;
  saved_walks: number; walk_miles: number; pins: number; messages_30d: number; meetups_upcoming: number; pack_links: number;
  tiers: NamedCount[]; status_tags: NamedCount[]; card_states: NamedCount[]; top_breeds: NamedCount[];
  signups_by_day: DayCount[]; scans_by_day: DayCount[];
};

function isJson(value: unknown): value is Json {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function num(value: unknown): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(n) ? n : 0;
}

function namedFromMap(value: unknown): NamedCount[] {
  if (!isJson(value)) return [];
  return Object.entries(value).map(([label, n]) => ({ label: label || 'none', n: num(n) })).filter((row) => row.n > 0).sort((a, b) => b.n - a.n);
}

function namedFromRows(value: unknown, key: string): NamedCount[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isJson).map((row) => ({ label: String(row[key] ?? '') || 'Unknown', n: num(row.n) })).filter((row) => row.n > 0).sort((a, b) => b.n - a.n);
}

function dayRows(value: unknown): DayCount[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isJson).map((row) => ({ day: String(row.day ?? '').slice(0, 10), n: num(row.n) })).filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.day));
}

function normalize(raw: unknown): Stats | null {
  if (!isJson(raw)) return null;
  return {
    accounts: num(raw.accounts), verified: num(raw.verified), pets: num(raw.pets), guest_pets: num(raw.guest_pets), lost_now: num(raw.lost_now),
    tags_claimed: num(raw.tags_claimed), tags_unclaimed: num(raw.tags_unclaimed), scans_30d: num(raw.scans_30d), found_reports_30d: num(raw.found_reports_30d),
    saved_walks: num(raw.saved_walks), walk_miles: num(raw.walk_miles), pins: num(raw.pins), messages_30d: num(raw.messages_30d),
    meetups_upcoming: num(raw.meetups_upcoming), pack_links: num(raw.pack_links),
    tiers: namedFromMap(raw.tiers), status_tags: namedFromMap(raw.status_tags), card_states: namedFromMap(raw.card_states),
    top_breeds: namedFromRows(raw.top_breeds, 'breed'),
    signups_by_day: dayRows(raw.signups_by_day), scans_by_day: dayRows(raw.scans_by_day),
  };
}

// Last 30 UTC days ending today, missing days filled with 0.
function fillDays(rows: DayCount[], days = 30): DayCount[] {
  const map = new Map<string, number>();
  rows.forEach((row) => map.set(row.day, (map.get(row.day) || 0) + row.n));
  const today = new Date();
  const base = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const out: DayCount[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = new Date(base - i * 86_400_000).toISOString().slice(0, 10);
    out.push({ day, n: map.get(day) || 0 });
  }
  return out;
}

const fmt = (n: number, digits = 0) => n.toLocaleString(undefined, { maximumFractionDigits: digits });

function shortDay(day: string) {
  const date = new Date(`${day}T00:00:00Z`);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

type IconType = ComponentType<{ className?: string }>;

function Tile({ label, value, sub, icon: Icon, alert }: { label: string; value: string; sub?: string; icon: IconType; alert?: boolean }) {
  return (
    <div className={`${styles.tile} ${alert ? styles.tileAlert : ''}`}>
      <span className={styles.tileTop}>{label}<Icon /></span>
      <span className={styles.tileValue}>{value}</span>
      {sub && <span className={styles.tileSub}>{sub}</span>}
    </div>
  );
}

function DayChart({ title, rows, alt }: { title: string; rows: DayCount[]; alt?: boolean }) {
  const total = rows.reduce((sum, row) => sum + row.n, 0);
  const max = Math.max(1, ...rows.map((row) => row.n));
  const width = 300;
  const height = 100;
  const gap = 2;
  const barWidth = rows.length ? (width - gap * (rows.length - 1)) / rows.length : 0;
  return (
    <div className={styles.chartBox}>
      <h3>{title}<small>{fmt(total)} in 30 days</small></h3>
      <svg className={styles.chartSvg} viewBox={`0 0 ${width} ${height + 2}`} preserveAspectRatio="none" role="img" aria-label={`${title}: ${fmt(total)} total over the last 30 days`}>
        {rows.map((row, index) => {
          const h = row.n ? Math.max(2, (row.n / max) * height) : 0;
          return (
            <rect key={row.day} className={alt ? styles.chartBarAlt : styles.chartBar} x={index * (barWidth + gap)} y={height - h} width={barWidth} height={h} rx={1.5}>
              <title>{`${shortDay(row.day)}: ${row.n}`}</title>
            </rect>
          );
        })}
        <line className={styles.chartAxis} x1={0} x2={width} y1={height + 1} y2={height + 1} />
      </svg>
      <div className={styles.chartLabels}>
        <span>{rows[0] ? shortDay(rows[0].day) : ''}</span>
        <span>peak {fmt(max === 1 && total === 0 ? 0 : max)}/day</span>
        <span>{rows.length ? shortDay(rows[rows.length - 1].day) : ''}</span>
      </div>
    </div>
  );
}

function HBars({ title, rows, empty, limit = 8 }: { title: string; rows: NamedCount[]; empty: string; limit?: number }) {
  const shown = rows.slice(0, limit);
  const max = Math.max(1, ...shown.map((row) => row.n));
  return (
    <div className={styles.chartBox}>
      <h3>{title}<small>{rows.length ? `${rows.length} total` : ''}</small></h3>
      {shown.length === 0 ? <p className="mutedLine" style={{ margin: 0 }}>{empty}</p> : (
        <ul className={styles.hbars}>
          {shown.map((row) => (
            <li key={row.label} className={styles.hbar}>
              <span className={styles.hbarLabel}><span>{row.label.replace(/_/g, ' ')}</span><span>{fmt(row.n)}</span></span>
              <span className={styles.hbarTrack}><span className={styles.hbarFill} style={{ display: 'block', width: `${(row.n / max) * 100}%` }} /></span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AdminAnalytics() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState<string>('');
  const seq = useRef(0);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    if (!supabase) { setLoading(false); setError('Supabase is not configured on this site.'); return; }
    setLoading(true);
    setError('');
    const { data, error: rpcError } = await supabase.rpc('admin_stats');
    if (mine !== seq.current) return;
    setLoading(false);
    if (rpcError) { setError(friendlyRpcError(rpcError, 'Could not load analytics.')); return; }
    const normalized = normalize(data);
    if (!normalized) { setError('Analytics came back empty.'); return; }
    setStats(normalized);
    setUpdatedAt(new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }));
  }, []);

  useEffect(() => { void load(); }, [load]);

  const signups = useMemo(() => fillDays(stats?.signups_by_day || []), [stats]);
  const scans = useMemo(() => fillDays(stats?.scans_by_day || []), [stats]);

  const verifiedPct = stats && stats.accounts ? Math.round((stats.verified / stats.accounts) * 100) : 0;
  const tagTotal = stats ? stats.tags_claimed + stats.tags_unclaimed : 0;

  return (
    <section className="panel wide">
      <div className="panelTitleRow">
        <div>
          <p className="eyebrow"><Activity /> Analytics</p>
          <h2>How MyPetID is doing</h2>
          {updatedAt && <p className="formHint">Updated {updatedAt}</p>}
        </div>
        <button type="button" onClick={() => void load()} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
      </div>

      {error && <p className="notice">{error}</p>}
      {loading && !stats && !error && <p className="mutedLine">Crunching the numbers…</p>}

      {stats && (
        <div style={{ display: 'grid', gap: 14 }}>
          <div className={styles.tiles}>
            <Tile label="Accounts" value={fmt(stats.accounts)} icon={Users} />
            <Tile label="Verified" value={`${verifiedPct}%`} sub={`${fmt(stats.verified)} of ${fmt(stats.accounts)}`} icon={ShieldCheck} />
            <Tile label="Dogs" value={fmt(stats.pets)} icon={PawPrint} />
            <Tile label="Guest dogs" value={fmt(stats.guest_pets)} icon={User} />
            <Tile label="Lost now" value={fmt(stats.lost_now)} icon={Bell} alert={stats.lost_now > 0} />
            <Tile label="Tags claimed" value={fmt(stats.tags_claimed)} sub={tagTotal ? `${Math.round((stats.tags_claimed / tagTotal) * 100)}% of ${fmt(tagTotal)}` : 'No tags yet'} icon={Lock} />
            <Tile label="Tags unclaimed" value={fmt(stats.tags_unclaimed)} icon={FileText} />
            <Tile label="Scans · 30d" value={fmt(stats.scans_30d)} icon={MapPinned} />
            <Tile label="Found reports · 30d" value={fmt(stats.found_reports_30d)} icon={Trophy} />
            <Tile label="Saved walks" value={fmt(stats.saved_walks)} icon={Activity} />
            <Tile label="Walk miles" value={fmt(stats.walk_miles, 1)} icon={MapPinned} />
            <Tile label="Pins" value={fmt(stats.pins)} icon={MapPinned} />
            <Tile label="Messages · 30d" value={fmt(stats.messages_30d)} icon={Bell} />
            <Tile label="Upcoming meetups" value={fmt(stats.meetups_upcoming)} icon={Sparkles} />
            <Tile label="Pack friendships" value={fmt(stats.pack_links)} icon={Users} />
          </div>

          <div className={styles.chartGrid}>
            <DayChart title="Sign-ups by day" rows={signups} />
            <DayChart title="Scans by day" rows={scans} alt />
          </div>

          <div className={styles.chartGrid}>
            <HBars title="Top breeds" rows={stats.top_breeds} empty="No breeds recorded yet." />
            <HBars title="Plans" rows={stats.tiers} empty="No accounts yet." />
            <HBars title="Status tags" rows={stats.status_tags} empty="No status tags set yet." limit={11} />
            <HBars title="Card states" rows={stats.card_states} empty="No ID cards started yet." />
          </div>
        </div>
      )}
    </section>
  );
}
