import Link from 'next/link';
import { appReleaseLabel } from '../lib/app-version';

export function AppFooter() {
  return (
    <footer className="legalFooter">
      <div>
        <strong>MyPetID</strong>
        <span>{appReleaseLabel}</span>
        <span>© 2026 MyPetID-Home. All rights reserved.</span>
      </div>
      <nav aria-label="Legal and contact links">
        <Link href="/privacy/">Privacy Policy</Link>
        <Link href="/terms/">Terms of Service</Link>
        <Link href="/contact/">Contact</Link>
      </nav>
      <small>MyPetID, MyPetID Home, and related paw/tag marks are trademarks or service marks of MyPetID-Home unless otherwise noted.</small>
    </footer>
  );
}
