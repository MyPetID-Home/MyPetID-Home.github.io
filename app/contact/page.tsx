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
<li>Support: <a href="mailto:dev.mypetid-sup@yahoo.com">dev.mypetid-sup@yahoo.com</a></li>
<li>Admin/security/customer service: <a href="mailto:dev.mypetid-adm@yahoo.com">dev.mypetid-adm@yahoo.com</a></li>
<li>Help: <a href="mailto:dev.mypetid-help@yahoo.com">dev.mypetid-help@yahoo.com</a></li>
</ul>

<p>For lost-pet emergencies, also contact local animal control, nearby shelters, local authorities when appropriate, and trusted people in the area. MyPetID helps organize information but is not an emergency service.</p>

<h2>Email verification</h2>

<h2>Trademark notice</h2>

<p>MyPetID™ is the app/customer-facing mark for the pet ID service. MyPetID-Home is the GitHub/code home and organization name for the app. Associated pet tag flows, logos, paw/tag marks, and related names are trademarks or service marks unless otherwise noted. Other names, brands, and services belong to their respective owners.</p>

<h2>Copyright notice</h2>

<p>© 2026 MyPetID. All rights reserved. MyPetID-Home hosts the app/code/docs; app copy, UI structure, branding assets, and generated materials are protected by copyright unless a separate license says otherwise.</p>` }} />
        <div className="actions"><Link className="button primary" href="/dashboard/">Back to app</Link><Link className="button" href="/">Home</Link></div>
      </article>
    </main>
  );
}
