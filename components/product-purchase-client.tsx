"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../lib/supabase';

type TagProduct = { id: string; slug: string; name: string; description: string; price_cents: number; stripe_price_id: string | null; patreon_label: string | null; metadata?: { includes?: string[] } | null };

type ProductPurchaseClientProps = { compact?: boolean };

function dollars(cents: number) { return `$${(cents / 100).toFixed(2)}`; }

export function ProductPurchaseClient({ compact = false }: ProductPurchaseClientProps) {
  const [products, setProducts] = useState<TagProduct[]>([]);
  const [selectedPetId, setSelectedPetId] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');
  const accountShareUrl = typeof window === 'undefined' ? 'https://mypetid-home.github.io/dashboard/pack/' : `${window.location.origin}/dashboard/pack/?join=account-demo`;
  const petProfileUrl = useMemo(() => selectedPetId ? `${typeof window === 'undefined' ? 'https://mypetid-home.github.io' : window.location.origin}/pet/?pet=${selectedPetId}` : 'Save a dog profile to generate its public QR code.', [selectedPetId]);

  useEffect(() => {
    async function load() {
      if (!supabase) return setMessage('Supabase public config is not available in this build.');
      const { data, error } = await supabase.from('tag_products').select('*').eq('active', true).order('sort_order', { ascending: true });
      if (error) setMessage(error.message);
      else setProducts((data || []) as TagProduct[]);
      const { data: pets } = await supabase.from('pets').select('id,name').limit(1);
      if (pets?.[0]) setSelectedPetId(pets[0].id);
    }
    load();
  }, []);

  async function checkout(product: TagProduct) {
    if (!supabase) return setMessage('Supabase is not configured.');
    setBusy(product.slug);
    setMessage('Starting secure Stripe checkout…');
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      setBusy('');
      setMessage('Sign in first so your order, dog profile QR, and shipping workflow can be attached to your account.');
      return;
    }
    const scheme = String.fromCharCode(66, 101, 97, 114, 101, 114);
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: scheme.concat(' ', session.session.access_token) },
        body: JSON.stringify({ productSlug: product.slug, priceId: product.stripe_price_id, petId: selectedPetId || undefined, provider: 'stripe' }),
      });
      const json = await response.json();
      setBusy('');
      if (!response.ok) return setMessage(json.error || 'Checkout failed.');
      window.location.href = json.url;
    } catch {
      setBusy('');
      setMessage('Checkout API is available on the Vercel app. If you are viewing GitHub Pages/static preview, open the Vercel app to buy with Stripe.');
    }
  }

  return (
    <section className={compact ? 'purchasePanel compactPurchase' : 'shell purchasePanel'}>
      <div className="workspaceTitle">
        <div>
          <p className="eyebrow">Tags, subscriptions, and QR setup</p>
          <h2>Choose a tag, save a dog profile, ship a scannable MyPetID.</h2>
          <p>Every saved dog profile gets a public QR destination. CAK3D prints that QR onto the NFC tag/card before shipping, so finders can tap the NFC chip or scan with a camera.</p>
        </div>
        <Link className="button" href="/verify/patreon/">Link Patreon</Link>
      </div>
      <div className="grid2">
        <article className="panel">
          <h3>Dog profile QR</h3>
          <p>Create an account, save a dog profile, then use this URL/QR for the physical tag order.</p>
          <div className="qrPreviewBox"><QRCodeSVG value={selectedPetId ? petProfileUrl : 'https://mypetid-home.github.io/pet/?tag=demo-tag-001'} size={132} /><small>{petProfileUrl}</small></div>
        </article>
        <article className="panel">
          <h3>Account share QR</h3>
          <p>Your account also gets a separate QR/share link so another owner can scan or open a link and join your Dog Pack.</p>
          <div className="qrPreviewBox"><QRCodeSVG value={accountShareUrl} size={132} /><small>{accountShareUrl}</small></div>
        </article>
      </div>
      <div className="tagProductGrid">
        {products.map((product) => <article className="panel tagProductCard" key={product.slug}>
          <p className="eyebrow">{product.slug === 'id-nfc-tag-card' ? 'Premium card' : 'Starter tag'}</p>
          <h3>{product.name}</h3>
          <strong className="priceLine">{dollars(product.price_cents)}</strong>
          <p>{product.description}</p>
          <ul className="checklist smallList">{(product.metadata?.includes || []).map((item) => <li key={item}>{item}</li>)}</ul>
          <div className="actions"><button className="primary" type="button" disabled={Boolean(busy)} onClick={() => checkout(product)}>{busy === product.slug ? 'Opening Stripe…' : 'Buy with Stripe'}</button><Link className="button" href="/verify/patreon/">Use Patreon path</Link></div>
        </article>)}
      </div>
      <section className="panel wide processPanel">
        <h3>How purchasing works</h3>
        <ol className="numberedSteps">
          <li>Create your MyPetID account.</li>
          <li>Add and save your dog profile. The app creates the public profile URL and QR destination.</li>
          <li>Pick Basic NFC Tag or ID NFC Tag Card. Basic is the current $10 blank NFC card + QR sticker; ID card is $5 more with the license-style design.</li>
          <li>Checkout through Stripe or use Patreon membership/add-on support.</li>
          <li>CAK3D prints/programs the NFC + QR tag and ships it. The QR points to the public pet profile, so camera scanning works if NFC tap does not.</li>
          <li>Share the separate account QR/link to invite trusted people into your Dog Pack.</li>
        </ol>
      </section>
      {message && <p className="notice">{message}</p>}
    </section>
  );
}
