import Link from 'next/link';

export const metadata = { title: 'Contact & Legal Notices | MyPetID' };

export default function Page() {
  return (
    <main className="legalPage">
      <Link className="brandLockup" href="/"><img src="/images/logo/MyPetID-Logo_Resized.jpg" alt="MyPetID" /><span>MyPetID</span></Link>
      <article className="legalDocument">
        <h1>Contact & Legal Notices</h1>
        <div className="legalCopy" dangerouslySetInnerHTML={{ __html: `
<h2>Contact</h2>

<ul>
<li>Support: dev.mypetid-sup@yahoo.com</li>
<li>Admin/security/customer service: dev.mypetid-adm@yahoo.com</li>
<li>Help: dev.mypetid-help@yahoo.com</li>
<li>Verification/no-reply sender: mypetid@yahoo.com</li>
<li>Business phone, admin-escalated inquiries only: (207) 613-5454</li>
</ul>

<p>For lost-pet emergencies, also contact local animal control, nearby shelters, local authorities when appropriate, and trusted people in the area. MyPetID helps organize information but is not an emergency service.</p>

<h2>Verification and messaging</h2>
<h2>Email verification</h2>
<p>MyPetID uses <code>mypetid@yahoo.com</code> only as a verification/no-reply sender for signup, password recovery, email changes, and 6-digit account codes. Do not reply to that mailbox for support. Use Help, Support, then Admin escalation for communication. Phone numbers may still be stored as optional owner contact details, but MyPetID is not planning automated SMS/PIN verification at this time.</p>

<h2>Trademark notice</h2>

<p>MyPetID™ is the app/customer-facing mark for the pet ID service. MyPetID-Home is the GitHub/code home and organization name for the app. Associated pet tag flows, logos, paw/tag marks, and related names are trademarks or service marks unless otherwise noted. Other names, brands, and services belong to their respective owners.</p>

<h2>Copyright notice</h2>

<p>© 2026 MyPetID. All rights reserved. MyPetID-Home hosts the app/code/docs; app copy, UI structure, branding assets, and generated materials are protected by copyright unless a separate license says otherwise.</p>` }} />
        <div className="actions"><Link className="button primary" href="/dashboard/">Back to app</Link><Link className="button" href="/contact/">Contact</Link></div>
      </article>
    </main>
  );
}
