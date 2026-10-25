"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { IdCardSvg, downloadCardPng } from './id-card';
import { ARTWORK_LAYOUT, CARD_H, CARD_W, DEFAULT_LAYOUT, US_STATES, coatCode, eyeCode, licenseNumber, todayIso, formatDob, formatHeight, mergeLayout, sexCode, statusTag, type CardBox, type CardData, type CardField, type CardLayout } from '../lib/id-card';

/** Admin card desk: pick a dog, pick its state template, adjust the layout, export for print. */
type QueueRow = { pet_id: string; pet_name: string; breed: string | null; photo_url: string | null; pet_profile: Record<string, any> | null; owner_id: string | null; owner_name: string | null; owner_email: string | null; owner_phone: string | null; owner_details: Record<string, any> | null; tag_code: string | null; created_at: string; owner_account_number?: number | null };
type Template = { state: string; background_url: string | null; layout: Partial<CardLayout> };
type Selected = { kind: 'text'; key: CardField } | { kind: 'box'; key: CardBox } | { kind: 'banner' } | null;

const FIELD_LABELS: Record<string, string> = { state: 'State name', banner: 'Banner text', country: 'USA / state', scan: 'Scan if found', species: 'Species', name: 'Dog name', address1: 'Address line 1', address2: 'City, state ZIP', phone: 'Phone', tags: 'Status tags', labelHeight: 'HEIGHT label', labelWeight: 'WEIGHT label', labelEyes: 'EYES label', labelSex: 'SEX label', height: 'Height', weight: 'Weight', eyes: 'Eyes', sex: 'Sex', labelDob: 'DOB label', labelRestrictions: 'RESTRICTIONS label', dob: 'Date of birth', restrictions: 'Restrictions', signature: 'Signature', license: 'License number', issued: 'Issued date', labelCoat: 'COAT label', coat: 'Coat color', photo: 'Photo', qr: 'QR code', barcode: 'Barcode', seal: 'Seal' };

export function cardDataFromRow(row: QueueRow | null, origin: string, state: string, issued?: string): CardData {
  const p = row?.pet_profile || {};
  // Owner address lives in profiles.details.address (same shape as the shipping address).
  const card = p.card || {}; const d = p.details || {}; const o = row?.owner_details || {}; const a = o.address || {};
  const cityLine = [a.city, [a.state, a.postal_code].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return {
    state,
    petName: row?.pet_name || 'Clyde',
    fullName: card.full_name || row?.pet_name || 'Clyde',
    species: card.species || 'Canine',
    photoUrl: row?.photo_url || '/images/dog/Clyde-Nice.jpg',
    address1: [a.line1, a.line2].filter(Boolean).join(' ') || (row ? '' : '123 Main Street'),
    address2: cityLine || (row ? '' : 'Lewiston, ME 04240'),
    phone: o.card_phone || row?.owner_phone || (row ? '' : '(555) 555-0123'),
    height: formatHeight(d.height_in) || '',
    weight: d.weight_lb ? `${d.weight_lb}lbs` : '',
    eyes: eyeCode(d.eyes),
    sex: sexCode(d.sex),
    dob: formatDob(d.birthday),
    restrictions: card.restrictions || '',
    license: row ? licenseNumber(d.rabies_tag, d.microchip, row.pet_id, row.owner_account_number) : '8397001',
    issued: formatDob(issued || card.issued_at || todayIso()),
    coat: coatCode(d.colors || d.coat),
    signatureFont: card.signature_style || undefined,
    statusTags: Array.isArray(p.status_tags) ? p.status_tags : [],
    qrUrl: row?.tag_code ? `${origin}/scan/?tag=${encodeURIComponent(row.tag_code)}` : row ? `${origin}/pet/?pet=${row.pet_id}` : `${origin}/pet/?tag=demo-tag-001`,
    barcode: row?.tag_code || (row ? row.pet_id.slice(0, 12).toUpperCase() : 'DEMO-TAG-001'),
  };
}

export function CardDesigner() {
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [templates, setTemplates] = useState<Record<string, Template>>({});
  const [petId, setPetId] = useState('');
  const [state, setState] = useState('ME');
  const [layout, setLayout] = useState<CardLayout>(DEFAULT_LAYOUT);
  const [background, setBackground] = useState<string | null>(null);
  const [selected, setSelected] = useState<Selected>(null);
  const [bleed, setBleed] = useState(true);
  const [message, setMessage] = useState('');
  const [origin, setOrigin] = useState('');
  const [filter, setFilter] = useState('');
  const [issued, setIssued] = useState('');
  const [gallery, setGallery] = useState(false);
  const overlay = useRef<SVGSVGElement>(null);
  // mode 'move' drags the field; the other modes resize it from the edge or corner grabbed.
  const drag = useRef<{ sel: Selected; dx: number; dy: number; mode: 'move' | 'w' | 'h' | 'wh'; start: { x: number; y: number; w: number; h: number; size: number } } | null>(null);

  useEffect(() => { setOrigin(window.location.origin); }, []);
  const load = useCallback(async () => {
    if (!supabase) return setMessage('Sign in as an admin to use the card desk.');
    const [{ data: q, error: qe }, { data: t, error: te }] = await Promise.all([supabase.rpc('admin_card_queue'), supabase.from('card_templates').select('*')]);
    if (qe || te) return setMessage(/schema cache|does not exist|42P01/i.test((qe || te)!.message) ? 'The card desk switches on after the latest database update.' : (qe || te)!.message);
    setQueue((q || []) as QueueRow[]);
    setTemplates(Object.fromEntries(((t || []) as Template[]).map((row) => [row.state, row])));
  }, []);
  useEffect(() => { load(); }, [load]);

  const row = useMemo(() => queue.find((r) => r.pet_id === petId) || null, [queue, petId]);
  // Switching dog picks the state saved on its profile; switching state loads that template.
  useEffect(() => { const s = row?.pet_profile?.card?.state; if (s) setState(String(s).toUpperCase()); }, [row]);
  useEffect(() => { const t = templates[state]; setLayout(mergeLayout(t?.layout)); setBackground(t?.background_url || null); setSelected(null); }, [state, templates]);
  useEffect(() => { setIssued(String(row?.pet_profile?.card?.issued_at || todayIso())); }, [row]);
  const data = useMemo(() => cardDataFromRow(row, origin, state, issued), [row, origin, state, issued]);
  const missing = row ? (['address1', 'address2', 'phone', 'height', 'weight', 'eyes', 'sex', 'dob'] as const).filter((k) => !data[k]) : [];

  // Drag handles live in an overlay SVG with the same coordinate system as the card.
  function point(event: React.PointerEvent) {
    const box = overlay.current!.getBoundingClientRect();
    return { x: ((event.clientX - box.left) / box.width) * CARD_W, y: ((event.clientY - box.top) / box.height) * CARD_H };
  }
  function posOf(sel: Selected) {
    if (!sel) return { x: 0, y: 0 };
    if (sel.kind === 'text') return layout.text[sel.key];
    if (sel.kind === 'box') return layout.boxes[sel.key];
    return layout.bannerBox;
  }
  function moveTo(sel: Selected, x: number, y: number) {
    if (!sel) return;
    setLayout((l) => {
      const next: CardLayout = { text: { ...l.text }, boxes: { ...l.boxes }, bannerBox: { ...l.bannerBox } };
      const rx = Math.round(x); const ry = Math.round(y);
      if (sel.kind === 'text') next.text[sel.key] = { ...next.text[sel.key], x: rx, y: ry };
      else if (sel.kind === 'box') next.boxes[sel.key] = { ...next.boxes[sel.key], x: rx, y: ry };
      else { const dx = rx - l.bannerBox.x; next.bannerBox = { ...l.bannerBox, x: rx, y: ry }; next.text.banner = { ...l.text.banner, x: l.text.banner.x + dx, y: l.text.banner.y + (ry - l.bannerBox.y) }; }
      return next;
    });
  }
  function startDrag(sel: Selected, event: React.PointerEvent) {
    event.preventDefault();
    (event.target as Element).setPointerCapture?.(event.pointerId);
    const p = point(event); const pos = posOf(sel);
    drag.current = { sel, dx: p.x - pos.x, dy: p.y - pos.y, mode: 'move', start: { x: p.x, y: p.y, w: 0, h: 0, size: 0 } };
    setSelected(sel);
  }
  function startResize(sel: Selected, mode: 'w' | 'h' | 'wh', event: React.PointerEvent) {
    event.preventDefault(); event.stopPropagation();
    (event.target as Element).setPointerCapture?.(event.pointerId);
    const p = point(event); const pos = posOf(sel) as { w?: number; h?: number; size?: number };
    drag.current = { sel, dx: 0, dy: 0, mode, start: { x: p.x, y: p.y, w: pos.w || 0, h: pos.h || 0, size: pos.size || 0 } };
  }
  function onMove(event: React.PointerEvent) {
    const d = drag.current; if (!d) return;
    const p = point(event);
    if (d.mode === 'move') return moveTo(d.sel, p.x - d.dx, p.y - d.dy);
    const dx = p.x - d.start.x; const dy = p.y - d.start.y;
    if (d.sel?.kind === 'text') {
      // Text has no box: any resize handle scales the font size.
      const grow = d.mode === 'w' ? dx / 4 : d.mode === 'h' ? dy : Math.max(dx / 4, dy);
      return patchSel(d.sel, { size: Math.max(6, Math.round(d.start.size + grow)) });
    }
    const patch: Record<string, number> = {};
    if (d.mode !== 'h') patch.w = Math.max(10, Math.round(d.start.w + dx));
    if (d.mode !== 'w') patch.h = Math.max(10, Math.round(d.start.h + dy));
    // QR and seal stay square.
    if (d.sel?.kind === 'box' && (d.sel.key === 'qr' || d.sel.key === 'seal')) { const side = Math.max(patch.w ?? 0, patch.h ?? 0); patch.w = side; patch.h = side; }
    patchSel(d.sel, patch);
  }

  function patchSel(target: Selected, patch: Record<string, number | boolean | string>) {
    if (!target) return;
    setLayout((l) => {
      const next: CardLayout = { text: { ...l.text }, boxes: { ...l.boxes }, bannerBox: { ...l.bannerBox } };
      if (target.kind === 'text') next.text[target.key] = { ...next.text[target.key], ...patch };
      else if (target.kind === 'box') next.boxes[target.key] = { ...next.boxes[target.key], ...patch };
      else next.bannerBox = { ...next.bannerBox, ...patch };
      return next;
    });
  }
  const patchSelected = (patch: Record<string, number | boolean | string>) => patchSel(selected, patch);

  async function save() {
    if (!supabase) return;
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from('card_templates').upsert({ state, background_url: background, layout, updated_by: auth.user?.id || null, updated_at: new Date().toISOString() });
    if (error) return setMessage(error.message);
    setTemplates((t) => ({ ...t, [state]: { state, background_url: background, layout } }));
    setMessage(`Saved the ${state} template.`);
  }
  async function upload(file?: File | null) {
    if (!supabase || !file) return;
    const { data: auth } = await supabase.auth.getUser();
    const path = `${auth.user?.id || 'admin'}/card-templates/${state}-${Date.now()}.${(file.name.split('.').pop() || 'png').toLowerCase()}`;
    const { error } = await supabase.storage.from('tag-assets').upload(path, file, { upsert: true, contentType: file.type });
    if (error) return setMessage(error.message);
    setBackground(supabase.storage.from('tag-assets').getPublicUrl(path).data.publicUrl);
    setMessage('Background uploaded. Drag the fields into place, then Save template.');
  }
  async function exportPng() {
    try { await downloadCardPng('card-export', `${(data.petName || 'card').replace(/\W+/g, '-')}-${state}${bleed ? '-bleed' : ''}`); setMessage('Downloaded the print file (300 dpi).'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Export failed.'); return; }
    // Remember the issue date on the dog's profile the first time a print file is made.
    if (row && supabase && row.pet_profile?.card?.issued_at !== issued) {
      const profile = { ...(row.pet_profile || {}), card: { ...(row.pet_profile?.card || {}), issued_at: issued } };
      const { error } = await supabase.from('pets').update({ profile }).eq('id', row.pet_id);
      if (!error) setQueue((q) => q.map((r) => r.pet_id === row.pet_id ? { ...r, pet_profile: profile } : r));
    }
  }
  function copyInfo() {
    const lines = [`Dog: ${data.petName}`, `Signature: ${data.fullName}`, `State: ${state}`, `Species: ${data.species}`, `Address: ${data.address1}`, `City: ${data.address2}`, `Phone: ${data.phone}`, `Height: ${data.height}`, `Weight: ${data.weight}`, `Eyes: ${data.eyes}`, `Sex: ${data.sex}`, `DOB: ${data.dob}`, `Restrictions: ${data.restrictions}`, `License: ${data.license}`, `Issued: ${data.issued}`, `Coat: ${data.coat}`, `Tags: ${data.statusTags.map((t) => statusTag(t)?.label || t).join(', ')}`, `QR: ${data.qrUrl}`, `Barcode: ${data.barcode}`];
    navigator.clipboard?.writeText(lines.join('\n')).then(() => setMessage('Card info copied.'));
  }

  const handles: { sel: Selected; x: number; y: number; w: number; h: number }[] = [
    ...(Object.keys(layout.boxes) as CardBox[]).map((k) => ({ sel: { kind: 'box', key: k } as Selected, ...layout.boxes[k] })),
    { sel: { kind: 'banner' }, ...layout.bannerBox },
    ...(Object.keys(layout.text) as CardField[]).filter((k) => k !== 'banner').map((k) => { const t = layout.text[k]; const w = Math.max(60, t.size * 4); return { sel: { kind: 'text', key: k } as Selected, x: t.anchor === 'middle' ? t.x - w / 2 : t.anchor === 'end' ? t.x - w : t.x, y: t.y - t.size, w, h: t.size * 1.15 }; }),
  ];
  const active = selected ? handles.find((h) => JSON.stringify(h.sel) === JSON.stringify(selected)) : undefined;
  const sel = selected ? posOf(selected) as Record<string, number | boolean | string | undefined> : null;
  const shown = queue.filter((r) => !filter || `${r.pet_name} ${r.owner_name} ${r.owner_email}`.toLowerCase().includes(filter.toLowerCase()));

  return (
    <article className="panel wide adminLivePanel cardDesk">
      <div className="panelTitleRow"><div><p className="eyebrow">Admin · card desk</p><h3 style={{ margin: 0 }}>Pet license cards</h3></div></div>
      {message && <p className="authMessage" role="status">{message}</p>}
      <div className="cardDeskBar">
        <label>Dog<input list="card-queue" value={filter} onChange={(e) => { setFilter(e.target.value); const hit = queue.find((r) => r.pet_name === e.target.value); if (hit) setPetId(hit.pet_id); }} placeholder={`${queue.length} dogs · type a name`} /><datalist id="card-queue">{shown.slice(0, 50).map((r) => <option key={r.pet_id} value={r.pet_name}>{r.owner_name || r.owner_email || 'Guest dog'}</option>)}</datalist></label>
        <label>State template<select value={state} onChange={(e) => setState(e.target.value)}>{US_STATES.map((s) => <option key={s.code} value={s.code}>{s.code} · {s.name}{templates[s.code] ? ' (custom)' : ''}</option>)}</select></label>
        <label className="toggleRow"><input type="checkbox" checked={bleed} onChange={(e) => setBleed(e.target.checked)} /> 1/8" bleed</label>
        <label>Issued<input type="date" value={issued} onChange={(e) => setIssued(e.target.value)} /></label>
        <button type="button" className={gallery ? 'primary' : ''} onClick={() => setGallery(!gallery)}>{gallery ? 'Back to editor' : `All ${US_STATES.length} templates`}</button>
      </div>
      {row && missing.length > 0 && <p className="notice">Missing on this profile: {missing.join(', ')}. Fill them in the account sheet or ask the owner.</p>}

      {gallery && <div className="templateGallery">{US_STATES.map((st) => { const t = templates[st.code]; return (
        <button key={st.code} type="button" className={`templateTile ${st.code === state ? 'current' : ''}`} onClick={() => { setState(st.code); setGallery(false); }}>
          <IdCardSvg data={{ ...data, state: st.code }} layout={mergeLayout(t?.layout)} background={t?.background_url || null} />
          <span><strong>{st.code} · {st.name}</strong><em className={t ? 'custom' : ''}>{t ? (t.background_url ? 'Custom art + layout' : 'Custom layout') : 'MyPetID default'}</em></span>
        </button>
      ); })}</div>}
      {!gallery && <div className="cardStage">
        <div className="cardCanvas">
          <IdCardSvg data={data} layout={layout} background={background} />
          <svg ref={overlay} className="cardHandles" viewBox={`0 0 ${CARD_W} ${CARD_H}`} onPointerMove={onMove} onPointerUp={() => { drag.current = null; }} onPointerLeave={() => { drag.current = null; }}>
            {handles.map((h, i) => <rect key={i} x={h.x} y={h.y} width={h.w} height={h.h} className={JSON.stringify(h.sel) === JSON.stringify(selected) ? 'on' : ''} onPointerDown={(e) => startDrag(h.sel, e)}><title>{FIELD_LABELS[h.sel?.kind === 'banner' ? 'banner' : (h.sel as { key: string }).key]}</title></rect>)}
            {active && <g className="resizeGrips">
              <rect className="grip ew" x={active.x + active.w - 7} y={active.y + active.h / 2 - 7} width={14} height={14} onPointerDown={(e) => startResize(active.sel, 'w', e)}><title>Drag to change width</title></rect>
              <rect className="grip ns" x={active.x + active.w / 2 - 7} y={active.y + active.h - 7} width={14} height={14} onPointerDown={(e) => startResize(active.sel, 'h', e)}><title>Drag to change height</title></rect>
              <rect className="grip nwse" x={active.x + active.w - 9} y={active.y + active.h - 9} width={18} height={18} onPointerDown={(e) => startResize(active.sel, 'wh', e)}><title>Drag to resize</title></rect>
            </g>}
          </svg>
        </div>
        <div className="cardTools">
          <h4>{selected ? FIELD_LABELS[selected.kind === 'banner' ? 'banner' : selected.key] : 'Tap a field on the card'}</h4>
          {sel && <div className="cardNums">
            <label>X<input type="number" value={Number(sel.x)} onChange={(e) => patchSelected({ x: Number(e.target.value) })} /></label>
            <label>Y<input type="number" value={Number(sel.y)} onChange={(e) => patchSelected({ y: Number(e.target.value) })} /></label>
            {'size' in sel && <label>Size<input type="number" value={Number(sel.size)} onChange={(e) => patchSelected({ size: Number(e.target.value) })} /></label>}
            {'w' in sel && <label>W<input type="number" value={Number(sel.w)} onChange={(e) => patchSelected({ w: Number(e.target.value) })} /></label>}
            {'h' in sel && <label>H<input type="number" value={Number(sel.h)} onChange={(e) => patchSelected({ h: Number(e.target.value) })} /></label>}
            {'size' in sel && <label>Color<input type="color" value={String(sel.color || '#141414')} onChange={(e) => patchSelected({ color: e.target.value })} /></label>}
            <label className="toggleRow"><input type="checkbox" checked={Boolean(sel.hidden)} onChange={(e) => patchSelected({ hidden: e.target.checked })} /> Hide</label>
          </div>}
          <label>Background for {state} (1088 x 714 px with bleed)<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => upload(e.target.files?.[0])} /></label>
          <div className="actions compact">
            {background && <button type="button" onClick={() => setBackground(null)}>Use MyPetID artwork</button>}
            <button type="button" onClick={() => setLayout(DEFAULT_LAYOUT)}>Reset layout</button>
            <button type="button" onClick={() => setLayout(ARTWORK_LAYOUT)} title="For art with the state name and banner already drawn in (template kit layout)">Artwork layout</button>
            <button className="primary" type="button" onClick={save}>Save {state} template</button>
          </div>
          <div className="actions compact">
            <button className="primary" type="button" onClick={exportPng}>Download print PNG</button>
            <button type="button" onClick={copyInfo}>Copy card info</button>
          </div>
          <p className="formHint">Exports at 300 dpi ({bleed ? '3.625 x 2.375 in with bleed' : '3.375 x 2.125 in'}). Templates you save are used for every dog in that state.</p>
        </div>
      </div>}
      {/* Hidden full-size copy used for export (bleed toggle applies here). */}
      <div className="cardExportHost" aria-hidden="true"><IdCardSvg id="card-export" data={data} layout={layout} background={background} bleed={bleed} /></div>
    </article>
  );
}
