"use client";

import { useId, useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Bell, Heart, MapPinned, PawPrint, Stethoscope, User, Sparkles, ShieldCheck } from './icons';
import { GetTheApp } from './pwa-install-client';
import { statusTag, TAG_COLORS } from '../lib/id-card';
import { useT, type TVars } from '../lib/i18n';

const WalkMap3D = dynamic(() => import('./walk-map-3d').then((m) => m.WalkMap3D), { ssr: false, loading: () => <div className="map3dCanvas mapLoading" style={{ height: 300 }}>Loading map…</div> });

/**
 * A dog's profile as a "business card": cover photo, avatar, name and status, then
 * tabs for each kind of info. `mode="public"` is what a finder sees after scanning;
 * `mode="owner"` is the private view (the owner passes edit controls as `ownerTools`).
 */
export type ProfileCardPet = {
  name: string;
  breed?: string | null;
  photoUrl?: string | null;
  coverUrl?: string | null;
  about?: string | null;
  health?: string | null;
  details?: Record<string, string | undefined> | null;
  vet?: Record<string, string | undefined> | null;
  care?: Record<string, string | undefined> | null;
  phone?: string | null;
  email?: string | null;
  lost?: boolean;
  lastSeen?: { lat: number; lng: number; at?: string | null } | null;
  /** Recent shared scans, newest first (shown on the Scans tab). */
  scans?: { lat: number; lng: number; at: string }[] | null;
  tagCode?: string | null;
  /** Status tag keys (service, medical_alert, rescue...). Always shown so finders know how to help. */
  statusTags?: string[] | null;
};

type TabKey = 'about' | 'health' | 'vet' | 'contact' | 'seen' | 'scans' | 'app';
const LABELS: Record<string, string> = { sex: 'Sex', age: 'Age', birthday: 'Birthday', size: 'Size', weight: 'Weight', coat: 'Coat', colors: 'Colors', pattern: 'Pattern', eyes: 'Eyes', ears: 'Ears', tail: 'Tail', markings: 'Markings', microchip: 'Microchip', status: 'Status', clinic: 'Clinic', doctor: 'Vet', phone: 'Phone', address: 'Address', emergency: 'Emergency clinic', feeding: 'Feeding', allergies: 'Allergies', medications: 'Medications', notes: 'Notes' };

// Cloud profile keys (pets.profile.details) with units, shown with friendly labels and formatting.
const UNIT_LABELS: Record<string, string> = { fixed: 'Spayed / neutered', fixed_on: 'Fixed on', weight_lb: 'Weight', height_in: 'Height', neck_in: 'Neck', rabies_tag: 'Rabies tag', microchip_registry: 'Microchip registry', vaccines: 'Vaccines', email: 'Email', vaccine_clinic: 'Vaccine clinic' };
// Never shown to finders even if present in the data.
const HIDDEN_KEYS = new Set(['issued_at', 'signature_style', 'full_name']);
type TFn = (key: string, vars?: TVars) => string;
// Only the label and the yes/no wording are translated; the owner's own values stay as written.
function fieldLabel(k: string, t: TFn | null) {
  const english = LABELS[k] || UNIT_LABELS[k] || k.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
  if (!t || !(LABELS[k] || UNIT_LABELS[k])) return english;
  return t(`field.${k}`);
}
function formatValue(key: string, value: string, t: TFn | null = null, locale?: string) {
  if (key === 'fixed') return value === 'yes' ? (t ? t('card.yes') : 'Yes') : value === 'no' ? (t ? t('card.no') : 'No') : (t ? t('card.notSure') : 'Not sure');
  if (key === 'weight_lb') return `${value} lb`;
  if (key === 'neck_in') return `${value} in`;
  if (key === 'height_in') { const n = Number(value); return Number.isFinite(n) && n >= 12 ? `${Math.floor(n / 12)}' ${Math.round(n % 12)}"` : `${value} in`; }
  if ((key === 'birthday' || key === 'fixed_on') && /^\d{4}-\d{2}-\d{2}/.test(value)) return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString(locale, { month: 'long', day: 'numeric', year: 'numeric' });
  return value;
}

function Rows({ data, t = null, locale }: { data?: Record<string, string | undefined> | null; t?: TFn | null; locale?: string }) {
  const entries = Object.entries(data || {}).filter(([k, v]) => !HIDDEN_KEYS.has(k) && v !== null && v !== undefined && String(v).trim());
  if (!entries.length) return null;
  return <dl className="profileRows">{entries.map(([k, v]) => <div key={k}><dt>{fieldLabel(k, t)}</dt><dd>{formatValue(k, String(v), t, locale)}</dd></div>)}</dl>;
}

/**
 * `i18n` translates the finder-facing wording (public mode only; the owner view stays English).
 * Pet data is never translated.
 */
export function PetProfileCard({ pet, mode, finderHref, ownerTools, onAlert, i18n = false }: { pet: ProfileCardPet; mode: 'public' | 'owner'; finderHref?: string; ownerTools?: React.ReactNode; onAlert?: () => void; i18n?: boolean }) {
  const translated = i18n && mode === 'public';
  const { t: tr, locale: trLocale } = useT(translated);
  // English strings stay inline below; `L(key, english)` swaps in the translation when enabled.
  const L = (key: string, english: string, vars?: TVars) => (translated ? tr(key, vars) : english);
  const locale = translated ? trLocale : undefined;
  const tabsId = useId();
  const tabs = useMemo(() => {
    const list: { key: TabKey; label: string }[] = [{ key: 'about', label: 'About' }];
    if (mode === 'owner' || pet.health) list.push({ key: 'health', label: 'Health' });
    if (mode === 'owner' || (pet.vet && Object.values(pet.vet).some(Boolean))) list.push({ key: 'vet', label: 'Vet' });
    list.push({ key: 'contact', label: 'Contact' });
    if (pet.lost && pet.lastSeen) list.push({ key: 'seen', label: 'Last seen' });
    else if (pet.scans && pet.scans.length) list.push({ key: 'scans', label: 'Scans' });
    if (mode === 'public') list.push({ key: 'app', label: 'Get MyPetID' });
    return list;
  }, [mode, pet.health, pet.vet, pet.lost, pet.lastSeen, pet.scans]);
  const tabLabel = (key: TabKey, english: string) => L(`card.tab.${key}`, english);
  // Arrow keys move between tabs (WAI-ARIA tabs pattern).
  function onTabKey(event: React.KeyboardEvent<HTMLDivElement>) {
    const index = tabs.findIndex((x) => x.key === tab);
    let next = -1;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    if (next < 0) return;
    event.preventDefault();
    setTab(tabs[next].key);
    document.getElementById(`${tabsId}-tab-${tabs[next].key}`)?.focus();
  }
  const [tab, setTab] = useState<TabKey>(pet.lost && pet.lastSeen ? 'seen' : 'about');
  const photo = pet.photoUrl || '/images/logo/MyPetID-Logo_Resized.jpg';

  return (
    <article className={`petCard ${pet.lost ? 'isLost' : ''}`}>
      <div className="petCover" style={pet.coverUrl ? { backgroundImage: `url(${pet.coverUrl})` } : undefined}>
        <span className="coverPaws" aria-hidden="true" />
        {pet.lost && <span className="lostFlag"><Bell /> {L('card.lostFlag', 'Lost — please help')}</span>}
      </div>
      <div className="petIdentity">
        <div className="petAvatarRing"><img src={photo} alt={L('card.photoAlt', `Photo of ${pet.name}`, { name: pet.name })} /></div>
        <div className="petTitle">
          <p className="eyebrow">{mode === 'owner' ? 'Your dog' : L('card.hi', 'Hi, my name is')}{pet.tagCode ? L('card.tag', ` · tag ${pet.tagCode}`, { code: pet.tagCode }) : ''}</p>
          <h1>{pet.name}</h1>
          {pet.statusTags && pet.statusTags.length > 0 && <div className="statusTags">{pet.statusTags.map((key) => { const t = statusTag(key); return t ? <span key={key} style={{ borderColor: TAG_COLORS[t.tone], color: TAG_COLORS[t.tone] }}>{L(`tag.${t.key}`, t.label)}</span> : null; })}</div>}
          <div className="chipCloud">{[pet.breed, pet.details?.age, pet.details?.size, pet.details?.sex].filter(Boolean).map((chip) => <span key={chip}>{chip}</span>)}</div>
        </div>
        <div className="petActions">
          {mode === 'public' && pet.phone && <a className="button primary" href={`tel:${pet.phone}`}>{L('card.callOwner', 'Call my owner')}</a>}
          {mode === 'public' && finderHref && <Link className={`button ${pet.phone ? '' : 'primary'}`} href={finderHref}><MapPinned /> {L('card.foundDog', 'I found this dog')}</Link>}
          {mode === 'public' && onAlert && <button className={pet.phone || finderHref ? '' : 'primary'} type="button" onClick={onAlert}><Bell /> {L('card.alertOwner', 'Alert the owner')}</button>}
          {ownerTools}
        </div>
      </div>

      <div className="profileTabs" role="tablist" aria-label={L('card.tabsLabel', `${pet.name}'s profile`, { name: pet.name })} onKeyDown={onTabKey}>
        {tabs.map((t) => <button key={t.key} id={`${tabsId}-tab-${t.key}`} role="tab" aria-selected={tab === t.key} aria-controls={`${tabsId}-panel`} tabIndex={tab === t.key ? 0 : -1} className={tab === t.key ? 'active' : ''} type="button" onClick={() => setTab(t.key)}>{tabLabel(t.key, t.label)}</button>)}
      </div>

      <div className="profileTabBody" key={tab} id={`${tabsId}-panel`} role="tabpanel" aria-labelledby={`${tabsId}-tab-${tab}`} tabIndex={0}>
        {tab === 'about' && <>
          <div className="statusLine" data-lost={pet.lost ? 'yes' : 'no'}>{pet.lost ? <><Bell /> {L('card.lostLine', 'I’m lost. If you see me, please tap “I found this dog”.')}</> : <><Heart /> {L('card.safeLine', 'I’m safe at home. Thanks for checking on me!')}</>}</div>
          {pet.about ? <p className="lead">{pet.about}</p> : <p className="formHint">{mode === 'owner' ? 'Add a personality note so finders know how to approach your dog.' : L('card.noAbout', 'My owner hasn’t written about me yet.')}</p>}
          <Rows data={pet.details} t={translated ? tr : null} locale={locale} />
        </>}
        {tab === 'health' && <>
          <h3><Stethoscope /> {L('card.healthNotes', 'Health notes')}</h3>
          {pet.health ? <p>{pet.health}</p> : <p className="formHint">{L('card.noHealth', 'No health notes shared.')}</p>}
          <Rows data={pet.care} t={translated ? tr : null} locale={locale} />
        </>}
        {tab === 'vet' && <>
          <h3><ShieldCheck /> {L('card.vet', 'Vet')}</h3>
          {pet.vet && Object.values(pet.vet).some(Boolean) ? <Rows data={pet.vet} t={translated ? tr : null} locale={locale} /> : <p className="formHint">{mode === 'owner' ? 'Add your vet so a finder or sitter can call them in an emergency.' : L('card.noVet', 'No vet details shared.')}</p>}
        </>}
        {tab === 'contact' && <>
          <h3><User /> {L('card.contactOwner', 'Contact my owner')}</h3>
          {pet.phone || pet.email ? <div className="actions">{pet.phone && <a className="button primary" href={`tel:${pet.phone}`}>{L('card.call', `Call ${pet.phone}`, { phone: pet.phone })}</a>}{pet.phone && <a className="button" href={`sms:${pet.phone}`}>{L('card.text', 'Text')}</a>}{pet.email && <a className="button" href={`mailto:${pet.email}`}>{L('card.email', 'Email')}</a>}</div>
            : <p className="formHint">{mode === 'owner' ? 'Add a phone or email under Contact so finders can reach you.' : L('card.noContact', 'Tap “I found this dog” and my owner is alerted with your location.')}</p>}
        </>}
        {tab === 'seen' && pet.lastSeen && <>
          <h3><MapPinned /> {L('card.lastSeen', 'Last seen')}{pet.lastSeen.at ? ` · ${new Date(pet.lastSeen.at).toLocaleString(locale, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}` : ''}</h3>
          <p className="formHint">{L('card.lastSeenHint', 'The last place someone scanned my tag (rounded to about 100 m).')}</p>
          <WalkMap3D current={{ lat: pet.lastSeen.lat, lng: pet.lastSeen.lng }} height={300} />
        </>}
        {tab === 'scans' && pet.scans && <>
          <h3><MapPinned /> {L('card.scansTitle', 'Where my tag was scanned')}</h3>
          <p className="formHint">{L('card.scansHint', 'The most recent scan and the one before it. Only scans the finder agreed to share appear here.')}</p>
          <WalkMap3D height={320} pins={pet.scans.slice(0, 2).map((s, i) => ({ lat: s.lat, lng: s.lng, tone: i === 0 ? 'brand' : 'blue', glyph: i === 0 ? '1' : '2', label: `${i === 0 ? L('card.mostRecent', 'Most recent') : L('card.previous', 'Previous')} · ${new Date(s.at).toLocaleString(locale, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}` }))} />
        </>}
        {tab === 'app' && <>
          <h3><Sparkles /> {L('card.appTitle', 'Keep your dog safe too')}</h3>
          <p>{L('card.appBody', 'MyPetID is a free app with an NFC ID card for your dog: anyone who finds them can scan it and get them home.')}</p>
          <div className="actions"><Link className="button primary" href="/"><PawPrint /> {L('common.learnAbout', 'Learn about MyPetID')}</Link></div>
          <GetTheApp compact i18n={translated} />
        </>}
      </div>
    </article>
  );
}
