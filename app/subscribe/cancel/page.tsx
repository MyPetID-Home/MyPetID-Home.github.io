import Link from 'next/link';

export const metadata = { title: 'Subscription Cancelled | MyPetID' };

export default function SubscribeCancelPage() {
  return <main className="shell"><section className="panel wide"><p className="eyebrow">Subscription checkout cancelled</p><h1>No subscription was completed.</h1><p>You can use the free account, subscribe later with Stripe, or connect Patreon from the Patreon verification page.</p><div className="actions"><Link className="button primary" href="/subscribe/">Back to subscriptions</Link><Link className="button" href="/dashboard/">Open dashboard</Link></div></section></main>;
}
