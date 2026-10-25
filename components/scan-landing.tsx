"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Heart, MapPinned, PawPrint, ShieldCheck } from './icons';
import { supabase } from '../lib/supabase';
import { isServiceRestrictionMessage, queueFallbackSync } from '../lib/fallback-local';
import { fetchPublicPet, submitFinderReport, type PublicPet } from '../lib/public-pet';

type Pet = {
  id: string;
  name: string;
  breed: string | null;
  photo_url: string | null;
  medical_public: string | null;
  behavior_public: string | null;
  lost_mode: boolean;
};

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

const DEMO_TAG = 'demo-tag-001';

// Shown when a real (non-demo) tag cannot be loaded, so a finder never sees the
// demo dog in place of the pet they actually found.
const unknownPet: Pet = { id: '', name: 'this pet', breed: null, photo_url: null, medical_public: null, behavior_public: null, lost_mode: false };

const OWNER_STATUS = '';
const FINDER_STATUS = 'Finder tag scan: do you want to share this scan location with the owner? Nothing is saved until you tap consent and the browser grants GPS.';

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
  // Query params are read after mount; reading window.location during render
  // caused React hydration error #418 on the statically exported page.
  const [query, setQuery] = useState<{ tag: string; scanMode: string } | null>(null);
  const tag = query?.tag ?? DEMO_TAG;
  const scanMode = query?.scanMode ?? 'finder';
  const [tagId, setTagId] = useState<string | null>(null);
  const [pet, setPet] = useState<Pet>(unknownPet);
  const [petLoaded, setPetLoaded] = useState(false);
  const [status, setStatus] = useState(FINDER_STATUS);
  const [actor, setActor] = useState<'owner' | 'linked_user' | 'stranger'>('stranger');
  const [saving, setSaving] = useState(false);
  const [reportedLost, setReportedLost] = useState(true);
  const [finderNote, setFinderNote] = useState('I found this dog here.');
  const [finderContact, setFinderContact] = useState('');
  const [consentDismissed, setConsentDismissed] = useState(false);
  const profileUrl = useMemo(() => `/pet/?tag=${encodeURIComponent(tag)}&mode=owner`, [tag]);
  const dashboardUrl = useMemo(() => `/dashboard/?tag=${encodeURIComponent(tag)}`, [tag]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nextMode = params.get('mode') || 'finder';
    setQuery({ tag: params.get('tag') || DEMO_TAG, scanMode: nextMode });
    if (nextMode === 'owner') {
      setStatus(OWNER_STATUS);
      setReportedLost(false);
      setConsentDismissed(true);
    }
  }, []);

  useEffect(() => {
    if (!query) return;
    async function loadPet() {
      if (!supabase) {
        setPet(tag === DEMO_TAG ? fallbackPet : unknownPet);
        return;
      }
      // pets/tags are not publicly readable; get_public_pet returns the public
      // fields and whether the signed-in user owns the pet.
      const record: PublicPet | null = await fetchPublicPet({ tagCode: tag });
      if (record) {
        setTagId(record.tag_id);
        {
          const loaded = record;
          setPet({ id: loaded.id, name: loaded.name, breed: loaded.breed, photo_url: loaded.photo_url, medical_public: loaded.medical_public, behavior_public: loaded.behavior_public, lost_mode: loaded.lost_mode });
          const { data: auth } = await supabase.auth.getUser();
          if (auth.user?.id && loaded.is_owner) {
            const fingerprint = scannerInstallId();
            const { data: device } = await supabase.from('devices').select('trusted,label').eq('profile_id', auth.user.id).eq('device_fingerprint', fingerprint).maybeSingle() as { data: DeviceRecord | null };
            setActor('owner');
            setConsentDismissed(true);
            setStatus('This is your dog. Scans from your own account are never sent as finder reports.');
          } else if (auth.user?.id) {
            const fingerprint = scannerInstallId();
            const { data: device } = await supabase.from('devices').select('trusted,label').eq('profile_id', auth.user.id).eq('device_fingerprint', fingerprint).maybeSingle() as { data: DeviceRecord | null };
            if (device?.trusted) {
              setActor('linked_user');
              setConsentDismissed(true);
              setStatus('You’re signed in on a trusted device for this dog, so no finder report was created.');
            }
          }
          return;
        }
      }
      setPet(tag === DEMO_TAG ? fallbackPet : unknownPet);
    }
    loadPet().catch(() => setPet(tag === DEMO_TAG ? fallbackPet : unknownPet)).finally(() => setPetLoaded(true));
  }, [query, tag]);

  async function savePosition(position: GeolocationPosition, note: string) {
    const coords = position.coords;
    const installId = scannerInstallId();
    // Arguments for the submit_finder_report RPC, which validates the report,
    // rate-limits per tag and derives pet/actor server-side.
    const payload = {
      p_tag_code: tag,
      p_latitude: coords.latitude,
      p_longitude: coords.longitude,
      p_accuracy_meters: coords.accuracy,
      p_reported_lost: reportedLost,
      p_note: `${note}; install=${installId}`,
      p_finder_note: finderNote || null,
      p_finder_contact: finderContact || null,
    };
    if (!supabase) {
      queueFallbackSync('scan_event', `Finder scan queued for ${pet.name}`, payload);
      setStatus(`We couldn’t reach MyPetID, so the report wasn’t sent. Please contact local animal control or a nearby shelter. Your location: ${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}.`);
      return;
    }
    if (!tagId) {
      queueFallbackSync('scan_event', `Finder scan queued for tag ${tag}`, payload);
      setStatus(`Location captured: ${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}. MyPetID could not confirm an owner for this tag, so the report could not be delivered. Please contact local animal control or a nearby shelter.`);
      return;
    }
    const errorMessage = await submitFinderReport(payload, { tagId, petId: pet.id || null });
    const error = errorMessage ? { message: errorMessage } : null;
    if (error && isServiceRestrictionMessage(error.message)) {
      queueFallbackSync('scan_event', `Finder scan queued for ${pet.name}`, payload);
      setStatus('We couldn’t reach MyPetID, so the report wasn’t sent. Please contact local animal control or a nearby shelter.');
    } else if (error) setStatus(`The report couldn’t be sent: ${error.message}`);
    else setStatus(reportedLost ? `Thank you! ${pet.name}’s owner has been alerted with your location.` : `Thanks for checking on ${pet.name}. Your scan was shared with the owner.`);
  }

  function requestLocation(note: string) {
    if (!navigator.geolocation) {
      setStatus('This browser can’t share a location, but you can still see the profile and contact the owner.');
      return;
    }
    setSaving(true);
    setStatus('Waiting for you to allow location on this device…');
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        await savePosition(position, note);
        setSaving(false);
      },
      () => {
        setStatus('Location wasn’t shared, so nothing was sent. You can still contact the owner.');
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
    setStatus('No problem. Nothing was shared. You can still see the profile below.');
  }

  const petName = pet.id ? pet.name : petLoaded ? 'this pet' : 'this pet';
  return (
    <main className={`publicShell scanLanding ${!consentDismissed ? 'finderConsentActive' : ''}`}>
      {!consentDismissed && <div className="finderConsentOverlay" role="dialog" aria-modal="true" aria-labelledby="finder-consent-title">
        <div className="finderConsentModal">
          <span className="finderConsentDog" aria-hidden="true"><PawPrint /></span>
          <p className="eyebrow">You scanned a MyPetID tag</p>
          <h2 id="finder-consent-title">Help {petName} get home?</h2>
          <p>Sharing where you are right now lets the owner know their dog was found. It’s optional and only happens if you allow it.</p>
          <div className="actions consentChoices"><button className="primary" type="button" disabled={saving} onClick={acceptFinderLocation}><MapPinned /> {saving ? 'Requesting…' : 'Share my location'}</button><button type="button" onClick={denyFinderLocation}>Just view the profile</button></div>
          <small className="formHint">Nothing is shared unless you tap “Share my location” and your browser allows it.</small>
        </div>
      </div>}
      <div className="scanProfileFrame" aria-hidden={!consentDismissed}>
      <section className="publicHero">
        <Link className="brandLockup" href="/"><img src="/images/logo/MyPetID-Logo_Resized.jpg" alt="" /><span>MyPet<b>ID</b></span></Link>
        <div className="scanCard">
          <div className="scanPhotoWrap"><img src={pet.photo_url || '/images/logo/MyPetID-Logo_Resized.jpg'} alt={pet.id ? pet.name : 'MyPetID'} /><span className="scanPulse" /></div>
          <div>
            <p className="eyebrow">{scanMode === 'owner' ? 'Your tag page' : 'Hi, my name is'} · tag {tag}</p>
            <h1>{pet.id ? pet.name : petLoaded ? 'Pet profile unavailable' : 'Loading…'}</h1>
            {pet.behavior_public && <p className="lead">{pet.behavior_public}</p>}
            <div className="lostRibbon" style={pet.lost_mode ? { background: 'var(--danger-soft)', color: 'var(--danger)' } : undefined}>{pet.lost_mode ? <><PawPrint /> I’m lost! Please help me get home.</> : <><Heart /> Thanks for scanning my tag!</>}</div>
          </div>
        </div>
      </section>

      <section className="publicGrid">
        <article className="panel wide consentPanel">
          <div className="panelTitleRow"><h2>{scanMode === 'owner' ? 'Your tag page' : 'Send the owner a note'}</h2><span className="iconBubble"><MapPinned /></span></div>
          <p>{scanMode === 'owner' ? 'This is what people see when they scan your dog’s tag. It never asks you for your location.' : 'Let the owner know where and how you found their dog. Adding your phone or email helps them reach you.'}</p>
          {scanMode !== 'owner' && <>
            <label className="toggleRow"><input type="checkbox" checked={reportedLost} onChange={(event) => setReportedLost(event.target.checked)} /> I found this dog</label>
            <label>Your note<textarea value={finderNote} onChange={(event) => setFinderNote(event.target.value)} /></label>
            <label>Your phone or email (optional)<input value={finderContact} onChange={(event) => setFinderContact(event.target.value)} placeholder="So the owner can reach you" /></label>
          </>}
          <div className="actions">
            {scanMode !== 'owner' && <button className="primary" type="button" disabled={saving} onClick={acceptFinderLocation}><MapPinned /> {saving ? 'Requesting…' : 'Send with my location'}</button>}
            <Link className="button" href={profileUrl}>View full profile</Link>
            <Link className="button ghost" href={dashboardUrl}>I’m the owner</Link>
          </div>
          {status && status !== FINDER_STATUS && <p className="authMessage" role="status">{status}</p>}
        </article>

        <article className="panel wide publicInfoCard">
          <div className="panelTitleRow"><h2>About {petName}</h2><span className="iconBubble green"><ShieldCheck /></span></div>
          <dl className="infoList"><dt>Breed</dt><dd>{pet.breed || 'Not listed'}</dd><dt>Personality</dt><dd>{pet.behavior_public || 'No public note yet.'}</dd><dt>Health notes</dt><dd>{pet.medical_public || 'No public health notes.'}</dd></dl>
          <p className="formHint">Only the details the owner chose to make public are shown here.</p>
        </article>
      </section>
      </div>
    </main>
  );
}
