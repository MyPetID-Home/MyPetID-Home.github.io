"use client";

import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../lib/supabase';
import { publicTagUrl } from '../lib/public-url';

/**
 * Owner view of their dog's public tag page: the link printed on the card and written to the
 * NFC chip, a QR for it, and a live preview of exactly what finders see.
 */
export function PublicLinkPanel({ petId, petName }: { petId?: string | null; petName: string }) {
  const [code, setCode] = useState<string | null | undefined>(undefined);
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!supabase || !petId) { setCode(null); return; }
    supabase.from('tags').select('tag_code,created_at').eq('pet_id', petId).order('created_at').then(({ data }) => {
      const codes = ((data || []) as { tag_code: string }[]).map((t) => t.tag_code);
      setCode(codes.find((c) => /^MPID-\d+$/.test(c)) || codes[0] || null);
    });
  }, [petId]);
  if (code === undefined) return null;
  return (
    <section className="panel wide publicLinkPanel">
      <p className="eyebrow">What finders see</p>
      <h2>{petName}’s public tag page</h2>
      {!code ? <p className="formHint">Your link appears here once MyPetID makes {petName}’s card and tag. Everything you mark as public on {petName}’s profile is what that page will show.</p> : <>
        <p className="formHint">This is the page that opens when someone taps the NFC tag or scans the QR code or barcode. It shows only what you choose to make public, never your account or address.</p>
        <div className="nfcRow">
          <div className="nfcQr"><QRCodeSVG value={publicTagUrl(code)} size={120} level="M" includeMargin /></div>
          <div className="publicLinkInfo">
            <label>Tag link<input readOnly value={publicTagUrl(code)} onFocus={(e) => e.currentTarget.select()} /></label>
            <div className="actions compact">
              <a className="button primary" href={`/public/${encodeURIComponent(code)}/?preview=1`} target="_blank" rel="noopener noreferrer">Open my public page</a>
              <button type="button" onClick={() => navigator.clipboard?.writeText(publicTagUrl(code)).then(() => setMessage('Link copied.'))}>Copy link</button>
            </div>
            {message && <small className="formHint">{message}</small>}
          </div>
        </div>
        <div className="phonePreview"><iframe title={`${petName}'s public page preview`} src={`/public/${encodeURIComponent(code)}/?preview=1`} loading="lazy" /></div>
      </>}
    </section>
  );
}
