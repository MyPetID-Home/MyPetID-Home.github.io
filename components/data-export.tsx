"use client";

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { FileText } from './icons';
import styles from './data-export.module.css';

/**
 * "Download my data": everything the signed-in user OWNS, read in the browser through RLS.
 * Every query is filtered to the user's own id / own pet ids explicitly (admins can read other
 * accounts through RLS, so relying on RLS alone would leak), and columns that hold other people's
 * data or secrets are left out (scanner ids, finder contact details, claim-code hashes, invite
 * hashes, messages received from others).
 *
 * JSON: a single file download. PDF: a print-only report portal + window.print(), so the
 * browser's "Save as PDF" produces the file (no extra dependencies).
 */

type Row = Record<string, any>;
export type MyPetIdExport = {
  format: 'mypetid-export';
  version: 1;
  exported_at: string;
  account: { id: string; email: string | null; created_at: string | null; last_sign_in_at: string | null };
  profile: Row | null;
  pets: Row[];
  tags: Row[];
  scans: Row[];
  documents: Row[];
  care_events: Row[];
  health_records: Row[];
  weights: Row[];
  walks: Row[];
  saved_walks: Row[];
  calendar_events: Row[];
  training: Row[];
  awards: Row[];
  xp_events: Row[];
  map_pins: Row[];
  notifications: Row[];
  pack_friends: Row[];
  pack_messages_sent: Row[];
  meetups_hosted: Row[];
  household: Row[];
  membership: { grants: Row[]; events: Row[]; tag_orders: Row[] };
  skipped: string[];
};

const SECTIONS: [keyof MyPetIdExport, string][] = [
  ['pets', 'Dogs (profile, ID details, care schedule)'], ['tags', 'Tags'], ['scans', 'Tag scans'], ['documents', 'Documents'],
  ['health_records', 'Health records'], ['weights', 'Weights'], ['care_events', 'Care events'], ['walks', 'Walks'],
  ['saved_walks', 'Saved routes'], ['calendar_events', 'Calendar'], ['training', 'Training'], ['awards', 'Awards'],
  ['notifications', 'Notifications'], ['pack_friends', 'Dog Pack friends'], ['pack_messages_sent', 'Messages you sent'],
  ['meetups_hosted', 'Meetups you hosted'], ['household', 'Household members'], ['map_pins', 'Map pins'],
];

/** Reads everything the signed-in user owns. Missing tables are skipped and listed in `skipped`. */
export async function gatherMyData(): Promise<MyPetIdExport> {
  if (!supabase) throw new Error('MyPetID cloud is not configured on this site.');
  const sb = supabase;
  const { data: auth, error: authError } = await sb.auth.getUser();
  if (authError || !auth.user) throw new Error('Sign in to download your data.');
  const me = auth.user.id;
  const skipped: string[] = [];

  async function rows(label: string, run: () => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<Row[]> {
    try {
      const { data, error } = await run();
      if (error) { skipped.push(`${label}: ${error.message}`); return []; }
      return Array.isArray(data) ? (data as Row[]) : data ? [data as Row] : [];
    } catch (error) {
      skipped.push(`${label}: ${error instanceof Error ? error.message : 'failed'}`);
      return [];
    }
  }

  const [profileRows, pets] = await Promise.all([
    rows('profile', () => sb.from('profiles').select('*').eq('id', me).maybeSingle()),
    rows('pets', () => sb.from('pets').select('*').eq('owner_id', me).order('created_at')),
  ]);
  const petIds = pets.map((p) => p.id as string);
  const anyPets = petIds.length > 0;
  const none = async () => ({ data: [] as Row[], error: null });

  const [
    tags, scans, documents, careEvents, health, weights, walks, savedWalks, calendar, training, awards, xp, pins,
    notifications, friends, sent, meetups, household, grants, events, orders,
  ] = await Promise.all([
    rows('tags', () => anyPets
      ? sb.from('tags').select('id,tag_code,pet_id,status,claimed_at,created_at,nfc_uid').or(`created_by.eq.${me},pet_id.in.(${petIds.join(',')})`)
      : sb.from('tags').select('id,tag_code,pet_id,status,claimed_at,created_at,nfc_uid').eq('created_by', me)),
    rows('scans', () => anyPets
      ? sb.from('scan_events').select('id,tag_id,pet_id,actor,latitude,longitude,accuracy_meters,note,reported_lost,found_status,finder_note,owner_follow_up,owner_resolution_note,resolved_at,created_at').in('pet_id', petIds).order('created_at', { ascending: false }).limit(2000)
      : none()),
    rows('documents', () => sb.from('pet_documents').select('*').eq('owner_id', me).order('created_at')),
    rows('care events', () => sb.from('pet_care_events').select('*').eq('owner_id', me).order('created_at')),
    rows('health records', () => sb.from('pet_health_records').select('*').eq('owner_id', me).order('given_on', { ascending: false })),
    rows('weights', () => sb.from('pet_weights').select('*').eq('owner_id', me).order('weighed_on')),
    rows('walks', () => sb.from('walk_sessions').select('*').eq('profile_id', me).order('started_at', { ascending: false }).limit(5000)),
    rows('saved walks', () => sb.from('saved_walks').select('*').eq('profile_id', me)),
    rows('calendar', () => sb.from('calendar_events').select('*').eq('profile_id', me)),
    rows('training', () => anyPets ? sb.from('training_commands').select('*').in('pet_id', petIds) : none()),
    rows('awards', () => sb.from('pet_awards').select('*').eq('profile_id', me)),
    rows('xp events', () => sb.from('xp_events').select('*').eq('profile_id', me).limit(5000)),
    rows('map pins', () => sb.from('map_pins').select('*').eq('profile_id', me)),
    rows('notifications', () => sb.from('notifications').select('*').eq('profile_id', me).order('created_at', { ascending: false }).limit(2000)),
    rows('pack friends', () => sb.rpc('pack_friends')),
    rows('messages sent', () => sb.from('pack_messages').select('id,body,created_at').eq('sender_id', me).order('created_at').limit(5000)),
    rows('meetups hosted', () => sb.from('meetups').select('*').eq('host_id', me)),
    rows('household', () => sb.from('pet_household_members').select('id,pet_id,role,status,invited_email,created_at,accepted_at').eq('owner_id', me)),
    rows('membership grants', () => sb.from('membership_grants').select('tier,status,source,starts_at,expires_at,created_at').eq('profile_id', me)),
    rows('membership events', () => sb.from('membership_events').select('provider,tier,status,created_at,updated_at').eq('profile_id', me)),
    rows('tag orders', () => sb.from('tag_orders').select('id,pet_id,status,amount_cents,currency,ship_to,created_at').eq('profile_id', me)),
  ]);

  // Friends: their public first name + dog only; no ids.
  const packFriends = friends.map((f) => ({ name: f.name, dog_name: f.dog_name, since: f.since }));

  return {
    format: 'mypetid-export',
    version: 1,
    exported_at: new Date().toISOString(),
    account: { id: me, email: auth.user.email || null, created_at: auth.user.created_at || null, last_sign_in_at: auth.user.last_sign_in_at || null },
    profile: profileRows[0] || null,
    pets, tags, scans, documents, care_events: careEvents, health_records: health, weights, walks, saved_walks: savedWalks,
    calendar_events: calendar, training, awards, xp_events: xp, map_pins: pins, notifications, pack_friends: packFriends,
    pack_messages_sent: sent, meetups_hosted: meetups, household,
    membership: { grants, events, tag_orders: orders },
    skipped,
  };
}

function stamp() { return new Date().toISOString().slice(0, 10); }
function fileSafe(text: string) { return text.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'mypetid'; }

function download(name: string, text: string) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function fmtDate(value: unknown) {
  if (!value) return '';
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
function text(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return Array.isArray(value) ? value.map(text).filter(Boolean).join(', ') : '';
  return String(value);
}

function Facts({ items }: { items: [string, unknown][] }) {
  const shown = items.filter(([, v]) => text(v));
  if (!shown.length) return null;
  return <dl className={styles.facts}>{shown.map(([k, v]) => <div key={k} style={{ display: 'contents' }}><dt>{k}</dt><dd>{text(v)}</dd></div>)}</dl>;
}

function PrintReport({ data, previews }: { data: MyPetIdExport; previews: Record<string, string> }) {
  const p = data.profile || {};
  const name = text(p.display_name) || data.account.email || 'MyPetID member';
  return (
    <div className={styles.report}>
      <div className={styles.reportHead}>
        <div><h1>MyPetID records</h1><p>{name}{p.account_number ? ` - account #${p.account_number}` : ''}</p></div>
        <p className={styles.muted}>Exported {new Date(data.exported_at).toLocaleString()}</p>
      </div>

      <h2>Account</h2>
      <Facts items={[['Name', p.display_name], ['Email', data.account.email], ['Phone', p.phone], ['Member since', fmtDate(data.account.created_at)], ['Dogs', data.pets.length], ['Tags', data.tags.length], ['Walks', data.walks.length]]} />

      {data.pets.map((pet) => {
        const prof = (pet.profile || {}) as Row; const d = (prof.details || {}) as Row; const vet = (prof.vet || {}) as Row;
        const tags = data.tags.filter((t) => t.pet_id === pet.id);
        const health = data.health_records.filter((r) => r.pet_id === pet.id);
        const weights = data.weights.filter((r) => r.pet_id === pet.id);
        const docs = data.documents.filter((r) => r.pet_id === pet.id);
        const scans = data.scans.filter((r) => r.pet_id === pet.id).slice(0, 25);
        const walks = data.walks.filter((r) => r.pet_id === pet.id);
        const care = Array.isArray(prof.care_schedule) ? (prof.care_schedule as Row[]) : [];
        const photos = [pet.photo_url, pet.cover_url].filter(Boolean) as string[];
        const docImages = docs.filter((x) => previews[x.id]);
        const distance = walks.reduce((sum, w) => sum + (Number(w.distance_m) || 0), 0);
        return (
          <section key={pet.id} className={styles.pet}>
            <h2>{pet.name}</h2>
            <div className={styles.petTop}>
              {photos[0] && <img className={styles.photo} src={photos[0]} alt={pet.name} />}
              <Facts items={[
                ['Species', pet.species], ['Breed', pet.breed], ['Sex', d.sex], ['Spayed / neutered', d.fixed], ['Birthday', d.birthday ? fmtDate(d.birthday) : ''],
                ['Weight', d.weight_lb ? `${d.weight_lb} lb` : ''], ['Height', d.height_in ? `${d.height_in} in` : ''], ['Coat / colors', [d.coat, d.colors].filter(Boolean).join(', ')], ['Eyes', d.eyes],
                ['Microchip', d.microchip], ['Rabies tag', d.rabies_tag], ['Tags', tags.map((t) => t.tag_code)], ['Vet', [vet.clinic, vet.phone].filter(Boolean).join(' - ')],
                ['Medical notes', pet.medical_public], ['Behavior', pet.behavior_public], ['Feeding', pet.feeding_plan], ['Care notes', pet.care_notes],
              ]} />
            </div>
            {photos.length > 1 && <div className={styles.gallery}>{photos.slice(1).map((src) => <img key={src} src={src} alt="" />)}</div>}
            {docImages.length > 0 && <div className={styles.gallery}>{docImages.map((x) => <img key={x.id} src={previews[x.id]} alt={x.title} />)}</div>}

            {care.length > 0 && <div className={styles.section}><h3>Care schedule</h3><table><thead><tr><th>Item</th><th>When</th><th>Notes</th></tr></thead><tbody>{care.map((c, i) => <tr key={i}><td>{text(c.title || c.label || c.kind)}</td><td>{text(c.times || c.time || c.repeat)}</td><td>{text(c.notes || c.dose)}</td></tr>)}</tbody></table></div>}

            {health.length > 0 && <div className={styles.section}><h3>Health records</h3><table><thead><tr><th>Type</th><th>Record</th><th>Given</th><th>Due</th><th>Clinic</th><th>Notes</th></tr></thead><tbody>{health.map((r) => <tr key={r.id}><td>{text(r.kind)}</td><td>{text(r.title)}</td><td>{fmtDate(r.given_on)}</td><td>{fmtDate(r.due_on)}</td><td>{text(r.clinic)}</td><td>{text(r.notes)}</td></tr>)}</tbody></table></div>}

            {weights.length > 0 && <div className={styles.section}><h3>Weights</h3><table><thead><tr><th>Date</th><th>Weight</th><th>Note</th></tr></thead><tbody>{weights.map((r) => <tr key={r.id}><td>{fmtDate(r.weighed_on)}</td><td>{text(r.weight_lb)} lb</td><td>{text(r.note)}</td></tr>)}</tbody></table></div>}

            {docs.length > 0 && <div className={styles.section}><h3>Documents</h3><table><thead><tr><th>Title</th><th>Type</th><th>Added</th><th>Expires</th></tr></thead><tbody>{docs.map((r) => <tr key={r.id}><td>{text(r.title)}</td><td>{text(r.document_type)}</td><td>{fmtDate(r.created_at)}</td><td>{fmtDate(r.expires_at)}</td></tr>)}</tbody></table></div>}

            {scans.length > 0 && <div className={styles.section}><h3>Recent tag scans</h3><table><thead><tr><th>When</th><th>Status</th><th>Approx. location</th><th>Note</th></tr></thead><tbody>{scans.map((r) => <tr key={r.id}><td>{new Date(r.created_at).toLocaleString()}</td><td>{text(r.found_status) || (r.reported_lost ? 'lost report' : 'scan')}</td><td>{r.latitude != null ? `${Number(r.latitude).toFixed(3)}, ${Number(r.longitude).toFixed(3)}` : ''}</td><td>{text(r.finder_note || r.note)}</td></tr>)}</tbody></table></div>}

            {walks.length > 0 && <p className={styles.muted}>{walks.length} recorded walks, {(distance / 1609.34).toFixed(1)} miles total.</p>}
          </section>
        );
      })}

      <p className={styles.muted} style={{ marginTop: '18pt' }}>Generated by MyPetID. The JSON download contains the complete export, including walks, notifications and Dog Pack data.</p>
    </div>
  );
}

const PRINT_ROOT_ID = 'mypetid-print-root';
const PRINT_CSS = `@media screen { #${PRINT_ROOT_ID} { display: none !important; } }
@media print {
  body > *:not(#${PRINT_ROOT_ID}) { display: none !important; }
  #${PRINT_ROOT_ID} { display: block !important; }
  html, body { background: #fff !important; color: #111 !important; }
  @page { margin: 14mm 12mm; }
}`;

async function imagesReady(root: HTMLElement, timeoutMs = 6000) {
  const imgs = Array.from(root.querySelectorAll('img'));
  await Promise.race([
    Promise.all(imgs.map((img) => (img.complete ? Promise.resolve() : new Promise<void>((resolve) => { img.onload = () => resolve(); img.onerror = () => resolve(); })))),
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

export function DataExport({ compact = false }: { compact?: boolean }) {
  const [busy, setBusy] = useState<'' | 'json' | 'pdf'>('');
  const [message, setMessage] = useState('');
  const [report, setReport] = useState<MyPetIdExport | null>(null);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [counts, setCounts] = useState<[string, number][]>([]);
  const portal = useRef<HTMLDivElement | null>(null);

  useEffect(() => () => { portal.current?.remove(); portal.current = null; }, []);

  async function collect() {
    const data = await gatherMyData();
    setCounts(SECTIONS.map(([key, label]) => [label, Array.isArray(data[key]) ? (data[key] as Row[]).length : 0] as [string, number]).filter(([, n]) => n > 0));
    return data;
  }

  async function downloadJson() {
    setBusy('json'); setMessage('Gathering your data...');
    try {
      const data = await collect();
      const who = fileSafe(String(data.profile?.display_name || data.account.email?.split('@')[0] || 'account'));
      download(`mypetid-export-${who}-${stamp()}.json`, JSON.stringify(data, null, 2));
      setMessage('Your data was downloaded as a JSON file.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Export failed.');
    } finally { setBusy(''); }
  }

  async function downloadPdf() {
    setBusy('pdf'); setMessage('Building your printable report...');
    try {
      const data = await collect();
      if (!portal.current) {
        const el = document.createElement('div');
        el.id = PRINT_ROOT_ID;
        document.body.appendChild(el);
        portal.current = el;
      }
      // Document images live in the private medical-documents bucket: short-lived signed URLs, PDF only.
      const images = data.documents.filter((d) => d.document_type === 'image' && d.storage_path).slice(0, 40);
      const signed: Record<string, string> = {};
      if (supabase && images.length) {
        const { data: urls } = await supabase.storage.from('medical-documents').createSignedUrls(images.map((d) => String(d.storage_path)), 600);
        (urls || []).forEach((u, i) => { if (u.signedUrl) signed[images[i].id] = u.signedUrl; });
      }
      setPreviews(signed);
      setReport(data);
      // Let React render the portal, then wait for the dog photos.
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await imagesReady(portal.current);
      const previousTitle = document.title;
      const who = String(data.profile?.display_name || data.pets[0]?.name || 'MyPetID');
      document.title = `MyPetID records - ${who} - ${stamp()}`;
      const restore = () => { document.title = previousTitle; window.removeEventListener('afterprint', restore); };
      window.addEventListener('afterprint', restore);
      setMessage('In the print window choose "Save as PDF" as the destination.');
      window.print();
      setTimeout(restore, 1500);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Export failed.');
    } finally { setBusy(''); }
  }

  const body = (
    <div className={styles.wrap}>
      {!compact && (
        <>
          <p>Download a copy of everything in your MyPetID account: your profile, dogs (with ID details and care schedule), tags, scans, documents, health records and weights, walks, Dog Pack friends and notifications.</p>
          <p className="formHint">Only your own data is included. Other people&apos;s private details (who scanned a tag, finders&apos; contact info, messages others sent you) are left out.</p>
        </>
      )}
      <div className="actions">
        <button type="button" className="button primary" onClick={downloadJson} disabled={Boolean(busy)}>{busy === 'json' ? 'Preparing...' : 'Download JSON'}</button>
        <button type="button" className="button" onClick={downloadPdf} disabled={Boolean(busy)}>{busy === 'pdf' ? 'Preparing...' : 'Download PDF'}</button>
      </div>
      {message && <p className="authMessage" role="status">{message}</p>}
      {counts.length > 0 && <div className={styles.counts}>{counts.map(([label, n]) => <span key={label} className={styles.count}>{label}: {n}</span>)}</div>}
      {report && portal.current && createPortal(<><style>{PRINT_CSS}</style><PrintReport data={report} previews={previews} /></>, portal.current)}
    </div>
  );

  if (compact) return body;
  return (
    <section className="panel full">
      <div className="panelTitleRow"><div><p className="eyebrow">Your data</p><h2>Download my data</h2></div><span className="iconBubble blue"><FileText /></span></div>
      {body}
    </section>
  );
}
