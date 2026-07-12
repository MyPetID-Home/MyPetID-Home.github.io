"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabase';
import { isServiceRestrictionMessage, queueFallbackSync } from '../lib/fallback-local';

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
type DeviceRecord = { trusted: boolean; label?: string | null };

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

function readScanMode() {
  if (typeof window === 'undefined') return 'finder';
  return new URLSearchParams(window.location.search).get('mode') || 'finder';
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
  const scanMode = readScanMode();
  const [tagId, setTagId] = useState<string | null>(null);
  const [pet, setPet] = useState<Pet>(fallbackPet);
  const [status, setStatus] = useState(scanMode === 'owner' ? 'Owner/profile mode: no location is requested on load. Use dashboard walk/lost buttons when you want to share from this device.' : 'Finder tag scan: do you want to share this scan location with the owner? Nothing is saved until you tap consent and the browser grants GPS.');
  const [actor, setActor] = useState<'owner' | 'linked_user' | 'stranger'>('stranger');
  const [saving, setSaving] = useState(false);
  const [reportedLost, setReportedLost] = useState(scanMode !== 'owner');
  const [finderNote, setFinderNote] = useState('I found this dog here.');
  const [finderContact, setFinderContact] = useState('');
  const [consentDismissed, setConsentDismissed] = useState(scanMode === 'owner');
  const profileUrl = useMemo(() => `/pet/?tag=${encodeURIComponent(tag)}&mode=owner`, [tag]);
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
            const fingerprint = scannerInstallId();
            const { data: device } = await supabase.from('devices').select('trusted,label').eq('profile_id', auth.user.id).eq('device_fingerprint', fingerprint).maybeSingle() as { data: DeviceRecord | null };
            setActor('owner');
            setConsentDismissed(true);
            setStatus(device?.trusted ? 'Linked owner device detected. No finder popup shown and no recent finder scan was created.' : 'Owner session detected. No finder popup shown; trust this browser in the dashboard if you want it remembered as a linked device.');
          } else if (auth.user?.id) {
            const fingerprint = scannerInstallId();
            const { data: device } = await supabase.from('devices').select('trusted,label').eq('profile_id', auth.user.id).eq('device_fingerprint', fingerprint).maybeSingle() as { data: DeviceRecord | null };
            if (device?.trusted) {
              setActor('linked_user');
              setConsentDismissed(true);
              setStatus('Linked helper/trusted device detected. No finder popup shown and no recent finder scan was created.');
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
      actor: 'stranger',
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy_meters: coords.accuracy,
      reported_lost: reportedLost,
      note: `${note}; install=${installId}`,
      finder_note: finderNote || null,
      finder_contact: finderContact || null,
      found_status: reportedLost ? 'Found report received' : 'scan_only',
      owner_follow_up: reportedLost ? 'Needs owner review' : 'not_required',
    };
    if (!supabase) {
      queueFallbackSync('scan_event', `Finder scan queued for ${pet.name}`, payload);
      setStatus(`Location captured on this device: ${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}. Cloud save is paused; this scan is queued locally for later sync.`);
      return;
    }
    const { error } = await supabase.from('scan_events').insert(payload);
    if (error && isServiceRestrictionMessage(error.message)) {
      queueFallbackSync('scan_event', `Finder scan queued for ${pet.name}`, payload);
      setStatus(`Location captured, but cloud save is restricted. This scan is queued locally for later sync.`);
    } else if (error) setStatus(`Location captured, but cloud save needs attention: ${error.message}`);
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

  function acceptFinderLocation() {
    setConsentDismissed(true);
    requestLocation(reportedLost ? 'Finder reported lost sighting from finder tag URL' : 'Finder consented from finder tag URL');
  }

  function denyFinderLocation() {
    setConsentDismissed(true);
    setStatus('Location sharing denied for this scan. The profile is visible and nothing was saved from this visit.');
  }

  return (
    <main className={`publicShell scanLanding ${!consentDismissed ? 'finderConsentActive' : ''}`}>
      {!consentDismissed && <div className="finderConsentOverlay" role="dialog" aria-modal="true" aria-labelledby="finder-consent-title">
        <div className="finderConsentModal">
          <span className="finderConsentDog" aria-hidden="true">🐶</span>
          <p className="eyebrow">Lost/found scan consent</p>
          <h2 id="finder-consent-title">Share this scan location?</h2>
          <p>A finder scan can help the owner locate {pet.name}. Choose Accept to ask this device for GPS permission, or Deny to view the profile without sharing location.</p>
          <div className="actions consentChoices"><button className="primary" type="button" disabled={saving} onClick={acceptFinderLocation}>{saving ? 'Requesting…' : 'Accept & share location'}</button><button type="button" onClick={denyFinderLocation}>Deny, view profile only</button></div>
          <small>No GPS is saved unless you accept and the browser grants permission.</small>
        </div>
      </div>}
      <div className="scanProfileFrame" aria-hidden={!consentDismissed}>
      <section className="publicHero">
        <Link className="brandLockup" href="/"><img src="/images/logo/MyPetID-Logo_Resized.jpg" alt="MyPetID" /><span>MyPetID</span></Link>
        <div className="scanCard">
          <div className="scanPhotoWrap"><img src={pet.photo_url || '/images/dog/Clyde.png'} alt={pet.name} /><span className="scanPulse" /></div>
          <div>
            <p className="eyebrow">{scanMode === 'owner' ? 'Owner profile route' : 'Finder NFC/QR scan gate'} • tag {tag}</p>
            <h1>{pet.name}</h1>
            <p className="lead">{scanMode === 'owner' ? 'Owner/profile mode does not request GPS on load. Location is only requested after owner actions like walk tracking or lost reporting.' : 'Finder/lost mode asks whether the scanner wants to share location data with the owner. Nothing is saved until consent is tapped and the browser grants permission.'} Current actor: {actor.replace('_', ' ')}.</p>
            <div className="lostRibbon">{scanMode === 'owner' ? 'Owner-safe profile link — no automatic location prompt' : pet.lost_mode || reportedLost ? 'Lost/found scan — share sighting if safe' : 'Public scan gate — optional scan trail update'}</div>
          </div>
        </div>
      </section>

      <section className="publicGrid">
        <article className="panel wide consentPanel">
          <h2>{scanMode === 'owner' ? 'Owner route: no automatic GPS' : 'Share this scan location?'}</h2>
          <p>{scanMode === 'owner' ? 'This link is safe for the owner to bookmark or scan. It does not ask for location data until the owner clicks a location feature in the dashboard.' : 'This is the stranger/finder tag URL. It asks for location sharing because a lost or found pet scan can help the owner, but the scanner still controls consent.'}</p>
          <label className="toggleRow"><input type="checkbox" checked={reportedLost} onChange={(event) => setReportedLost(event.target.checked)} /> I found this dog / I am reporting a lost-pet sighting</label>
          <label>Finder note<textarea value={finderNote} onChange={(event) => setFinderNote(event.target.value)} /></label>
          <label>Optional finder contact<input value={finderContact} onChange={(event) => setFinderContact(event.target.value)} placeholder="phone or email, optional" /></label>
          <div className="actions">
            {scanMode !== 'owner' && <button className="primary" type="button" disabled={saving} onClick={acceptFinderLocation}>{saving ? 'Requesting…' : 'Share scan location'}</button>}
            <Link className="button" href={profileUrl}>{scanMode === 'owner' ? 'Open owner profile' : 'View profile without sharing location'}</Link>
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
          <p>Final cloud processing will run through the server so tier checks, bot filtering, and abuse limits happen before scan events are stored.</p>
        </article>
      </section>
      </div>
    </main>
  );
}
