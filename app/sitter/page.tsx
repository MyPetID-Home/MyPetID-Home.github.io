import { SitterView } from '../../components/sitter-link';

// The care sheet itself is a client component (components/sitter-link.tsx) that reads ?t=<token>
// after mount and calls the get_sitter_view RPC. This wrapper only adds page metadata.
export const metadata = {
  title: 'Care Sheet | MyPetID',
  robots: { index: false, follow: false },
  // Keep the token out of Referer headers when the sitter taps a link (vet site, maps...).
  referrer: 'no-referrer' as const,
};

export default function SitterPage() {
  return <SitterView />;
}
