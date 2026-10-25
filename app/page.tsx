import Link from 'next/link';
import { AuthPanel } from '../components/auth-panel';
import { PawPrint, ShieldCheck, MapPinned, Users, QrCode, Bell, FileText, Nfc, Check, ArrowRight, Heart } from '../components/icons';

const features = [
  { title: 'A tag that speaks for them', body: 'Every NFC/QR tag opens a scan-safe page with only the contact, medical and return-home details you choose to share.', Icon: QrCode, tone: '' },
  { title: 'Instant lost-dog alerts', body: 'When someone scans the tag they can share their location with one tap, and you get the report right away.', Icon: Bell, tone: 'red' },
  { title: 'Walks and routes', body: 'Track walks with your phone’s GPS, save favourite routes and hit weekly distance goals together.', Icon: MapPinned, tone: 'blue' },
  { title: 'Health records in one place', body: 'Vaccines, vet visits, medications and certificates, ready to show a vet, groomer or sitter.', Icon: FileText, tone: 'green' },
  { title: 'Daily care, made a game', body: 'Meals, training, play time and reminders earn XP and badges as you build good habits.', Icon: PawPrint, tone: 'violet' },
  { title: 'Your Dog Pack', body: 'Share with family, walkers and trainers, plan park days and keep everyone in the loop.', Icon: Users, tone: 'blue' },
];

const steps = [
  { title: 'Create your dog’s profile', body: 'Add a photo, breed, health notes and how to reach you. It takes about two minutes.' },
  { title: 'Connect a tag', body: 'Activate a MyPetID NFC/QR tag and choose exactly what a finder is allowed to see.' },
  { title: 'Relax, they’re covered', body: 'Anyone who finds your dog can scan the tag, see how to get them home, and alert you.' },
];

export default function HomePage() {
  return (
    <main>
      <header className="siteNav">
        <div className="shell">
          <Link className="brandLockup" href="/"><img src="/images/logo/MyPetID-Logo_Resized.jpg" alt="" /><span>MyPet<b>ID</b></span></Link>
          <nav aria-label="Main">
            <Link className="hideSm" href="/pet/?tag=demo-tag-001">See a demo</Link>
            <Link className="hideSm" href="/shop/">Tags</Link>
            <Link className="hideSm" href="/subscribe/">Plans</Link>
            <Link className="button primary" href="/dashboard/">Open app</Link>
          </nav>
        </div>
      </header>

      <section className="hero shell landingHero">
        <div className="heroGrid">
          <div className="heroCopy">
            <p className="eyebrow"><Heart className="" /> Dog ID, care and lost-pet plan</p>
            <h1>Every dog deserves a <span className="accent">way back home.</span></h1>
            <p className="lead">MyPetID pairs a smart NFC/QR tag with an app for everything else: your dog’s profile, health records, walks, reminders and an instant alert if they ever get lost.</p>
            <div className="actions">
              <Link className="button primary" href="/dashboard/">Get started free <ArrowRight /></Link>
              <Link className="button" href="/pet/?tag=demo-tag-001">See a demo profile</Link>
            </div>
            <div className="heroPills">
              <span><Check /> Free plan</span>
              <span><Check /> You control what finders see</span>
              <span><Check /> Works on any phone</span>
            </div>
          </div>
          <div className="landingLoginCard">
            <span className="mascot heroMascot" aria-hidden="true"><img src="/images/logo/MyPetID-Logo_Resized.jpg" alt="" /></span>
            <AuthPanel />
          </div>
        </div>

        <div className="heroVisual" aria-hidden="true">
          <div className="floatCard"><img src="/images/dog/Clyde-Nice.jpg" alt="" /><div><strong>Clyde was scanned</strong><small>Finder shared a location · just now</small></div></div>
          <div className="floatCard"><span className="iconBubble green"><MapPinned /></span><div><strong>Evening walk saved</strong><small>1.8 mi · 42 min · +50 XP</small></div></div>
          <div className="floatCard"><span className="iconBubble blue"><Nfc /></span><div><strong>Tag active</strong><small>NFC + QR · public page live</small></div></div>
        </div>
      </section>

      <section className="shell landingSection">
        <div className="sectionHead">
          <p className="eyebrow">How it works</p>
          <h2>Set up once. Protected every day.</h2>
        </div>
        <div className="stepsRow">
          {steps.map((step) => (
            <article className="stepCard" key={step.title}><h3>{step.title}</h3><p>{step.body}</p></article>
          ))}
        </div>
      </section>

      <section className="shell landingSection">
        <div className="sectionHead">
          <p className="eyebrow">Everything in one app</p>
          <h2>More than a tag.</h2>
          <p>The tag gets them home. The app helps you take great care of them in between.</p>
        </div>
        <div className="cards">
          {features.map(({ title, body, Icon, tone }) => (
            <article className="card" key={title}>
              <span className={`iconBubble ${tone}`}><Icon /></span>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="shell splitPanel">
        <div>
          <p className="eyebrow"><ShieldCheck /> Privacy first</p>
          <h2>You decide what a stranger sees.</h2>
          <p>Your address, private notes and feeding plan stay private. Finders only see what helps your dog get home, and location is only shared when someone says yes.</p>
          <div className="actions"><Link className="button" href="/privacy/">Read our privacy promise</Link></div>
        </div>
        <ul className="checklist">
          <li>Choose which contact details appear on the tag page</li>
          <li>Location is only shared after the finder agrees</li>
          <li>Medical notes are public only if you turn them on</li>
          <li>Turn lost mode on or off in one tap</li>
        </ul>
      </section>

      <section className="shell ctaBand">
        <h2>Give your dog a voice when they need it most.</h2>
        <p>Start free with one dog profile. Add a tag whenever you’re ready.</p>
        <div className="actions">
          <Link className="button" href="/dashboard/">Create a free profile</Link>
          <Link className="button ghostDark" href="/shop/">Browse tags</Link>
        </div>
      </section>
    </main>
  );
}
