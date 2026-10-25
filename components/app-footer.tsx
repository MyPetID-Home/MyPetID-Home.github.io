import Link from 'next/link';

export function AppFooter() {
  return (
    <footer className="legalFooter compactLegalFooter">
      <div className="footRow">
        <div>
          <strong>MyPetID™</strong>
          <span>© 2026 MyPetID. All rights reserved.</span>
        </div>
        <nav aria-label="Footer links">
          <Link href="/shop/">Tags</Link>
          <Link href="/subscribe/">Plans</Link>
          <Link href="/contact/">Contact</Link>
          <Link href="/privacy/">Privacy</Link>
          <Link href="/terms/">Terms</Link>
        </nav>
      </div>
      <small>Help: <a href="mailto:dev.mypetid-help@yahoo.com">dev.mypetid-help@yahoo.com</a> · Support: <a href="mailto:dev.mypetid-sup@yahoo.com">dev.mypetid-sup@yahoo.com</a>. Verification codes come from mypetid@yahoo.com; please don’t reply to that address.</small>
    </footer>
  );
}
