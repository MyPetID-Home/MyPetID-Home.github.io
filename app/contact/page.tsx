import Link from 'next/link';
import { appReleaseLabel } from '../../lib/app-version';

export const metadata = { title: 'Contact & Legal Notices | MyPetID' };

export default function Page() {
  return (
    <main className="legalPage">
      <Link className="brandLockup" href="/"><img src="/images/logo/MyPetID-Logo_Resized.jpg" alt="MyPetID" /><span>MyPetID</span></Link>
      <article className="legalDocument">
        <p className="eyebrow">{appReleaseLabel}</p>
        <h1>Contact & Legal Notices</h1>
        <div className="legalCopy" dangerouslySetInnerHTML={{ __html: `
<p>App version: 7.68.5</p>
<p>Build: 26513222</p>

<h2>Contact</h2>

<ul>
<li>Support: dev.mypetid-sup@yahoo.com</li>
<li>Admin/security/customer service: dev.mypetid-adm@yahoo.com</li>
<li>Help: dev.mypetid-help@yahoo.com</li>
<li>Main app/setup email: mypetid@yahoo.com</li>
<li>Business phone: (207) 613-5454</li>
</ul>

<p>For lost-pet emergencies, also contact local animal control, nearby shelters, local authorities when appropriate, and trusted people in the area. MyPetID helps organize information but is not an emergency service.</p>

<h2>Verification and messaging</h2>

<p>MyPetID can support email-based account confirmation and password recovery through Supabase Auth. Six-digit SMS PIN verification from the listed business number requires a supported messaging provider/API, such as Twilio, Telnyx, Vonage, or another production SMS provider. Google Voice/business numbers generally do not provide a simple public API for app-triggered OTP messages, so SMS PIN automation should be added only after a proper provider is selected and configured.</p>

<h2>Trademark notice</h2>

<p>MyPetID, MyPetID Home, associated pet tag flows, logos, paw/tag marks, and related names are trademarks or service marks of MyPetID-Home unless otherwise noted. Other names, brands, and services belong to their respective owners.</p>

<h2>Copyright notice</h2>

<p>© 2026 MyPetID-Home. All rights reserved. App code, documentation, copy, UI structure, branding assets, and generated materials are protected by copyright unless a separate license says otherwise.</p>` }} />
        <div className="actions"><Link className="button primary" href="/dashboard/">Back to app</Link><Link className="button" href="/contact/">Contact</Link></div>
      </article>
    </main>
  );
}
