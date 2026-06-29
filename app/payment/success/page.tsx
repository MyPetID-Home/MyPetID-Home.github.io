import Link from 'next/link';
import { PaymentSuccessClient } from '../../../components/payment-success-client';

export const metadata = { title: 'Payment Success | MyPetID' };

export default function PaymentSuccessPage() {
  return <main className="shell"><section className="panel wide"><p className="eyebrow">Payment received</p><h1>Tag order started.</h1><p>Stripe returned a successful checkout. MyPetID is confirming the session and saving the order status so CAK3D can prepare the NFC/QR tag.</p><PaymentSuccessClient /><div className="actions"><Link className="button primary" href="/dashboard/pet/">Review dog profile</Link><Link className="button" href="/dashboard/admin/">Admin order lookup</Link></div></section></main>;
}
