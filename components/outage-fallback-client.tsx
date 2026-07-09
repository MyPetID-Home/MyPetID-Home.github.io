'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Status = { configured?: boolean; missing?: Record<string, boolean>; sheetName?: string; writeCodeRequired?: boolean; error?: string };

type SaveResult = { ok?: boolean; error?: string; queuedAt?: string; driveFile?: { id: string; webViewLink?: string } };

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('File read failed.'));
    reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
    reader.readAsDataURL(file);
  });
}

export function OutageFallbackClient() {
  const [status, setStatus] = useState<Status>({});
  const [recordType, setRecordType] = useState('pet_update');
  const [actorEmail, setActorEmail] = useState('');
  const [petName, setPetName] = useState('');
  const [tagCode, setTagCode] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [writeCode, setWriteCode] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SaveResult | null>(null);

  useEffect(() => {
    fetch('/api/fallback/google/')
      .then((response) => response.json())
      .then(setStatus)
      .catch((error) => setStatus({ error: error instanceof Error ? error.message : 'Status check failed.' }));
  }, []);

  async function saveFallback() {
    setBusy(true);
    setResult(null);
    try {
      const body: any = {
        type: recordType,
        actorEmail,
        petName,
        tagCode,
        title: title || recordType,
        payload: { notes, source: 'mypetid_outage_page', userAgent: navigator.userAgent },
      };
      if (file) body.file = { name: file.name, mime: file.type || 'application/octet-stream', base64: await fileToBase64(file) };
      const response = await fetch('/api/fallback/google/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-fallback-secret': writeCode },
        body: JSON.stringify(body),
      });
      const json = await response.json();
      setResult(json);
      if (!response.ok) throw new Error(json.error || `Save failed ${response.status}`);
      setNotes('');
      setTitle('');
      setFile(null);
    } catch (error) {
      setResult({ error: error instanceof Error ? error.message : 'Fallback save failed.' });
    } finally {
      setBusy(false);
    }
  }

  return <main className="legalPage outagePage">
    <section className="heroPanel panel wide">
      <div>
        <p className="eyebrow">Emergency mode</p>
        <h1>MyPetID outage save</h1>
        <p>Use this while Supabase is restricted. Saves go to Google Sheets, and attached files/photos go to Google Drive. We can replay the queue into Supabase when the quota is restored.</p>
        <div className="actions"><Link className="button" href="/dashboard/account/">Back to account</Link><a className="button" href="/api/fallback/google/oauth/start/">Connect Google fallback</a></div>
      </div>
    </section>

    <section className="panel wide">
      <h2>Fallback status</h2>
      <div className="routeMeta"><span>Google configured: {status.configured ? 'yes' : 'not yet'}</span><span>Sheet: {status.sheetName || 'OutageQueue'}</span><span>Write code: {status.writeCodeRequired ? 'required' : 'not configured'}</span></div>
      {status.error && <p className="notice danger">{status.error}</p>}
      {status.missing && <div className="chipCloud">{Object.entries(status.missing).map(([key, missing]) => <span key={key}>{missing ? 'Missing' : 'Ready'}: {key}</span>)}</div>}
    </section>

    <section className="panel wide">
      <h2>Queue a record</h2>
      <div className="grid2">
        <label>Record type<select value={recordType} onChange={(event) => setRecordType(event.target.value)}><option value="pet_update">Pet update</option><option value="tag_card">Tag/card</option><option value="scan_event">Scan/lost-found event</option><option value="document">Document/photo</option><option value="admin_note">Admin note</option></select></label>
        <label>Owner/admin email<input value={actorEmail} onChange={(event) => setActorEmail(event.target.value)} placeholder="real_cak3d@yahoo.com" /></label>
        <label>Pet name<input value={petName} onChange={(event) => setPetName(event.target.value)} placeholder="Clyde" /></label>
        <label>Tag/Card ID<input value={tagCode} onChange={(event) => setTagCode(event.target.value.toUpperCase())} placeholder="MPID-..." /></label>
        <label>Title<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What changed?" /></label>
        <label>Fallback write code<input value={writeCode} onChange={(event) => setWriteCode(event.target.value)} placeholder="optional rescue code" /></label>
      </div>
      <label>Notes / JSON-ish details<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Paste whatever needs to be saved for replay later." /></label>
      <label>Optional file/photo<input type="file" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label>
      <div className="actions"><button className="primary" type="button" disabled={busy} onClick={saveFallback}>{busy ? 'Saving to Google…' : 'Save to Google fallback'}</button></div>
      {result && <pre className={result.ok ? 'notice' : 'notice danger'}>{JSON.stringify(result, null, 2)}</pre>}
    </section>
  </main>;
}
