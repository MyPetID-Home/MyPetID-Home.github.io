import { ScanLanding } from '../../../components/scan-landing';

export const metadata = { title: 'Found a dog? | MyPetID', robots: { index: false, follow: false } };

// Tag pages are looked up when they're opened. The static GitHub Pages copy only needs one
// placeholder to build; NFC tags point to the main site, which renders any code on request.
export function generateStaticParams() {
  return [{ code: 'MPID-000000' }];
}

export default async function PublicTagPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const raw = decodeURIComponent(code).trim();
  // MPID codes are always upper case (typed or scanned in lower case still works); older codes stay as they are.
  const tag = /^mpid-/i.test(raw) ? raw.toUpperCase() : raw;
  return <ScanLanding tagCode={tag} publicPage />;
}
