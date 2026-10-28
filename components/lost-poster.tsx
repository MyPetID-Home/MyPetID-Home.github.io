"use client";

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../lib/supabase';
import { PUBLIC_APP_URL } from '../lib/public-url';
import { statusTag, TAG_COLORS } from '../lib/id-card';
import { useOwnerPets, type OwnerPet } from '../lib/owner-pets';
import { downloadBlob, safeFileName, svgToPngBlob, urlToDataUrl } from '../lib/svg-raster';
import styles from './lost-poster.module.css';

/**
 * A printable LOST DOG poster built from the cloud profile: photo, name, breed, sex, color,
 * weight, status tags, the public medical note, the public contact phone, last seen place/time
 * (from the latest scan or found report), an optional reward and a QR to the public page.
 * The owner's home address is never read here, so it can never end up on the poster.
 * Drawn as one SVG (Letter, 8.5 x 11 at 100 units per inch) so print, PNG and screen match.
 */

const W = 850;
const H = 1100;
const SANS = 'Arial, Helvetica, sans-serif';
const PRINT_ID = 'mypetid-lost-poster-print';

type Scan = { created_at: string; latitude: number | null; longitude: number | null; reported_lost: boolean | null; finder_note: string | null };

export type PosterData = {
  name: string;
  photo: string;
  breed: string;
  sex: string;
  color: string;
  weight: string;
  tags: string[];
  medical: string;
  phone: string;
  place: string;
  seenAt: string;
  reward: string;
  url: string;
};

/** Greedy word wrap by an approximate character budget; the last line gets an ellipsis if cut. */
function wrap(text: string, maxChars: number, maxLines: number) {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= maxChars) { line = next; continue; }
    if (line) lines.push(line);
    line = word.length > maxChars ? `${word.slice(0, maxChars - 1)}-` : word;
    if (lines.length === maxLines) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length === maxLines && lines.join(' ').length < words.join(' ').length) {
    const last = lines[maxLines - 1];
    lines[maxLines - 1] = `${last.slice(0, Math.max(0, maxChars - 3)).replace(/\s+\S*$/, '')}...`;
  }
  return lines;
}

/** Font size that fits `text` in `width` for a bold sans face (about 0.62em per character). */
function fitSize(text: string, width: number, max: number, min = 20) {
  if (!text) return max;
  return Math.max(min, Math.min(max, width / (text.length * 0.62)));
}

function formatSeen(iso: string) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** Local datetime-local value ('YYYY-MM-DDTHH:MM') from an ISO instant. */
function toLocalInput(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function PosterSvg({ data, id, className }: { data: PosterData; id?: string; className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const clip = `poster-photo-${uid}`;
  const tags = data.tags.map(statusTag).filter((t): t is NonNullable<ReturnType<typeof statusTag>> => Boolean(t));
  const facts = [data.breed, data.sex, data.color, data.weight].filter(Boolean).join('  |  ');
  const medical = data.medical ? wrap(`Medical: ${data.medical}`, 62, 2) : [];
  const seen = [data.place && `near ${data.place}`, data.seenAt && formatSeen(data.seenAt)].filter(Boolean).join(', ');
  const nameText = (data.name || 'Our dog').toUpperCase();

  // Vertical layout: cursor moves down as optional sections are present.
  const photoTop = 168;
  const photoH = medical.length || data.reward ? 420 : 460;
  let y = photoTop + photoH + 70;
  const nameY = y; y += 50;
  const factsY = facts ? y : 0; if (facts) y += 44;
  let tagX = 0;
  const tagW = tags.map((t) => t.short.length * 16 + 30);
  const tagsTotal = tagW.reduce((a, b) => a + b, 0) + Math.max(0, tags.length - 1) * 12;
  const tagsY = tags.length ? y : 0; if (tags.length) y += 52;
  const seenY = seen ? y + 4 : 0; if (seen) y += 40;
  const medY = medical.length ? y + 2 : 0; y += medical.length * 30;
  const rewardY = data.reward ? y + 6 : 0;

  return (
    <svg id={id} className={className} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-labelledby={`${uid}-t ${uid}-d`}>
      <title id={`${uid}-t`}>{`Lost dog poster for ${data.name || 'our dog'}`}</title>
      <desc id={`${uid}-d`}>{[facts, seen && `Last seen ${seen}`, data.phone && `Call ${data.phone}`].filter(Boolean).join('. ')}</desc>
      <defs><clipPath id={clip}><rect x="60" y={photoTop} width={W - 120} height={photoH} rx="18" /></clipPath></defs>
      <rect width={W} height={H} fill="#ffffff" />
      <rect x="0" y="0" width={W} height="140" fill="#c62828" />
      <text x={W / 2} y="112" textAnchor="middle" fontFamily={SANS} fontWeight={900} fontSize="112" fill="#ffffff" letterSpacing="6">LOST DOG</text>

      {data.photo
        ? <image href={data.photo} x="60" y={photoTop} width={W - 120} height={photoH} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${clip})`} />
        : <g><rect x="60" y={photoTop} width={W - 120} height={photoH} rx="18" fill="#eeeeee" /><text x={W / 2} y={photoTop + photoH / 2} textAnchor="middle" fontFamily={SANS} fontSize="30" fill="#777">Add a photo to your dog&apos;s profile</text></g>}
      <rect x="60" y={photoTop} width={W - 120} height={photoH} rx="18" fill="none" stroke="#1c2430" strokeWidth="3" />

      <text x={W / 2} y={nameY} textAnchor="middle" fontFamily={SANS} fontWeight={900} fontSize={fitSize(nameText, W - 120, 76)} fill="#141414">{nameText}</text>
      {facts && <text x={W / 2} y={factsY} textAnchor="middle" fontFamily={SANS} fontWeight={700} fontSize={fitSize(facts, W - 120, 30, 18)} fill="#333">{facts}</text>}
      {tags.length > 0 && <g>{tags.map((t, i) => {
        const x = (W - tagsTotal) / 2 + tagX; tagX += tagW[i] + 12;
        const color = TAG_COLORS[t.tone] || '#1c2430';
        return <g key={t.key}><rect x={x} y={tagsY - 30} width={tagW[i]} height="40" rx="6" fill="#fff" stroke={color} strokeWidth="3" /><text x={x + tagW[i] / 2} y={tagsY - 2} textAnchor="middle" fontFamily={SANS} fontWeight={800} fontSize="22" fill={color} letterSpacing="1">{t.short}</text></g>;
      })}</g>}
      {seen && <text x={W / 2} y={seenY} textAnchor="middle" fontFamily={SANS} fontSize={fitSize(`Last seen ${seen}`, W - 120, 28, 18)} fill="#141414"><tspan fontWeight={800}>Last seen </tspan>{seen}</text>}
      {medical.map((line, i) => <text key={i} x={W / 2} y={medY + i * 30} textAnchor="middle" fontFamily={SANS} fontWeight={i === 0 ? 700 : 400} fontSize="23" fill="#b71c1c">{line}</text>)}
      {data.reward && <g><rect x="160" y={rewardY - 4} width={W - 320} height="46" rx="23" fill="#ffd54f" /><text x={W / 2} y={rewardY + 28} textAnchor="middle" fontFamily={SANS} fontWeight={900} fontSize={fitSize(`REWARD: ${data.reward}`, W - 360, 28, 16)} fill="#141414">{`REWARD: ${data.reward}`}</text></g>}

      <rect x="0" y={H - 190} width={W} height="190" fill="#1c2430" />
      <text x="60" y={H - 132} fontFamily={SANS} fontWeight={800} fontSize="30" fill="#ffd54f" letterSpacing="2">IF SEEN, PLEASE CALL</text>
      <text x="60" y={H - 62} fontFamily={SANS} fontWeight={900} fontSize={fitSize(data.phone || 'Scan the code', 520, 70, 28)} fill="#ffffff">{data.phone || 'Scan the code'}</text>
      <text x="60" y={H - 24} fontFamily={SANS} fontSize="20" fill="#cfd8dc">Do not chase. Keep the dog in sight and call.</text>
      <rect x={W - 220} y={H - 178} width="166" height="166" rx="8" fill="#ffffff" />
      <QRCodeSVG value={data.url} x={W - 212} y={H - 170} size={150} marginSize={0} level="M" />
    </svg>
  );
}

const PRINT_CSS = `
@media screen { #${PRINT_ID} { display: none !important; } }
@media print {
  @page { size: letter portrait; margin: 0.3in; }
  html, body { background: #fff !important; }
  body > *:not(#${PRINT_ID}) { display: none !important; }
  #${PRINT_ID}, #${PRINT_ID} * { visibility: visible !important; }
  #${PRINT_ID} { display: block !important; position: static !important; margin: 0 auto; width: 7.9in; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  #${PRINT_ID} svg { display: block; width: 7.9in; height: 10.22in; }
}`;

export function LostPoster({ petId, dogName }: { petId?: string; dogName?: string }) {
  const { state, pets, pet, selected, setSelected, error } = useOwnerPets(petId);
  const [scan, setScan] = useState<Scan | null>(null);
  const [photo, setPhoto] = useState('');
  const [place, setPlace] = useState('');
  const [seenAt, setSeenAt] = useState('');
  const [reward, setReward] = useState('');
  const [phone, setPhone] = useState('');
  const [showMedical, setShowMedical] = useState(true);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [printing, setPrinting] = useState(false);
  const svgId = `lost-poster-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const svgRef = useRef<HTMLDivElement>(null);

  // Reset per-pet fields and fetch the latest scan / found report (owners can read their pets' scans).
  useEffect(() => {
    if (!pet || !supabase) return;
    let alive = true;
    setPhone(pet.contact_public?.phone || '');
    setPlace(''); setSeenAt(''); setScan(null); setMessage('');
    supabase.from('scan_events').select('created_at,latitude,longitude,reported_lost,finder_note').eq('pet_id', pet.id).order('created_at', { ascending: false }).limit(10)
      .then(({ data }) => {
        if (!alive) return;
        const rows = (data || []) as Scan[];
        const best = rows.find((r) => r.reported_lost) || rows.find((r) => r.latitude != null) || null;
        setScan(best);
        if (best) setSeenAt(toLocalInput(best.created_at));
      });
    // Inline the photo so print and PNG export don't depend on a cross-origin fetch at the last moment.
    setPhoto(pet.photo_url || '');
    if (pet.photo_url) urlToDataUrl(pet.photo_url).then((data) => { if (alive) setPhoto(data); }).catch(() => undefined);
    return () => { alive = false; };
  }, [pet]);

  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(false);
    window.addEventListener('afterprint', done);
    // Give the portal one frame to mount and the image to decode before opening the dialog.
    const timer = window.setTimeout(() => { window.print(); }, 250);
    return () => { window.clearTimeout(timer); window.removeEventListener('afterprint', done); };
  }, [printing]);

  const data = useMemo<PosterData | null>(() => {
    if (!pet) return null;
    const d = (pet.profile?.details || {}) as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');
    const sex = str(d.sex).replace(/\s*\((neutered|spayed)\)/i, '');
    const fixed = str(d.fixed) === 'yes' ? (sex === 'Female' ? 'spayed' : sex === 'Male' ? 'neutered' : 'fixed') : '';
    return {
      name: pet.name || dogName || '',
      photo,
      breed: pet.breed || '',
      sex: [sex, fixed].filter(Boolean).join(', '),
      color: str(d.colors) || str(d.coat),
      weight: str(d.weight_lb) ? `${str(d.weight_lb)} lb` : '',
      tags: Array.isArray(pet.profile?.status_tags) ? (pet.profile.status_tags as string[]) : [],
      medical: showMedical ? (pet.medical_public || '').trim() : '',
      phone: phone.trim(),
      place: place.trim(),
      seenAt: seenAt ? new Date(seenAt).toISOString() : '',
      reward: reward.trim(),
      url: `${PUBLIC_APP_URL}/pet/?pet=${encodeURIComponent(pet.id)}`,
    };
  }, [pet, dogName, photo, phone, place, seenAt, reward, showMedical]);

  if (!supabase) return null;
  if (state === 'signedOut' || state === 'loading') return null;
  if (state === 'error') return <section className="panel wide"><p className="eyebrow">Lost dog poster</p><p className="formHint">{error}</p></section>;
  if (state === 'noPets' || !pet || !data) return (
    <section className="panel wide"><p className="eyebrow">Lost dog poster</p><h2>Make a lost dog poster</h2><p className="formHint">Add {dogName || 'your dog'} to your account first. The poster is built from the saved profile.</p></section>
  );

  function posterSvg() {
    return svgRef.current?.querySelector('svg') as SVGSVGElement | null;
  }

  async function png() {
    const svg = posterSvg();
    if (!svg) throw new Error('Poster preview not found.');
    return await svgToPngBlob(svg, 2);
  }

  async function download() {
    setBusy(true); setMessage('');
    try {
      downloadBlob(await png(), `lost-${safeFileName(data!.name)}.png`);
      setMessage('Poster saved as a PNG.');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Could not make the PNG.'); }
    setBusy(false);
  }

  async function copyLink() {
    try { await navigator.clipboard.writeText(data!.url); setMessage('Link to the public profile copied. Paste it anywhere.'); }
    catch { window.prompt('Copy this link', data!.url); }
  }

  async function share() {
    setBusy(true); setMessage('');
    const text = `LOST DOG: ${data!.name}${data!.place ? `, last seen near ${data!.place}` : ''}. ${data!.phone ? `Call ${data!.phone}.` : ''}`.trim();
    try {
      const file = new File([await png()], `lost-${safeFileName(data!.name)}.png`, { type: 'image/png' });
      if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Lost dog: ${data!.name}`, text: `${text} ${data!.url}` });
      } else if (typeof navigator.share === 'function') {
        await navigator.share({ title: `Lost dog: ${data!.name}`, text, url: data!.url });
      } else {
        await copyLink();
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) await copyLink();
    }
    setBusy(false);
  }

  function fillScanPlace() {
    if (!scan || scan.latitude == null || scan.longitude == null) return;
    setPlace(`${scan.latitude.toFixed(4)}, ${scan.longitude.toFixed(4)}`);
  }

  return (
    <section className="panel wide">
      <div className="panelTitleRow">
        <div><p className="eyebrow">Lost dog poster</p><h2>{data.name || 'Your dog'}’s poster</h2></div>
        {pets.length > 1 && !petId && <select value={selected} onChange={(e) => setSelected(e.target.value)} aria-label="Choose dog" style={{ width: 'auto' }}>{pets.map((p: OwnerPet) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>}
      </div>
      {pet.lost_mode ? <p className={styles.lostOn}>{data.name} is marked lost. The QR on the poster opens the public profile with the latest sighting.</p>
        : <p className="formHint">Print it, save it as an image or share it to neighborhood groups. Your home address is never put on the poster.</p>}
      {message && <p className="authMessage" role="status">{message}</p>}
      <div className={styles.layout}>
        <div className={styles.form}>
          <div className="grid2">
            <label>Last seen near<input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Main St and 5th, Auburn" maxLength={70} /></label>
            <label>Last seen at<input type="datetime-local" value={seenAt} onChange={(e) => setSeenAt(e.target.value)} /></label>
            <label>Phone on the poster<input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" maxLength={24} /></label>
            <label>Reward (optional)<input value={reward} onChange={(e) => setReward(e.target.value)} placeholder="$200, no questions asked" maxLength={40} /></label>
          </div>
          {scan && <div className={styles.inline}>
            <small className="formHint">{scan.reported_lost ? 'Latest found report' : 'Latest scan'}: {formatSeen(scan.created_at)}{scan.finder_note ? `, "${scan.finder_note.slice(0, 80)}"` : ''}</small>
            {scan.latitude != null && <button type="button" onClick={fillScanPlace}>Use scan location</button>}
            <button type="button" onClick={() => setSeenAt(toLocalInput(scan.created_at))}>Use scan time</button>
          </div>}
          {pet.medical_public && <label className="toggleRow"><input type="checkbox" checked={showMedical} onChange={(e) => setShowMedical(e.target.checked)} /> Include the public health note</label>}
          <dl className={styles.facts}>
            <div><dt>Breed</dt><dd>{data.breed || 'Not set'}</dd></div>
            <div><dt>Sex</dt><dd>{data.sex || 'Not set'}</dd></div>
            <div><dt>Color</dt><dd>{data.color || 'Not set'}</dd></div>
            <div><dt>Weight</dt><dd>{data.weight || 'Not set'}</dd></div>
          </dl>
          <p className="formHint">Missing something? Fill it in on your dog’s profile and it shows up here.</p>
          <div className="actions">
            <button className="primary" type="button" onClick={() => setPrinting(true)} disabled={busy || printing}>Print poster</button>
            <button type="button" onClick={download} disabled={busy}>{busy ? 'Working…' : 'Download PNG'}</button>
            <button type="button" onClick={share} disabled={busy}>Share</button>
            <button type="button" onClick={copyLink}>Copy link</button>
          </div>
        </div>
        <div className={styles.preview} ref={svgRef}>
          <PosterSvg data={data} id={svgId} className={styles.poster} />
        </div>
      </div>
      {printing && typeof document !== 'undefined' && createPortal(
        <div id={PRINT_ID} aria-hidden="true"><style>{PRINT_CSS}</style><PosterSvg data={data} /></div>,
        document.body,
      )}
    </section>
  );
}
