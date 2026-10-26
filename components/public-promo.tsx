"use client";

import Link from 'next/link';
import { GetTheApp } from './pwa-install-client';
import { MascotPeek } from './mascot';
import { Bell, FileText, Footprints, MapPinned, Nfc, ShieldCheck } from './icons';

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

export function PublicPromo({ petName }: { petName?: string }) {
  return (
    <section className="publicPromo" aria-label="About MyPetID">
      <div className="promoHead">
        <MascotPeek size={70} />
        <div>
          <p className="eyebrow">Like what you see?</p>
          <h2>{petName ? `${petName} wears a MyPetID tag.` : 'This dog wears a MyPetID tag.'} Your dog can too.</h2>
          <p>MyPetID is a smart dog tag and an app for everything else: your dog’s profile, health records, walks, reminders and an instant alert if they ever get lost.</p>
        </div>
      </div>
      <ul className="promoFeatures">{FEATURES.map(({ icon: Icon, title, text }) => <li key={title}><span className="iconBubble"><Icon /></span><div><strong>{title}</strong><small>{text}</small></div></li>)}</ul>
      <div className="actions promoActions">
        <Link className="button primary" href="/">Learn about MyPetID</Link>
        <Link className="button" href="/subscribe/">See plans</Link>
        <Link className="button" href="/shop/">Shop tags &amp; cards</Link>
      </div>
      <GetTheApp compact />
      <p className="formHint">Start free with one dog profile. No account details of this dog’s owner are shown here.</p>
    </section>
  );
}
