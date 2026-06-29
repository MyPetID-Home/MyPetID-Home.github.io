import Link from 'next/link';
import { ProductPurchaseClient } from '../../components/product-purchase-client';

export const metadata = { title: 'Subscribe | MyPetID' };

export default function SubscribePage() {
  return (
    <main>
      <section className="hero shell">
        <p className="eyebrow">Membership options</p>
        <h1>Subscribe with Stripe or Patreon, then order the tag style that fits your dog.</h1>
        <p className="lead">Stripe checkout handles one-time NFC tag purchases and future payment plans. Patreon remains available for membership linking and creator-support tiers while MyPetID maps Patreon status into app access.</p>
        <div className="actions"><Link className="button primary" href="/shop/">Choose NFC tag</Link><Link className="button" href="/verify/patreon/">Link Patreon</Link></div>
      </section>
      <ProductPurchaseClient compact />
    </main>
  );
}
