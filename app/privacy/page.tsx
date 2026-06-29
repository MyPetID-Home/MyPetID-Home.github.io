import Link from 'next/link';
import { appReleaseLabel } from '../../lib/app-version';

export const metadata = { title: 'Privacy Policy | MyPetID' };

export default function Page() {
  return (
    <main className="legalPage">
      <Link className="brandLockup" href="/"><img src="/images/logo/MyPetID-Logo_Resized.jpg" alt="MyPetID" /><span>MyPetID</span></Link>
      <article className="legalDocument">
        <p className="eyebrow">{appReleaseLabel}</p>
        <h1>Privacy Policy</h1>
        <div className="legalCopy" dangerouslySetInnerHTML={{ __html: `
<p>Effective date: June 28, 2026</p>
<p>App version: 7.68.5</p>
<p>Build: 26513225</p>

<p>MyPetID is a pet identification, care, and lost-pet recovery application operated by MyPetID-Home. This policy explains what information the app collects, how it is used, who can access it, and how pet owners and finders can contact us.</p>

<p>This policy is written for transparency and product planning. It is not a substitute for legal advice, and it should be reviewed by counsel before launch with live customers.</p>

<h2>1. What MyPetID does</h2>

<p>MyPetID lets pet owners create an account, build pet profiles, connect NFC/QR tags, manage care information, track walks and routines, and provide a public scan page for people who find or scan a pet tag. The app is designed so public viewers only see owner-approved information.</p>

<h2>2. Information we collect</h2>

<p>Depending on the features used, MyPetID may collect:</p>

<ul>
<li>Account details such as name, email address, phone number, username, and authentication identifiers.</li>
<li>Pet profile details such as name, breed, age/birthday, size, photos, behavior notes, medical notes, care routines, service/rescue status, microchip or tag identifiers, and owner-approved public profile fields.</li>
<li>Contact preferences and emergency contact information.</li>
<li>NFC/QR tag scan information, including tag code, scan time, consent status, finder note, optional finder contact, and approximate device location only when the scanner explicitly grants location permission.</li>
<li>Walk information such as timer duration, start/end points, GPS accuracy, saved routes, care goals, and walk history.</li>
<li>Uploaded or linked documents and images, such as medical records or pet photos, when the owner chooses to add them.</li>
<li>Device/browser information needed for security, trusted-device checks, abuse prevention, and app reliability.</li>
<li>Subscription or membership status from connected providers, such as Patreon, when enabled by the user.</li>
<li>Google integration status and user-approved Google data connections if the user chooses to connect Google services.</li>
</ul>

<h2>3. Location data</h2>

<p>MyPetID does not save scan location just because someone opens a public profile. Location is requested only on dedicated consent flows such as the NFC/QR scan gate, owner lost-pet reporting, or walk tracking. If the user denies permission, no new GPS location is saved from that action.</p>

<p>Walk tracking is intended to use device GPS movement and accuracy checks. Planned route mileage is treated as a plan or estimate, not as confirmed movement.</p>

<h2>4. How we use information</h2>

<p>We use information to:</p>

<ul>
<li>Show pet profiles and owner-approved public scan pages.</li>
<li>Help owners recover lost pets and review finder reports.</li>
<li>Track owner-authorized care routines, walks, medical notes, and reminders.</li>
<li>Manage accounts, security, trusted devices, and admin support.</li>
<li>Enforce subscription or membership limits once those features are active.</li>
<li>Improve reliability, troubleshoot support requests, and prevent abuse.</li>
<li>Provide owner/admin dashboards and future customer service workflows.</li>
</ul>

<h2>5. Who can access information</h2>

<p>Owner data is intended to be private to the account owner, approved helpers, and authorized MyPetID administrators. Administrative access is limited to the owner/admin operator, who also acts as IT, security, and customer support for the app while it is being built and maintained.</p>

<p>No outside users should have access to private account data unless the pet owner explicitly shares it, links them as a helper, or publishes specific fields to the public scan profile.</p>

<h2>6. Sharing and third-party services</h2>

<p>MyPetID does not sell pet owner data. Data may be processed by services used to operate the app, such as hosting, authentication, database, storage, email, analytics, payment, membership, or OAuth providers. Examples may include Supabase, GitHub Pages, Google services, Patreon, and future SMS/email providers.</p>

<p>Sensitive server-side credentials, service-role keys, OAuth secrets, webhook secrets, and payment secrets must remain in private environment or provider secret stores and must not be included in public source code.</p>

<h2>7. Data retention</h2>

<p>Pet owners should be able to update or remove their profiles and public fields. Production retention rules may vary by feature, legal obligation, subscription status, support need, or security requirement. Lost/found scan records and audit logs may be retained for safety and abuse-prevention purposes.</p>

<h2>8. Children and pet safety</h2>

<p>MyPetID is intended for pet owners and responsible helpers. Owners should avoid publishing sensitive personal information, private home addresses, or information that could put a person or pet at risk.</p>

<h2>9. Security</h2>

<p>MyPetID uses account authentication, owner-approved public fields, role-based access planning, and private environment/secret stores for credentials. No system can be guaranteed perfectly secure, but we design the app to limit public exposure and keep administrative access restricted.</p>

<h2>10. Contact</h2>

<p>For privacy, support, or security questions:</p>

<ul>
<li>Support: dev.mypetid-sup@yahoo.com</li>
<li>Help: dev.mypetid-help@yahoo.com</li>
<li>Admin: dev.mypetid-adm@yahoo.com</li>
<li>Main app/setup email: mypetid@yahoo.com</li>
<li>Phone: (207) 613-5454</li>
</ul>

<h2>11. Changes to this policy</h2>

<p>We may update this policy as the app changes. The visible app version and build number help track which version of the app and policy were current at a given time.</p>` }} />
        <div className="actions"><Link className="button primary" href="/dashboard/">Back to app</Link><Link className="button" href="/contact/">Contact</Link></div>
      </article>
    </main>
  );
}
