"use client";

import Link from 'next/link';
import { GetTheApp } from './pwa-install-client';
import { MascotPeek } from './mascot';
import { Bell, FileText, Footprints, MapPinned, Nfc, ShieldCheck } from './icons';
import { useT } from '../lib/i18n';

/**
 * Shown under a scanned dog's public tag page: what MyPetID is, with links to the landing page,
 * the app, plans and the shop. It never links to the owner's account or private profile.
 */
const FEATURES = [
  { icon: Nfc, title: 'Smart NFC + QR tag', text: 'Anyone can tap or scan it to see how to get the dog home, no app needed.' },
  { icon: Bell, title: 'Instant found alerts', text: 'The owner is notified the moment someone scans, with the location if the finder shares it.' },
  { icon: ShieldCheck, title: 'Privacy first', text: 'Owners choose exactly what finders see. Addresses and accounts stay private.' },
  { icon: Footprints, title: 'Walks and goals', text: 'GPS walks with distance, time, steps and stops, plus goals for each dog’s breed and age.' },
  { icon: FileText, title: 'Health records in one place', text: 'Vaccines, vet visits, medicine and documents, ready to show a vet or sitter.' },
  { icon: MapPinned, title: 'Lost mode', text: 'One tap turns the tag page into a lost-dog alert for anyone who scans it.' },
];

/** `i18n` translates the copy (finder-facing pages); without it the promo stays English. */
export function PublicPromo({ petName, i18n = false }: { petName?: string; i18n?: boolean }) {
  const { t } = useT(i18n);
  // Features are matched by position (promo.f1 ... promo.f6); English comes from FEATURES.
  const L = (key: string, english: string, vars?: Record<string, string>) => (i18n ? t(key, vars) : english);
  return (
    <section className="publicPromo" aria-label={L('promo.label', 'About MyPetID')}>
      <div className="promoHead">
        <MascotPeek size={70} />
        <div>
          <p className="eyebrow">{L('promo.eyebrow', 'Like what you see?')}</p>
          <h2>{petName ? L('promo.titleNamed', `${petName} wears a MyPetID tag. Your dog can too.`, { name: petName }) : L('promo.title', 'This dog wears a MyPetID tag. Your dog can too.')}</h2>
          <p>{L('promo.body', 'MyPetID is a smart dog tag and an app for everything else: your dog’s profile, health records, walks, reminders and an instant alert if they ever get lost.')}</p>
        </div>
      </div>
      <ul className="promoFeatures">{FEATURES.map(({ icon: Icon, title, text }, i) => <li key={title}><span className="iconBubble"><Icon /></span><div><strong>{L(`promo.f${i + 1}.title`, title)}</strong><small>{L(`promo.f${i + 1}.text`, text)}</small></div></li>)}</ul>
      <div className="actions promoActions">
        <Link className="button primary" href="/">{L('common.learnAbout', 'Learn about MyPetID')}</Link>
        <Link className="button" href="/subscribe/">{L('promo.plans', 'See plans')}</Link>
        <Link className="button" href="/shop/">{L('promo.shop', 'Shop tags & cards')}</Link>
      </div>
      <GetTheApp compact i18n={i18n} />
      <p className="formHint">{L('promo.hint', 'Start free with one dog profile. No account details of this dog’s owner are shown here.')}</p>
    </section>
  );
}
