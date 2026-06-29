import Link from 'next/link';
import { AuthPanel } from '../components/auth-panel';
import { PawPrint, ShieldCheck, MapPinned, Users, QrCode } from '../components/icons';

const features = [
  { title: 'NFC / QR pet IDs', body: 'Every tag opens a scan-safe public page with only the contact, medical, and return-home details the owner allows.', Icon: QrCode },
  { title: 'Walks and saved routes', body: 'Plan routes, start walks, save history, and only record location after explicit consent.', Icon: MapPinned },
  { title: 'Dog profile onboarding', body: 'Breed, service/rescue status, medical records, certificates, routines, play, training, goals, and XP in guided setup sections.', Icon: PawPrint },
  { title: 'Dog Pack helpers', body: 'Create groups for family, walkers, trainers, vets, and park friends without exposing private admin tools.', Icon: Users },
  { title: 'Admin controls stay private', body: 'Normal users see their app. CAK3D/admin accounts get unrestricted testing and service monitoring after admin login.', Icon: ShieldCheck },
];

export default function HomePage() {
  return (
    <main>
      <section className="hero shell landingHero">
        <div className="heroGrid">
          <div>
            <div className="brandLockup" style={{ marginBottom: 18 }}><img src="/images/logo/MyPetID-Logo_Resized.jpg" alt="MyPetID logo" /><span>MyPetID</span></div>
            <p className="eyebrow">Dog ID, care, and lost-pet command center</p>
            <h1>Your dog’s profile, tag, walks, reminders, and rescue plan in one place.</h1>
            <p className="lead">Create an account, set up your dog profile, connect an NFC/QR tag, preview the public scan page, and manage walks, meals, medical documents, training, play, goals, Dog Pack groups, and alerts.</p>
            <div className="actions">
              <Link className="button primary" href="/dashboard/">Open app</Link>
              <Link className="button" href="/shop/">Buy NFC tag</Link>
              <Link className="button" href="/pet/?tag=demo-tag-001">View demo public profile</Link>
            </div>
          </div>
          <div className="landingLoginCard">
            <AuthPanel />
            <p className="tiny">New users land here first. After login, the app opens the dashboard with a hamburger menu and user-only pages.</p>
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
          <p className="eyebrow">Built for regular owners first</p>
          <h2>Simple onboarding, private admin tools.</h2>
          <p>Owners should move through account setup, dog profile, routines, reminders, tag setup, and public profile preview without seeing prototype/admin clutter.</p>
        </div>
        <ul className="checklist">
          <li>Dog-only breed and profile setup</li>
          <li>Public NFC preview from inside the pet profile</li>
          <li>Hamburger dashboard menu after login</li>
          <li>Admin dashboard hidden from regular users</li>
        </ul>
      </section>
    </main>
  );
}
