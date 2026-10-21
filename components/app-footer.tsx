import Link from 'next/link';

export function AppFooter() {
  return (
    <footer className="legalFooter compactLegalFooter">
      <div>
        <strong>MyPetID™</strong>
        <span>© 2026 MyPetID. All rights reserved.</span>
        <span>MyPetID-Home is the GitHub/code home for the MyPetID app.</span>
      </div>
      <nav aria-label="Footer support links">
        <Link href="/contact/">Contact</Link>
        <Link href="/privacy/">Privacy</Link>
        <Link href="/terms/">Terms</Link>
      </nav>
      <small>Help: <a href="mailto:dev.mypetid-help@yahoo.com">dev.mypetid-help@yahoo.com</a> • Support: <a href="mailto:dev.mypetid-sup@yahoo.com">dev.mypetid-sup@yahoo.com</a> • Admin: <a href="mailto:real_cak3d@yahoo.com">real_cak3d@yahoo.com</a>. Verification codes may come from mypetid@yahoo.com; do not reply there.</small>
    </footer>
  );
}
