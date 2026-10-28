"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { PublicPromo } from './public-promo';
import { MapPinned, PawPrint } from './icons';
import { PetProfileCard } from './pet-profile-card';
import { PublicCareCountdown } from './care-schedule';
import { savedGuest } from '../lib/guest-pet';
import { supabase } from '../lib/supabase';
import { isServiceRestrictionMessage, queueFallbackSync } from '../lib/fallback-local';
import { fetchPublicPet, submitFinderReport, type PublicPet } from '../lib/public-pet';
import { translate, useT, type TVars } from '../lib/i18n';
import { LanguagePicker } from './language-picker';

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

// Status messages are stored as a dictionary key (plus values) and translated when rendered, so
// switching language also translates a message that is already on screen.
type StatusMsg = { key: string; vars?: TVars } | null;
const NOTE_DEFAULTS = (['en', 'es', 'fr', 'pt'] as const).map((l) => translate(l, 'scan.noteDefault'));

function scannerInstallId() {
  if (typeof window === 'undefined') return 'server';
  const key = 'mypetid.installId';
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const next = `web-${crypto.randomUUID()}`;
  window.localStorage.setItem(key, next);
  return next;
}

/**
 * `tagCode` comes from the clean public URL (/public/MPID-000001); without it the tag is read from
 * ?tag= (older /scan/ links). `publicPage` hides the owner/profile links and shows the MyPetID promo.
 */
export function ScanLanding({ tagCode, publicPage = false }: { tagCode?: string; publicPage?: boolean } = {}) {
  // Query params are read after mount; reading window.location during render
  // caused React hydration error #418 on the statically exported page.
  const [query, setQuery] = useState<{ tag: string; scanMode: string; preview: boolean } | null>(null);
  // ?preview=1: the owner looking at their own public page from the dashboard. No redirect, no reports.
  const preview = Boolean(query?.preview);
  const tag = query?.tag ?? DEMO_TAG;
  const scanMode = query?.scanMode ?? 'finder';
  const [tagId, setTagId] = useState<string | null>(null);
  const [pet, setPet] = useState<Pet>(unknownPet);
  const [petLoaded, setPetLoaded] = useState(false);
  const [record, setRecord] = useState<PublicPet | null>(null);
  const [status, setStatusMsg] = useState<StatusMsg>(null);
  const setStatus = (key: string, vars?: TVars) => setStatusMsg(key ? { key, vars } : null);
  const { t, lang } = useT();
  const [actor, setActor] = useState<'owner' | 'linked_user' | 'stranger'>('stranger');
  const [saving, setSaving] = useState(false);
  const [reportedLost, setReportedLost] = useState(true);
  const [finderNote, setFinderNote] = useState(NOTE_DEFAULTS[0]);
  const [finderContact, setFinderContact] = useState('');
  const [consentDismissed, setConsentDismissed] = useState(false);
  // The prefilled note follows the language until the finder edits it.
  useEffect(() => { setFinderNote((note) => (NOTE_DEFAULTS.includes(note) ? t('scan.noteDefault') : note)); }, [t]);
  const profileUrl = useMemo(() => `/pet/?tag=${encodeURIComponent(tag)}&mode=owner`, [tag]);
  const dashboardUrl = useMemo(() => `/dashboard/?tag=${encodeURIComponent(tag)}`, [tag]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nextMode = params.get('mode') || 'finder';
    const isPreview = params.get('preview') === '1';
    setQuery({ tag: (tagCode || params.get('tag') || DEMO_TAG).trim(), scanMode: publicPage ? 'finder' : nextMode, preview: isPreview });
    if (isPreview) setConsentDismissed(true);
    if (nextMode === 'owner') {
      setStatus('');
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
        // The owner scanning their own dog's card goes to the private profile, not the public one.
        const guest = savedGuest();
        if (!query?.preview && (record.is_owner || (guest && guest.petId === record.id))) {
          window.location.replace(`/dashboard/pet/?from=scan&tag=${encodeURIComponent(tag)}`);
          return;
        }
        setRecord(record);
        {
          const loaded = record;
          setPet({ id: loaded.id, name: loaded.name, breed: loaded.breed, photo_url: loaded.photo_url, medical_public: loaded.medical_public, behavior_public: loaded.behavior_public, lost_mode: loaded.lost_mode });
          const { data: auth } = await supabase.auth.getUser();
          if (query?.preview) {
            setStatus('');
          } else if (auth.user?.id && loaded.is_owner) {
            const fingerprint = scannerInstallId();
            const { data: device } = await supabase.from('devices').select('trusted,label').eq('profile_id', auth.user.id).eq('device_fingerprint', fingerprint).maybeSingle() as { data: DeviceRecord | null };
            setActor('owner');
            setConsentDismissed(true);
            setStatus('scan.status.ownDog');
          } else if (auth.user?.id) {
            const fingerprint = scannerInstallId();
            const { data: device } = await supabase.from('devices').select('trusted,label').eq('profile_id', auth.user.id).eq('device_fingerprint', fingerprint).maybeSingle() as { data: DeviceRecord | null };
            if (device?.trusted) {
              setActor('linked_user');
              setConsentDismissed(true);
              setStatus('scan.status.trusted');
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
      setStatus('scan.status.offlineWithCoords', { lat: coords.latitude.toFixed(5), lng: coords.longitude.toFixed(5) });
      return;
    }
    if (!tagId) {
      queueFallbackSync('scan_event', `Finder scan queued for tag ${tag}`, payload);
      setStatus('scan.status.noOwner', { lat: coords.latitude.toFixed(5), lng: coords.longitude.toFixed(5) });
      return;
    }
    const errorMessage = await submitFinderReport(payload, { tagId, petId: pet.id || null });
    const error = errorMessage ? { message: errorMessage } : null;
    if (error && isServiceRestrictionMessage(error.message)) {
      queueFallbackSync('scan_event', `Finder scan queued for ${pet.name}`, payload);
      setStatus('scan.status.offline');
    } else if (error) setStatus('scan.status.failed', { error: error.message });
    else setStatus(reportedLost ? 'scan.status.sentLost' : 'scan.status.sent', { name: pet.name });
  }

  function requestLocation(note: string) {
    if (!navigator.geolocation) {
      setStatus('scan.status.noGeo');
      return;
    }
    setSaving(true);
    setStatus('scan.status.waiting');
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        await savePosition(position, note);
        setSaving(false);
      },
      () => {
        setStatus('scan.status.denied');
        setSaving(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  }

  function acceptFinderLocation() {
    setConsentDismissed(true);
    if (preview) { setStatus('scan.status.preview'); return; }
    requestLocation(reportedLost ? 'Finder reported lost sighting from finder tag URL' : 'Finder consented from finder tag URL');
  }

  function denyFinderLocation() {
    setConsentDismissed(true);
    setStatus('scan.status.declined');
  }

  const petName = pet.id ? pet.name : t('common.thisPet');
  // Escape closes the consent dialog the same way as "Just view the profile" (nothing is shared).
  useEffect(() => {
    if (consentDismissed) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { setConsentDismissed(true); setStatus('scan.status.declined'); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [consentDismissed]);
  return (
    <main className={`publicShell scanLanding ${!consentDismissed ? 'finderConsentActive' : ''}`}>
      {!consentDismissed && <div className="finderConsentOverlay" role="dialog" aria-modal="true" aria-labelledby="finder-consent-title" aria-describedby="finder-consent-body">
        <div className="finderConsentModal">
          <span className="finderConsentDog" aria-hidden="true"><PawPrint /></span>
          <p className="eyebrow">{t('consent.eyebrow')}</p>
          <h2 id="finder-consent-title">{t('consent.title', { name: petName })}</h2>
          <p id="finder-consent-body">{t('consent.body')}</p>
          <div className="actions consentChoices"><button className="primary" type="button" disabled={saving} onClick={acceptFinderLocation}><MapPinned /> {saving ? t('consent.requesting') : t('consent.share')}</button><button type="button" onClick={denyFinderLocation}>{t('consent.justView')}</button></div>
          <small className="formHint">{t('consent.hint')}</small>
          <div style={{ marginTop: 14 }}><LanguagePicker className="consentLanguage" /></div>
        </div>
      </div>}
      {preview && <div className="previewBanner" role="status"><strong>{t('scan.previewLabel')}</strong> {t('scan.preview', { name: pet.id ? pet.name : t('common.yourDog') })}</div>}
      {/* inert keeps keyboard focus inside the consent dialog while it is open */}
      <div className="scanProfileFrame" aria-hidden={!consentDismissed} inert={!consentDismissed}>
      <section className="publicHero" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}><Link className="brandLockup" href="/" aria-label="MyPetID home"><img src="/images/logo/MyPetID-Logo_Resized.jpg" alt="" /><span>MyPet<b>ID</b></span></Link><LanguagePicker /></section>
      {record?.public_extra?.care_schedule && record.public_extra.care_schedule.length > 0 && <PublicCareCountdown schedule={record.public_extra.care_schedule} timeZone={record.public_extra.timezone || 'America/New_York'} petName={pet.name} lost={pet.lost_mode} />}
      {pet.id ? <PetProfileCard mode="public" i18n onAlert={scanMode === 'owner' ? undefined : acceptFinderLocation} pet={{
        name: pet.name, breed: pet.breed, photoUrl: pet.photo_url, coverUrl: record?.cover_url, about: pet.behavior_public, health: pet.medical_public,
        details: record?.public_extra?.details, vet: record?.public_extra?.vet, care: record?.public_extra?.care,
        phone: typeof record?.contact_public?.phone === 'string' ? record.contact_public.phone : '', email: typeof record?.contact_public?.email === 'string' ? record.contact_public.email : '',
        lost: pet.lost_mode, tagCode: tag, statusTags: record?.public_extra?.status_tags,
        lastSeen: record?.last_seen_lat != null && record?.last_seen_lng != null ? { lat: record.last_seen_lat, lng: record.last_seen_lng, at: record.last_seen_at } : null,
      }} /> : <article className="panel" style={{ maxWidth: 720 }} aria-live="polite"><h1>{petLoaded ? t('scan.unavailableTitle') : t('common.loading')}</h1>{petLoaded && <p>{t('scan.unavailableBody')}</p>}</article>}

      <section className="publicGrid">
        <article className="panel wide consentPanel">
          <div className="panelTitleRow"><h2>{scanMode === 'owner' ? t('scan.ownerPanelTitle') : t('scan.finderPanelTitle')}</h2><span className="iconBubble"><MapPinned /></span></div>
          <p>{scanMode === 'owner' ? t('scan.ownerPanelBody') : t('scan.finderPanelBody')}</p>
          {scanMode !== 'owner' && <>
            <label className="toggleRow"><input type="checkbox" checked={reportedLost} onChange={(event) => setReportedLost(event.target.checked)} /> {t('scan.foundToggle')}</label>
            <label>{t('scan.noteLabel')}<textarea value={finderNote} onChange={(event) => setFinderNote(event.target.value)} /></label>
            <label>{t('scan.contactLabel')}<input value={finderContact} onChange={(event) => setFinderContact(event.target.value)} placeholder={t('scan.contactPlaceholder')} /></label>
          </>}
          <div className="actions">
            {scanMode !== 'owner' && <button className="primary" type="button" disabled={saving} onClick={acceptFinderLocation}><MapPinned /> {saving ? t('consent.requesting') : t('scan.sendWithLocation')}</button>}
            {!publicPage && <Link className="button" href={profileUrl}>{t('scan.viewFullProfile')}</Link>}
            {!publicPage && <Link className="button ghost" href={dashboardUrl}>{t('scan.imOwner')}</Link>}
          </div>
          {/* Always-present live region so screen readers announce each new status. */}
          <div role="status" aria-live="polite" lang={lang}>{status && <p className="authMessage">{t(status.key, status.vars)}</p>}</div>
        </article>


      </section>
      {publicPage && <PublicPromo petName={pet.id ? pet.name : undefined} i18n />}
      </div>
    </main>
  );
}
