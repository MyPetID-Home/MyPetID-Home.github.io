import { appReleaseLabel } from '../lib/app-version';

export function AppFooter() {
  return (
    <footer className="legalFooter compactLegalFooter">
      <div>
        <strong>MyPetID</strong>
        <span>{appReleaseLabel}</span>
        <span>© 2026 MyPetID-Home. All rights reserved.</span>
      </div>
      <small>Legal links are available during signup, Settings, and Contact.</small>
    </footer>
  );
}
