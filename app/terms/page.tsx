import Link from 'next/link';
import { appReleaseLabel } from '../../lib/app-version';

export const metadata = { title: 'Terms of Service | MyPetID' };

export default function Page() {
  return (
    <main className="legalPage">
      <Link className="brandLockup" href="/"><img src="/images/logo/MyPetID-Logo_Resized.jpg" alt="MyPetID" /><span>MyPetID</span></Link>
      <article className="legalDocument">
        <p className="eyebrow">{appReleaseLabel}</p>
        <h1>Terms of Service</h1>
        <div className="legalCopy" dangerouslySetInnerHTML={{ __html: `
<p>Effective date: June 28, 2026</p>
<p>App version: 7.68.5</p>
<p>Build: 26513225</p>

<p>These Terms of Service describe the rules for using MyPetID. They are written for transparency and product planning and should be reviewed by counsel before launch with live customers.</p>

<h2>1. Acceptance of terms</h2>

<p>By creating an account, using the dashboard, scanning a tag, or accessing a MyPetID public pet profile, you agree to use the service responsibly and follow these terms.</p>

<h2>2. Description of service</h2>

<p>MyPetID provides pet profiles, NFC/QR scan pages, lost/found reporting, owner dashboards, pet-care records, walk tracking, reminders, public profile controls, and future subscription or membership features.</p>

<h2>3. Owner responsibility</h2>

<p>Pet owners are responsible for the information they add, publish, or share. Owners should keep contact information current, avoid publishing private or unsafe details, and verify that public profile fields are appropriate for strangers, finders, helpers, vets, or walkers to see.</p>

<h2>4. Public scan pages and finder reports</h2>

<p>Public scan pages are designed to help return pets safely. Finders may choose to share location, a note, and optional contact details. Location should only be saved after explicit permission from the scanner's device/browser.</p>

<p>Users must not submit false reports, harass owners, misuse finder contact tools, or attempt to access private information.</p>

<h2>5. Accounts and security</h2>

<p>Users must keep login credentials secure and should report suspected account compromise. Password resets, email changes, and verification workflows may require email confirmation codes sent from <code>mypetid@yahoo.com</code>.</p>

<h2>6. Email and verification</h2>

<p>MyPetID may use email verification codes and confirmation links from <code>mypetid@yahoo.com</code> to help confirm signups, password changes, email changes, and account recovery requests. MyPetID is not planning automated SMS or phone PIN verification at this time.</p>

<h2>7. Subscription and admin access</h2>

<p>Future subscription tiers may limit profiles, helpers, scan history, or premium features. Administrative/CAK3D testing accounts may have unrestricted access for development, support, troubleshooting, and security testing.</p>

<h2>8. Acceptable use</h2>

<p>You agree not to:</p>

<ul>
<li>Use MyPetID for unlawful, abusive, deceptive, or harmful activity.</li>
<li>Upload malware, exploit code, or unsafe files.</li>
<li>Attempt to bypass account security, subscription limits, or access controls.</li>
<li>Publish someone else's private contact details without permission.</li>
<li>Misrepresent pet ownership or submit false lost/found information.</li>
</ul>

<h2>9. No emergency guarantee</h2>

<p>MyPetID can assist with pet identification and recovery, but it is not an emergency service, law-enforcement service, veterinary provider, or guaranteed recovery system. In urgent situations, contact local authorities, animal control, veterinary services, or trusted local help.</p>

<h2>10. Intellectual property</h2>

<p>MyPetID, MyPetID Home, associated logos, tag flows, dashboard names, visual marks, and related branding are trademarks or service marks of MyPetID-Home unless otherwise noted. App content, design, documentation, and source materials are protected by copyright and other intellectual-property laws.</p>

<p>Users retain ownership of pet photos, documents, and profile information they provide, subject to the rights needed for MyPetID to host, display, process, and operate the service.</p>

<h2>11. Disclaimers</h2>

<p>MyPetID is provided as-is while under active development. Features may change, break, or be removed. We do not guarantee uninterrupted service, exact GPS accuracy, successful pet recovery, or compatibility with every device/browser.</p>

<h2>12. Limitation of liability</h2>

<p>To the maximum extent allowed by law, MyPetID-Home and its administrators are not liable for indirect, incidental, consequential, special, or punitive damages arising from use of the service.</p>

<h2>13. Contact</h2>

<p>For support, legal, privacy, or security concerns:</p>

<ul>
<li>Support: dev.mypetid-sup@yahoo.com</li>
<li>Help: dev.mypetid-help@yahoo.com</li>
<li>Admin: dev.mypetid-adm@yahoo.com</li>
<li>Main app/setup email: mypetid@yahoo.com</li>
<li>Phone: (207) 613-5454</li>
</ul>

<h2>14. Changes to terms</h2>

<p>We may update these terms as MyPetID evolves. The visible version and build number help identify which app release was current when terms were updated.</p>` }} />
        <div className="actions"><Link className="button primary" href="/dashboard/">Back to app</Link><Link className="button" href="/contact/">Contact</Link></div>
      </article>
    </main>
  );
}
