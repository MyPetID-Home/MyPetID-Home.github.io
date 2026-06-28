"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabase';

type Pet = {
  id: string;
  owner_id?: string | null;
  name: string;
  breed: string | null;
  photo_url: string | null;
  medical_public: string | null;
  behavior_public: string | null;
  lost_mode: boolean;
};

type TagRecord = { id: string; tag_code: string; pet: Pet | Pet[] | null };

const fallbackPet: Pet = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Clyde',
  breed: 'Good boy mix',
  photo_url: '/images/dog/Clyde.png',
  medical_public: 'Sensitive stomach. Avoid rich treats unless needed for safety.',
  behavior_public: 'Friendly, loves tug, nervous around loud trucks.',
  lost_mode: false,
};

function readTag() {
  if (typeof window === 'undefined') return 'demo-tag-001';
  return new URLSearchParams(window.location.search).get('tag') || 'demo-tag-001';
}

function scannerInstallId() {
  if (typeof window === 'undefined') return 'server';
  const key = 'mypetid.installId';
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const next = `web-${crypto.randomUUID()}`;
  window.localStorage.setItem(key, next);
  return next;
}

export function ScanLanding() {
  const tag = readTag();
  const [tagId, setTagId] = useState<string | null>(null);
  const [pet, setPet] = useState<Pet>(fallbackPet);
  const [status, setStatus] = useState('No location has been saved from this visit. Tap the consent button if you want to help update the scan trail.');
  const [actor, setActor] = useState<'owner' | 'linked_user' | 'stranger'>('stranger');
  const [saving, setSaving] = useState(false);
  const [reportedLost, setReportedLost] = useState(false);
  const [finderNote, setFinderNote] = useState('I found this dog here.');
  const [finderContact, setFinderContact] = useState('');
  const profileUrl = useMemo(() => `/pet/?tag=${encodeURIComponent(tag)}`, [tag]);
  const dashboardUrl = useMemo(() => `/dashboard/?tag=${encodeURIComponent(tag)}`, [tag]);

  useEffect(() => {
    async function loadPet() {
      if (!supabase) return;
      const { data, error } = await supabase
        .from('tags')
        .select('id,tag_code,pet:pets(id,owner_id,name,breed,photo_url,medical_public,behavior_public,lost_mode)')
        .eq('tag_code', tag)
        .maybeSingle();
      if (!error && data) {
        const record = data as TagRecord;
        setTagId(record.id);
        const loaded = Array.isArray(record.pet) ? record.pet[0] : record.pet;
        if (loaded) {
          setPet(loaded);
          const { data: auth } = await supabase.auth.getUser();
          if (auth.user?.id && loaded.owner_id === auth.user.id) {
            setActor('owner');
            setStatus('Owner session detected. You can log an owner scan without sharing finder GPS.');
          } else if (auth.user?.id) {
            const fingerprint = scannerInstallId();
            const { data: device } = await supabase.from('devices').select('trusted').eq('profile_id', auth.user.id).eq('device_fingerprint', fingerprint).maybeSingle();
            if (device?.trusted) {
              setActor('linked_user');
              setStatus('Trusted browser detected. Finder GPS still requires an explicit consent tap.');
            }
          }
        }
      }
    }
    loadPet();
  }, [tag]);

  async function savePosition(position: GeolocationPosition, note: string) {
    const coords = position.coords;
    const installId = scannerInstallId();
    const payload = {
      tag_id: tagId,
      pet_id: pet.id,
      actor,
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy_meters: coords.accuracy,
      reported_lost: reportedLost,
      note: `${note}; finder_note=${finderNote || 'none'}; finder_contact=${finderContact || 'not provided'}; install=${installId}`,
    };
    if (!supabase) {
      setStatus(`Demo only: ${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)} would be saved after Supabase config loads.`);
      return;
    }
    const { error } = await supabase.from('scan_events').insert(payload);
    if (error) setStatus(`Location captured, but Supabase blocked the save: ${error.message}`);
    else setStatus(reportedLost ? `🔴 Lost/found report sent with location: ${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}. The owner dashboard can show this as a red alert.` : `Saved scan location: ${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}. Thank you for helping ${pet.name}.`);
  }

  function requestLocation(note: string) {
    if (!navigator.geolocation) {
      setStatus('This browser does not expose location services. You can still view the public profile and contact the owner.');
      return;
    }
    setSaving(true);
    setStatus('Waiting for this device to approve location permission…');
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        await savePosition(position, note);
        setSaving(false);
      },
      () => {
        setStatus('Location permission was denied or unavailable. Nothing was saved from this visit.');
        setSaving(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  }

  return (
    <main className="publicShell scanLanding">
      <section className="publicHero">
        <Link className="brandLockup" href="/"><img src="/images/logo/MyPetID-Logo_Resized.jpg" alt="MyPetID" /><span>MyPetID</span></Link>
        <div className="scanCard">
          <div className="scanPhotoWrap"><img src={pet.photo_url || '/images/dog/Clyde.png'} alt={pet.name} /><span className="scanPulse" /></div>
          <div>
            <p className="eyebrow">NFC/QR scan gate • tag {tag}</p>
            <h1>{pet.name}</h1>
            <p className="lead">This scan page does not save GPS on load. Location is saved only after the finder taps a consent button and the browser grants permission. Current actor: {actor.replace('_', ' ')}.</p>
            <div className="lostRibbon">{pet.lost_mode ? 'Marked lost — share sighting if safe' : 'Public profile ready — optional scan trail update'}</div>
          </div>
        </div>
      </section>

      <section className="publicGrid">
        <article className="panel wide consentPanel">
          <h2>Help update the scan trail</h2>
          <p>Accidental opens, refreshes, previews, and owner checks should not pollute the last-location history. That is why the NFC tag should point here first, while the normal profile remains read-only.</p>
          <label className="toggleRow"><input type="checkbox" checked={reportedLost} onChange={(event) => setReportedLost(event.target.checked)} /> I found this dog / I am reporting a lost-pet sighting</label>
          <label>Finder note<textarea value={finderNote} onChange={(event) => setFinderNote(event.target.value)} /></label>
          <label>Optional finder contact<input value={finderContact} onChange={(event) => setFinderContact(event.target.value)} placeholder="phone or email, optional" /></label>
          <div className="actions">
            <button className="primary" type="button" disabled={saving} onClick={() => requestLocation(reportedLost ? 'Finder reported lost sighting from scan gate' : 'Finder consented from scan gate')}>{saving ? 'Requesting…' : 'Share my scan location'}</button>
            <Link className="button" href={profileUrl}>View profile without sharing location</Link>
            <Link className="button" href={dashboardUrl}>I am the owner</Link>
          </div>
          <p className="notice">{status}</p>
        </article>

        <article className="panel">
          <h2>Visible now</h2>
          <dl className="infoList"><dt>Pet</dt><dd>{pet.name} • {pet.breed || 'breed not listed'}</dd><dt>Behavior</dt><dd>{pet.behavior_public || 'No public behavior note yet.'}</dd><dt>Medical</dt><dd>{pet.medical_public || 'No public medical note yet.'}</dd></dl>
        </article>

        <article className="panel">
          <h2>Privacy rule</h2>
          <p>The regular public profile mimics this page visually, but cannot write scan GPS. Only this consent gate can create a scan event.</p>
          <p>Next production step: move final scan writes into a Supabase Edge Function so tier checks, bot filtering, and abuse limits happen server-side.</p>
        </article>
      </section>
    </main>
  );
}
