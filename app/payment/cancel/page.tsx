import Link from 'next/link';

export const metadata = { title: 'Payment Cancelled | MyPetID' };

export default function PaymentCancelPage() {
  return <main className="shell"><section className="panel wide"><p className="eyebrow">Checkout cancelled</p><h1>No charge was completed.</h1><p>You can return to the tag shop whenever you are ready. Your account and dog profile can still be set up before purchase.</p><div className="actions"><Link className="button primary" href="/shop/">Back to tag shop</Link><Link className="button" href="/dashboard/">Open dashboard</Link></div></section></main>;
}
