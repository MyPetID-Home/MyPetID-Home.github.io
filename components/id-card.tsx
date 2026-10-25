"use client";

import { useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Barcode } from './share-kit';
import { BLEED, CARD_H, CARD_W, mergeLayout, stateByCode, statusTag, TAG_COLORS, type CardData, type CardLayout, type TextSpec } from '../lib/id-card';

/**
 * The MyPetID pet license, drawn as one SVG so the screen preview and the print file
 * are identical. Only system fonts are used so exported files look the same everywhere.
 */
const FONTS: Record<string, string> = {
  serif: 'Georgia, "Times New Roman", serif',
  sans: 'Arial, Helvetica, sans-serif',
  script: '"Brush Script MT", "Segoe Script", "Lucida Handwriting", cursive',
};

function hash(text: string) { let h = 2166136261; for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }

/** Original security artwork for a state: guilloche rosettes, fine wave lines, sky band. */
function StateArt({ code, colors }: { code: string; colors: [string, string, string] }) {
  const seed = hash(code);
  const rosettes = useMemo(() => {
    const out: string[] = [];
    for (let r = 0; r < 3; r += 1) {
      const cx = [180, 760, 520][r] + ((seed >> (r * 3)) % 60) - 30;
      const cy = [560, 420, 120][r];
      const R = 150 + ((seed >> (r * 5)) % 60);
      const k = 7 + ((seed >> (r * 2)) % 6);
      let d = '';
      for (let i = 0; i <= 720; i += 1) {
        const t = (i / 720) * Math.PI * 2;
        const rr = R * (0.72 + 0.28 * Math.cos(k * t));
        const x = cx + rr * Math.cos(t + 0.3 * Math.sin(3 * k * t));
        const y = cy + rr * 0.62 * Math.sin(t + 0.3 * Math.sin(3 * k * t));
        d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
      }
      out.push(d);
    }
    return out;
  }, [seed]);
  const waves = useMemo(() => Array.from({ length: 30 }, (_, i) => {
    const y0 = 70 + i * 19;
    let d = '';
    for (let x = 0; x <= CARD_W; x += 12) d += `${x ? 'L' : 'M'}${x} ${(y0 + 4 * Math.sin((x / 70) + i * 0.6 + (seed % 7))).toFixed(1)}`;
    return d;
  }), [seed]);
  return (
    <g>
      <defs>
        <linearGradient id={`sky-${code}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d6ecfb" /><stop offset="1" stopColor="#f6f3e8" /></linearGradient>
        <linearGradient id={`paper-${code}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fbf9f1" /><stop offset="1" stopColor="#efece0" /></linearGradient>
      </defs>
      <rect width={CARD_W} height={CARD_H} fill={`url(#paper-${code})`} />
      <rect width={CARD_W} height="150" fill={`url(#sky-${code})`} />
      <g fill="none" strokeWidth="0.9" opacity=".55">{waves.map((d, i) => <path key={i} d={d} stroke={i % 3 ? '#b9cfe0' : colors[2]} strokeOpacity={i % 3 ? 0.55 : 0.35} />)}</g>
      <g fill="none" strokeWidth="0.8">{rosettes.map((d, i) => <path key={i} d={d} stroke={i === 1 ? colors[2] : colors[1]} strokeOpacity=".28" />)}</g>
      <text x={CARD_W - 40} y={CARD_H - 40} textAnchor="end" fontFamily={FONTS.serif} fontWeight={700} fontSize="230" fill={colors[1]} fillOpacity=".06">{code}</text>
    </g>
  );
}

function Seal({ box, colors, stateName }: { box: { x: number; y: number; w: number; h: number }; colors: [string, string, string]; stateName: string }) {
  const r = Math.min(box.w, box.h) / 2;
  const cx = box.x + box.w / 2; const cy = box.y + box.h / 2;
  const id = `seal-${stateName.replace(/\W/g, '')}`;
  return (
    <g opacity=".75">
      <defs><path id={id} d={`M ${cx - r * 0.78} ${cy} a ${r * 0.78} ${r * 0.78} 0 1 1 ${r * 1.56} 0 a ${r * 0.78} ${r * 0.78} 0 1 1 ${-r * 1.56} 0`} /></defs>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={colors[2]} strokeWidth="2.5" />
      <circle cx={cx} cy={cy} r={r * 0.62} fill="none" stroke={colors[2]} strokeWidth="1.2" />
      <text fontFamily={FONTS.sans} fontSize={r * 0.17} fontWeight={700} fill={colors[2]} letterSpacing="1.5"><textPath href={`#${id}`}>{`MYPETID * ${stateName.toUpperCase()} * PET LICENSE *`}</textPath></text>
      <g transform={`translate(${cx} ${cy}) scale(${r / 60})`} fill={colors[2]}>
        <ellipse cx="0" cy="10" rx="13" ry="11" /><circle cx="-14" cy="-6" r="5.5" /><circle cx="-5" cy="-15" r="5.5" /><circle cx="6" cy="-15" r="5.5" /><circle cx="15" cy="-6" r="5.5" />
      </g>
    </g>
  );
}

function T({ spec, children, fallbackColor }: { spec: TextSpec; children: React.ReactNode; fallbackColor: string }) {
  if (spec.hidden) return null;
  return <text x={spec.x} y={spec.y} fontSize={spec.size} fontWeight={spec.weight || 400} fontFamily={FONTS[spec.font || 'sans']} fill={spec.color || fallbackColor} textAnchor={spec.anchor || 'start'}>{children}</text>;
}

export function IdCardSvg({ data, layout: savedLayout, background, hideCodes = false, bleed = false, id }: { data: CardData; layout?: Partial<CardLayout> | null; background?: string | null; hideCodes?: boolean; bleed?: boolean; id?: string }) {
  const state = stateByCode(data.state) || stateByCode('ME')!;
  const L = mergeLayout(savedLayout);
  const [ink, bannerColor] = state.colors;
  const pad = bleed ? BLEED : 0;
  const tags = data.statusTags.map(statusTag).filter(Boolean);
  let tagX = L.text.tags.x;
  // Shrink long state names so they end before the banner (bold serif caps run up to ~0.82em wide).
  const stateRoom = Math.max(120, (L.text.banner.hidden ? CARD_W - 40 : L.bannerBox.x - 14) - L.text.state.x);
  const stateLabel = state.name.toUpperCase();
  const stateSize = Math.min(L.text.state.size, stateRoom / (stateLabel.length * 0.82 + stateLabel.length * 2 / L.text.state.size));
  return (
    <svg id={id} xmlns="http://www.w3.org/2000/svg" viewBox={`${-pad} ${-pad} ${CARD_W + pad * 2} ${CARD_H + pad * 2}`} width={CARD_W + pad * 2} height={CARD_H + pad * 2} className="idCardSvg" role="img" aria-label={`${state.name} pet license for ${data.petName}`}>
      <defs><clipPath id="card-photo-clip"><rect x={L.boxes.photo.x} y={L.boxes.photo.y} width={L.boxes.photo.w} height={L.boxes.photo.h} /></clipPath></defs>
      {/* Bleed area repeats the paper colour so trimming never shows white */}
      {bleed && <rect x={-pad} y={-pad} width={CARD_W + pad * 2} height={CARD_H + pad * 2} fill="#efece0" />}
      {background ? <image href={background} x="0" y="0" width={CARD_W} height={CARD_H} preserveAspectRatio="xMidYMid slice" /> : <StateArt code={state.code} colors={state.colors} />}

      {!L.boxes.seal.hidden && !background && <Seal box={L.boxes.seal} colors={state.colors} stateName={state.name} />}
      {!L.text.state.hidden && <text x={L.text.state.x} y={L.text.state.y} fontSize={stateSize} fontWeight={700} fontFamily={FONTS.serif} fill={L.text.state.color || ink} letterSpacing="2" stroke="#ffffff" strokeWidth="1.2" paintOrder="stroke">{state.name.toUpperCase()}</text>}
      {!L.text.banner.hidden && <><rect x={L.bannerBox.x} y={L.bannerBox.y} width={L.bannerBox.w} height={L.bannerBox.h} fill={bannerColor} /><T spec={L.text.banner} fallbackColor="#fff">PET DRIVERS LICENSE</T></>}
      <T spec={L.text.country} fallbackColor={bannerColor}><tspan x={L.text.country.x}>USA</tspan><tspan x={L.text.country.x} dy={L.text.country.size * 1.1}>{state.code}</tspan></T>
      <T spec={L.text.scan} fallbackColor="#1c2430">SCAN IF FOUND</T>
      <T spec={L.text.species} fallbackColor="#1c2430">{data.species || 'Canine'}</T>

      {!L.boxes.photo.hidden && (data.photoUrl ? <image href={data.photoUrl} x={L.boxes.photo.x} y={L.boxes.photo.y} width={L.boxes.photo.w} height={L.boxes.photo.h} preserveAspectRatio="xMidYMid slice" clipPath="url(#card-photo-clip)" /> : <rect x={L.boxes.photo.x} y={L.boxes.photo.y} width={L.boxes.photo.w} height={L.boxes.photo.h} fill="#1c2430" opacity=".15" />)}

      {!L.boxes.qr.hidden && (hideCodes
        ? <g><rect x={L.boxes.qr.x} y={L.boxes.qr.y} width={L.boxes.qr.w} height={L.boxes.qr.h} fill="#fff" stroke="#1c2430" strokeDasharray="6 5" /><text x={L.boxes.qr.x + L.boxes.qr.w / 2} y={L.boxes.qr.y + L.boxes.qr.h / 2} textAnchor="middle" fontFamily={FONTS.sans} fontSize="16" fontWeight={700} fill="#1c2430">QR on your card</text></g>
        : <g><rect x={L.boxes.qr.x} y={L.boxes.qr.y} width={L.boxes.qr.w} height={L.boxes.qr.h} fill="#fff" /><QRCodeSVG value={data.qrUrl || 'https://mypetid.vercel.app'} x={L.boxes.qr.x} y={L.boxes.qr.y} size={Math.min(L.boxes.qr.w, L.boxes.qr.h)} marginSize={1} level="M" /></g>)}
      {!L.boxes.barcode.hidden && !hideCodes && data.barcode && <svg x={L.boxes.barcode.x} y={L.boxes.barcode.y} width={L.boxes.barcode.w} height={L.boxes.barcode.h} preserveAspectRatio="none"><Barcode value={data.barcode} height={60} /></svg>}

      <T spec={L.text.name} fallbackColor="#141414">{data.petName}</T>
      <T spec={L.text.address1} fallbackColor="#141414">{data.address1}</T>
      <T spec={L.text.address2} fallbackColor="#141414">{data.address2}</T>
      <T spec={L.text.phone} fallbackColor="#d23b2b">{data.phone}</T>

      {!L.text.tags.hidden && tags.map((tag) => {
        const w = tag!.short.length * L.text.tags.size * 0.68 + 18;
        const x = tagX; tagX += w + 8;
        const color = TAG_COLORS[tag!.tone];
        return <g key={tag!.key}><rect x={x} y={L.text.tags.y - L.text.tags.size - 4} width={w} height={L.text.tags.size + 12} fill="#fff" stroke={color} strokeWidth="2" /><text x={x + w / 2} y={L.text.tags.y + 1} textAnchor="middle" fontFamily={FONTS.sans} fontWeight={700} fontSize={L.text.tags.size} fill={color} letterSpacing="1">{tag!.short}</text></g>;
      })}

      <T spec={L.text.labelHeight} fallbackColor="#141414">HEIGHT</T>
      <T spec={L.text.labelWeight} fallbackColor="#141414">WEIGHT</T>
      <T spec={L.text.labelEyes} fallbackColor="#141414">EYES</T>
      <T spec={L.text.labelSex} fallbackColor="#141414">SEX</T>
      <T spec={L.text.height} fallbackColor="#141414">{data.height}</T>
      <T spec={L.text.weight} fallbackColor="#141414">{data.weight}</T>
      <T spec={L.text.eyes} fallbackColor="#141414">{data.eyes}</T>
      <T spec={L.text.sex} fallbackColor="#141414">{data.sex}</T>
      <T spec={L.text.labelDob} fallbackColor="#141414">DOB:</T>
      <T spec={L.text.labelRestrictions} fallbackColor="#141414">RESTRICTIONS:</T>
      <T spec={L.text.dob} fallbackColor="#141414">{data.dob}</T>
      <T spec={L.text.restrictions} fallbackColor="#141414">{data.restrictions}</T>
      <T spec={L.text.signature} fallbackColor="#1c2430">{data.fullName || data.petName}</T>
    </svg>
  );
}

async function toDataUrl(url: string) {
  if (!url || url.startsWith('data:')) return url;
  const response = await fetch(url, { mode: 'cors' });
  const blob = await response.blob();
  return await new Promise<string>((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsDataURL(blob); });
}

/** Rasterise a rendered card SVG (found by element id) to a 300 dpi PNG and download it. */
export async function downloadCardPng(svgId: string, fileName: string) {
  const svg = document.getElementById(svgId) as SVGSVGElement | null;
  if (!svg) throw new Error('Card preview not found.');
  const clone = svg.cloneNode(true) as SVGSVGElement;
  // Inline every image so the canvas isn't tainted and the file is self-contained.
  for (const img of Array.from(clone.querySelectorAll('image'))) {
    const href = img.getAttribute('href') || '';
    try { img.setAttribute('href', await toDataUrl(new URL(href, window.location.href).href)); } catch { /* leave as is */ }
  }
  const markup = new XMLSerializer().serializeToString(clone);
  const width = Number(svg.getAttribute('width')); const height = Number(svg.getAttribute('height'));
  const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }));
  const image = new Image();
  await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Could not render the card.')); image.src = url; });
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  canvas.getContext('2d')!.drawImage(image, 0, 0, width, height);
  URL.revokeObjectURL(url);
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = `${fileName}.png`;
  a.click();
}
