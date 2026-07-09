import { OutageFallbackClient } from '../../components/outage-fallback-client';

export const metadata = {
  title: 'Outage Save Mode | MyPetID',
  description: 'Emergency Google-backed save mode for MyPetID when Supabase is temporarily restricted.',
};

export default function OutagePage() {
  return <OutageFallbackClient />;
}
