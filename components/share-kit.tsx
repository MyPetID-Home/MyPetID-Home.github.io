"use client";

import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Check, Nfc, QrCode, FileText, ArrowRight } from './icons';

/**
 * Every way to hand someone a dog's profile: link, QR, barcode, NFC tag and a
 * wallet-style ID card that mirrors the physical MyPetID NFC card.
 */

// Code 128 (set B) bar/space widths for values 0-106; 106 is the stop pattern.
const C128 = '212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 114131 311141 411131 211412 211214 211232 2331112'.split(' ');

export function code128Bars(text: string) {
  const values = [104];
  for (const ch of text) { const v = ch.charCodeAt(0) - 32; if (v >= 0 && v <= 94) values.push(v); }
  const checksum = values.reduce((sum, v, i) => sum + v * (i === 0 ? 1 : i), 0) % 103;
  return [...values, checksum, 106].map((v) => C128[v]).join('');
}

export function Barcode({ value, height = 64, className }: { value: string; height?: number; className?: string }) {
  const widths = code128Bars(value);
  const module = 2;
  const quiet = 10 * module;
  let x = quiet;
  const bars: React.ReactNode[] = [];
  widths.split('').forEach((w, i) => { const width = Number(w) * module; if (i % 2 === 0) bars.push(<rect key={i} x={x} y={0} width={width} height={height} />); x += width; });
  const total = x + quiet;
  return (
    <svg className={className} viewBox={`0 0 ${total} ${height + 18}`} role="img" aria-label={`Barcode ${value}`} xmlns="http://www.w3.org/2000/svg">
      <rect width={total} height={height + 18} fill="#fff" />
      <g fill="#071008">{bars}</g>
      <text x={total / 2} y={height + 14} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="12" fill="#071008">{value}</text>
    </svg>
  );
}

function downloadSvg(svg: SVGSVGElement | null, fileName: string, asPng: boolean) {
  if (!svg) return;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const markup = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([markup], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const save = (href: string, name: string) => { const a = document.createElement('a'); a.href = href; a.download = name; a.click(); };
  if (!asPng) { save(url, `${fileName}.svg`); setTimeout(() => URL.revokeObjectURL(url), 1000); return; }
  const img = new Image();
  img.onload = () => {
    const box = svg.viewBox.baseVal;
    const scale = 1024 / Math.max(box.width || img.width, box.height || img.height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round((box.width || img.width) * scale);
    canvas.height = Math.round((box.height || img.height) * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    save(canvas.toDataURL('image/png'), `${fileName}.png`);
    URL.revokeObjectURL(url);
  };
  img.src = url;
}

type NdefWriter = { write: (message: { records: { recordType: string; data: string }[] }) => Promise<void> };

export function ShareKit({ petName, tagId, photoUrl, breed, ownerName, ownerPhone, finderUrl }: { petName: string; tagId: string; photoUrl: string; breed: string; ownerName: string; ownerPhone: string; finderUrl: string }) {
  const [copied, setCopied] = useState(false);
  const [nfcSupported, setNfcSupported] = useState(false);
  const [nfcStatus, setNfcStatus] = useState('');
  const [canShare, setCanShare] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const safeName = (petName || 'pet').replace(/[^a-z0-9]+/gi, '-').toLowerCase();

  useEffect(() => { setNfcSupported('NDEFReader' in window); setCanShare(typeof navigator.share === 'function'); }, []);

  async function copyLink() {
    try { await navigator.clipboard.writeText(finderUrl); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* clipboard blocked */ }
  }
  async function shareLink() {
    try { await navigator.share({ title: `${petName} on MyPetID`, text: `${petName}'s MyPetID profile`, url: finderUrl }); } catch { /* dismissed */ }
  }
  async function writeNfc() {
    const Reader = (window as unknown as { NDEFReader?: new () => NdefWriter }).NDEFReader;
    if (!Reader) return setNfcStatus('This browser can’t write NFC tags. Use Chrome on an Android phone.');
    try {
      setNfcStatus('Hold a blank NFC tag against the back of your phone…');
      await new Reader().write({ records: [{ recordType: 'url', data: finderUrl }] });
      setNfcStatus(`Done! The tag now opens ${petName}’s profile when tapped.`);
    } catch (error) {
      setNfcStatus(error instanceof Error ? `Couldn’t write the tag: ${error.message}` : 'Couldn’t write the tag.');
    }
  }

  return (
    <section className="panel full shareKit" data-tour="share">
      <div className="panelTitleRow"><div><p className="eyebrow">Admin · tag programming</p><h2>{petName}’s tag kit</h2></div><span className="iconBubble"><QrCode /></span></div>
      <p className="formHint">For producing the physical NFC card: every code opens the finder page for tag <strong>{tagId}</strong>. Only admins see this.</p>
      <div className="shareGrid">
        <article className="shareTile">
          <h3><ArrowRight /> Link</h3>
          <div className="copyRow"><input readOnly value={finderUrl} onFocus={(e) => e.target.select()} aria-label="Profile link" /><button className="primary" type="button" onClick={copyLink}>{copied ? <><Check /> Copied</> : 'Copy'}</button></div>
          {canShare && <button type="button" onClick={shareLink}>Share…</button>}
        </article>
        <article className="shareTile">
          <h3><QrCode /> QR code</h3>
          <div className="codeBox" ref={qrRef}><QRCodeSVG value={finderUrl || 'https://mypetid.vercel.app'} size={168} marginSize={2} level="M" /></div>
          <div className="actions compact"><button type="button" onClick={() => downloadSvg(qrRef.current?.querySelector('svg') || null, `${safeName}-qr`, true)}>Download PNG</button><button type="button" onClick={() => downloadSvg(qrRef.current?.querySelector('svg') || null, `${safeName}-qr`, false)}>SVG</button></div>
        </article>
        <article className="shareTile">
          <h3><FileText /> Barcode</h3>
          <div className="codeBox wide" ref={barRef}><Barcode value={tagId} /></div>
          <p className="formHint">Code 128 of the tag ID, for shelters, vets and scanners.</p>
          <button type="button" onClick={() => downloadSvg(barRef.current?.querySelector('svg') || null, `${safeName}-barcode`, true)}>Download PNG</button>
        </article>
        <article className="shareTile">
          <h3><Nfc /> NFC tag</h3>
          <p className="formHint">{nfcSupported ? 'Write this profile onto a blank NFC tag or sticker.' : 'Writing NFC tags works in Chrome on Android. Your MyPetID card already comes programmed.'}</p>
          <dl className="infoList"><dt>Tag ID</dt><dd><code>{tagId}</code></dd><dt>Record</dt><dd>URL → finder page</dd></dl>
          <button className={nfcSupported ? 'primary' : ''} type="button" disabled={!nfcSupported} onClick={writeNfc}><Nfc /> Write to NFC tag</button>
          {nfcStatus && <p className="authMessage" role="status">{nfcStatus}</p>}
        </article>
      </div>

      <div className="idCardWrap">
        <div className="idCard" id="mypetid-id-card">
          <div className="idCardTop"><span className="idBrand"><img src="/images/logo/MyPetID-Logo_Resized.jpg" alt="" />MyPet<b>ID</b></span><span className="idChip" aria-hidden="true"><Nfc /></span></div>
          <div className="idCardBody">
            <img className="idPhoto" src={photoUrl || '/images/logo/MyPetID-Logo_Resized.jpg'} alt="" />
            <div className="idInfo"><small>Name</small><strong>{petName}</strong><small>Breed</small><span>{breed || '—'}</span><small>Owner</small><span>{ownerName || 'See profile'}{ownerPhone ? ` · ${ownerPhone}` : ''}</span></div>
            <div className="idQr"><QRCodeSVG value={finderUrl || 'https://mypetid.vercel.app'} size={78} marginSize={1} /></div>
          </div>
          <div className="idCardFoot"><span>If found, scan or tap me</span><Barcode className="idBarcode" value={tagId} height={30} /></div>
        </div>
        <div className="idCardSide">
          <h3>Digital ID card</h3>
          <p>The same details as {petName}’s physical MyPetID NFC card. Print it or keep it on your phone as a backup.</p>
          <div className="actions"><button className="primary" type="button" onClick={() => window.print()}>Print ID card</button><a className="button" href="/shop/">Order the NFC card</a></div>
        </div>
      </div>
    </section>
  );
}
