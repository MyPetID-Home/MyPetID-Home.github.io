import { VerifyProviderClient } from '../../../components/verify-provider-client';

export const metadata = { title: 'Connect Google | MyPetID' };

export default function GoogleVerifyPage() {
  return <VerifyProviderClient provider="google" />;
}
