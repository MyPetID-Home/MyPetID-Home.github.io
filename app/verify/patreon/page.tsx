import { VerifyProviderClient } from '../../../components/verify-provider-client';

export const metadata = { title: 'Link Patreon | MyPetID' };

export default function PatreonVerifyPage() {
  return <VerifyProviderClient provider="patreon" />;
}
