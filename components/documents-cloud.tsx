"use client";

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { BottomSheet } from './memo-layout';
import { MascotPeek } from './mascot';
import { FileText, Plus } from './icons';

/**
 * Pet documents saved to the account: files go to the private `medical-documents` bucket under
 * `<owner id>/<pet id>/...` and a row in pet_documents. Files are opened with short-lived signed links.
 */
export type CloudDoc = { id: string; pet_id: string; title: string; document_type: string | null; storage_path: string | null; expires_at: string | null; created_at: string };
export const DOC_TYPES = ['Vaccine', 'Rabies certificate', 'Vet visit', 'Lab result', 'Medication', 'Microchip', 'License', 'Insurance', 'Service / therapy', 'Adoption / rescue', 'Other'];
const BUCKET = 'medical-documents';
const MAX_MB = 50;

export const DOC_EVENT = 'mypetid:docs';

export function useCloudDocs() {
  const [pet, setPet] = useState<{ id: string; owner_id: string; name: string } | null>(null);
  const [docs, setDocs] = useState<CloudDoc[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false);
  const load = useCallback(async () => {
    if (!supabase) return setReady(true);
    const { data: auth } = await supabase.auth.getSession();
    const uid = auth.session?.user.id;
    if (!uid) return setReady(true);
    const { data: row } = await supabase.from('pets').select('id,owner_id,name').eq('owner_id', uid).order('created_at').limit(1).maybeSingle();
    if (!row) return setReady(true);
    setPet(row as { id: string; owner_id: string; name: string });
    const { data } = await supabase.from('pet_documents').select('id,pet_id,title,document_type,storage_path,expires_at,created_at').eq('pet_id', row.id).order('created_at', { ascending: false });
    const list = (data || []) as CloudDoc[];
    setDocs(list);
    setReady(true);
    const images = list.filter((d) => d.storage_path && /\.(png|jpe?g|webp)$/i.test(d.storage_path));
    if (images.length) {
      const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(images.map((d) => d.storage_path!), 3600);
      setThumbs(Object.fromEntries((signed || []).map((s, i) => [images[i].id, s.signedUrl || ''])));
    }
  }, []);
  useEffect(() => {
    void load();
    const reload = () => void load();
    window.addEventListener(DOC_EVENT, reload);
    return () => window.removeEventListener(DOC_EVENT, reload);
  }, [load]);
  return { pet, docs, thumbs, ready, reload: load };
}

function expiryNote(date: string | null) {
  if (!date) return '';
  const days = Math.round((new Date(`${date}T12:00:00`).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return `Expired ${new Date(`${date}T12:00:00`).toLocaleDateString()}`;
  if (days <= 30) return `Expires in ${days} day${days === 1 ? '' : 's'}`;
  return `Expires ${new Date(`${date}T12:00:00`).toLocaleDateString()}`;
}

export function DocumentsCloud() {
  const { pet, docs, thumbs, ready, reload } = useCloudDocs();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ title: '', type: 'Vaccine', expires: '', file: null as File | null });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [open, setOpen] = useState<CloudDoc | null>(null);

  if (!supabase || !ready) return null;
  if (!pet) return <section className="memoCard full"><header className="memoCardHead"><h3>Documents</h3></header><p className="formHint">Sign in and add your dog to your account to keep vaccine records, licenses and other files safe in the cloud.</p></section>;

  async function upload(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase || !pet || !draft.file) return;
    if (draft.file.size > MAX_MB * 1024 * 1024) return setMessage(`Files can be up to ${MAX_MB} MB.`);
    setBusy(true); setMessage('');
    const ext = (draft.file.name.split('.').pop() || 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `${pet.owner_id}/${pet.id}/${Date.now()}.${ext}`;
    const { error: upError } = await supabase.storage.from(BUCKET).upload(path, draft.file, { contentType: draft.file.type, upsert: false });
    if (upError) { setBusy(false); return setMessage(upError.message.includes('mime') ? 'Use a PDF, JPG, PNG or WebP file.' : upError.message); }
    const title = draft.title.trim() || draft.file.name.replace(/\.[^.]+$/, '');
    const { error } = await supabase.from('pet_documents').insert({ pet_id: pet.id, owner_id: pet.owner_id, title, document_type: draft.type, storage_path: path, public_visible: false, expires_at: draft.expires || null });
    setBusy(false);
    if (error) { await supabase.storage.from(BUCKET).remove([path]); return setMessage(error.message); }
    setDraft({ title: '', type: 'Vaccine', expires: '', file: null });
    setAdding(false);
    setMessage(`Saved “${title}”.`);
    window.dispatchEvent(new CustomEvent(DOC_EVENT));
    void reload();
  }
  async function view(doc: CloudDoc) {
    if (!supabase || !doc.storage_path) return;
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(doc.storage_path, 300);
    if (error || !data) return setMessage(error?.message || 'Could not open the file.');
    window.open(data.signedUrl, '_blank', 'noopener');
  }
  async function remove(doc: CloudDoc) {
    if (!supabase || !window.confirm(`Delete “${doc.title}”? The file is removed from your account.`)) return;
    const { error } = await supabase.from('pet_documents').delete().eq('id', doc.id);
    if (error) return setMessage(error.message);
    if (doc.storage_path) await supabase.storage.from(BUCKET).remove([doc.storage_path]);
    setOpen(null); setMessage('Deleted.');
    window.dispatchEvent(new CustomEvent(DOC_EVENT));
    void reload();
  }

  return (
    <section className="memoCard full">
      <header className="memoCardHead"><h3>{pet.name}’s documents</h3><span className="memoCardIcon"><FileText /></span></header>
      <p className="formHint">Vaccine records, licenses, insurance and vet papers, saved privately to your account. Only you (and MyPetID support) can open them.</p>
      {message && <p className="authMessage" role="status">{message}</p>}
      {adding ? (
        <form className="memoForm" onSubmit={upload}>
          <label>File (PDF or photo, up to {MAX_MB} MB)<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required onChange={(e) => setDraft({ ...draft, file: e.target.files?.[0] || null })} /></label>
          <div className="grid2">
            <label>Title<input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Rabies certificate 2026" maxLength={120} /></label>
            <label>Kind<select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>{DOC_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
            <label>Expires (optional)<input type="date" value={draft.expires} onChange={(e) => setDraft({ ...draft, expires: e.target.value })} /></label>
          </div>
          <div className="actions"><button type="button" onClick={() => setAdding(false)}>Cancel</button><button className="primary" type="submit" disabled={busy || !draft.file}>{busy ? 'Uploading…' : 'Save document'}</button></div>
        </form>
      ) : <button className="memoAdd" type="button" onClick={() => { setMessage(''); setAdding(true); }}><span><Plus /></span> Add document</button>}
      {docs.length === 0 ? <div className="memoEmpty"><MascotPeek size={54} /><p className="formHint">No documents yet.</p></div> : (
        <div className="docGrid">{docs.map((d) => (
          <button key={d.id} type="button" className="docTile" onClick={() => setOpen(d)}>
            {thumbs[d.id] ? <img src={thumbs[d.id]} alt="" loading="lazy" /> : <span className="docTileIcon"><FileText /><em>{(d.storage_path?.split('.').pop() || 'file').toUpperCase()}</em></span>}
            <strong>{d.title}</strong>
            <small>{d.document_type || 'Document'}{d.expires_at ? ` · ${expiryNote(d.expires_at)}` : ''}</small>
          </button>
        ))}</div>
      )}
      {open && <BottomSheet title={open.title} onClose={() => setOpen(null)}>
        {thumbs[open.id] && <img className="docPreview" src={thumbs[open.id]} alt={open.title} />}
        <dl className="sheetFields">
          <dt>Kind</dt><dd>{open.document_type || 'Document'}</dd>
          <dt>Added</dt><dd>{new Date(open.created_at).toLocaleDateString()}</dd>
          {open.expires_at && <><dt>Expires</dt><dd>{expiryNote(open.expires_at)}</dd></>}
        </dl>
        <div className="actions"><button className="primary" type="button" onClick={() => view(open)}>Open file</button><button type="button" className="dangerLink" onClick={() => remove(open)}>Delete</button></div>
      </BottomSheet>}
    </section>
  );
}
