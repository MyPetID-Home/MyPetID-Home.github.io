import Link from 'next/link';

export const metadata = { title: 'Subscription Active | MyPetID' };

export default function SubscribeSuccessPage() {
  return <main className="shell"><section className="panel wide"><p className="eyebrow">Subscription started</p><h1>Stripe subscription checkout returned successfully.</h1><p>MyPetID will reconcile the subscription through the Stripe webhook and update your app tier in Supabase. If the status does not update immediately, it should settle after Stripe sends the webhook event.</p><div className="actions"><Link className="button primary" href="/dashboard/account/">Open account</Link><Link className="button" href="/shop/">Order NFC tag</Link></div></section></main>;
}
