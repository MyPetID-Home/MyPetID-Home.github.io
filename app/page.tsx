import Link from 'next/link';
import { PawPrint, ShieldCheck, MapPinned, Users, QrCode } from '../components/icons';

const features = [
  { title: 'Scan-safe public profiles', body: 'NFC tags and QR codes open a public pet card with owner-approved contact, medical, behavior, and return-home notes.', Icon: QrCode },
  { title: 'Consent-based location', body: 'Scanners can share their location to update the most recent scan map and speed up lost-pet recovery.', Icon: MapPinned },
  { title: 'Owner dashboard', body: 'Owners log in, manage account/profile details, add pets, link tags, preview public pages, and control what strangers see.', Icon: PawPrint },
  { title: 'Linked helpers', body: 'Trusted users can pair accounts by QR approval so family, walkers, and friends can coordinate walks and lost-pet alerts.', Icon: Users },
  { title: 'Admin unrestricted testing', body: 'CAK3D admin mode keeps every tier feature open for hands-on testing while normal users follow subscription limits.', Icon: ShieldCheck },
];

export default function HomePage() {
  return (
    <main>
      <section className="hero shell">
        <p className="eyebrow">MyPetID-Home rebuild • Clydius lane</p>
        <div className="heroGrid">
          <div>
            <div className="brandLockup" style={{ marginBottom: 18 }}><img src="/images/logo/MyPetID-Logo_Resized.jpg" alt="MyPetID logo" /><span>MyPetID</span></div>
            <h1>A full pet command center behind every NFC tag.</h1>
            <p className="lead">Profiles, lost-pet scans, trusted helpers, walks, feeding reminders, play dates, appointments, medical documents, Patreon tier limits, and admin tag management in one app.</p>
            <div className="actions">
              <Link className="button primary" href="/dashboard/">Open app dashboard</Link>
              <Link className="button" href="/pet/?tag=demo-tag-001">Scan demo tag</Link>
            </div>
          </div>
          <div className="phoneCard" aria-label="Demo public pet card">
            <div className="petPhoto"><img src="/images/logo/MyPetID-Logo_Resized.jpg" alt="MyPetID" style={{ borderRadius: 28 }} /></div>
            <h2>Ibby</h2>
            <p>Friendly, food-motivated, nervous around loud trucks.</p>
            <div className="status lost">Demo scan page</div>
            <p className="tiny">Last known scan: awaiting live Supabase data</p>
          </div>
        </div>
      </section>

      <section className="shell cards">
        {features.map(({ title, body, Icon }) => (
          <article className="card" key={title}>
            <Icon />
            <h3>{title}</h3>
            <p>{body}</p>
          </article>
        ))}
      </section>

      <section className="shell splitPanel">
        <div>
          <p className="eyebrow">Subscription-ready, not subscription-blocked</p>
          <h2>Patreon tiers later; admin freedom now.</h2>
          <p>Free users can start with one owner and one pet. Higher tiers can unlock more pets, extra linked users, extended scan history, richer galleries, and walk coordination. Admin accounts bypass those limits for testing.</p>
        </div>
        <ul className="checklist">
          <li>Supabase Auth + Row Level Security planned</li>
          <li>Device fingerprint saved with owner consent</li>
          <li>Tag claim flow starts with CAK3D-created tag IDs</li>
          <li>Public pages never expose private-only profile fields</li>
        </ul>
      </section>
    </main>
  );
}
