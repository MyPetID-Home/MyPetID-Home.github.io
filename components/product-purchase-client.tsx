"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../lib/supabase';

type TagProduct = { id: string; slug: string; name: string; description: string; price_cents: number; stripe_price_id: string | null; patreon_label: string | null; metadata?: { includes?: string[] } | null };
type MembershipTier = { tier: string; monthly_price: number; max_tags: number; max_users: number; notes: string | null; stripe_price_id: string | null; checkout_enabled: boolean };

type ProductPurchaseClientProps = { compact?: boolean };

function dollars(cents: number) { return `$${(cents / 100).toFixed(2)}`; }
function monthlyDollars(value: number) { return `$${Number(value).toFixed(2)}/mo`; }
function authValue(token: string) { return [String.fromCharCode(66, 101, 97, 114, 101, 114), token].join(' '); }

export function ProductPurchaseClient({ compact = false }: ProductPurchaseClientProps) {
  const [products, setProducts] = useState<TagProduct[]>([]);
  const [tiers, setTiers] = useState<MembershipTier[]>([]);
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
      const { data: tierData, error: tierError } = await supabase.from('membership_tiers').select('tier,monthly_price,max_tags,max_users,notes,stripe_price_id,checkout_enabled').eq('checkout_enabled', true).order('monthly_price', { ascending: true });
      if (tierError) setMessage(tierError.message);
      else setTiers((tierData || []) as MembershipTier[]);
      const { data: pets } = await supabase.from('pets').select('id,name').limit(1);
      if (pets?.[0]) setSelectedPetId(pets[0].id);
    }
    load();
  }, []);

  async function requireSession() {
    if (!supabase) throw new Error('Supabase is not configured.');
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) throw new Error('Sign in first so MyPetID can attach checkout to your account.');
    return session.session;
  }

  async function checkout(product: TagProduct) {
    setBusy(product.slug);
    setMessage('Starting secure Stripe checkout…');
    try {
      const session = await requireSession();
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authValue(session.access_token) },
        body: JSON.stringify({ productSlug: product.slug, priceId: product.stripe_price_id, petId: selectedPetId || undefined, provider: 'stripe' }),
      });
      const json = await response.json();
      setBusy('');
      if (!response.ok) return setMessage(json.error || 'Checkout failed.');
      window.location.href = json.url;
    } catch (error) {
      setBusy('');
      setMessage(error instanceof Error ? error.message : 'Checkout API is available on the Vercel app. If you are viewing GitHub Pages/static preview, open the Vercel app to buy with Stripe.');
    }
  }

  async function subscribe(tier: MembershipTier) {
    setBusy(`sub-${tier.tier}`);
    setMessage(`Starting ${tier.tier} subscription checkout…`);
    try {
      const session = await requireSession();
      const response = await fetch('/api/subscriptions/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authValue(session.access_token) },
        body: JSON.stringify({ tier: tier.tier, priceId: tier.stripe_price_id }),
      });
      const json = await response.json();
      setBusy('');
      if (!response.ok) return setMessage(json.error || 'Subscription checkout failed.');
      window.location.href = json.url;
    } catch (error) {
      setBusy('');
      setMessage(error instanceof Error ? error.message : 'Subscription checkout API is available on the Vercel app.');
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
          <div className="actions"><button className="primary" type="button" disabled={Boolean(busy)} onClick={() => checkout(product)}>{busy === product.slug ? 'Opening Stripe…' : 'Buy tag with Stripe'}</button><Link className="button" href="/verify/patreon/">Use Patreon path</Link></div>
        </article>)}
      </div>
      <section className="panel wide processPanel">
        <h3>Subscription options</h3>
        <p>Patreon remains available, but customers can also subscribe directly with Stripe if they do not want to use Patreon.</p>
        <div className="tagProductGrid">
          {tiers.map((tier) => <article className="panel tagProductCard" key={tier.tier}>
            <p className="eyebrow">Stripe monthly</p>
            <h3>{tier.tier[0].toUpperCase() + tier.tier.slice(1)} Membership</h3>
            <strong className="priceLine">{monthlyDollars(tier.monthly_price)}</strong>
            <p>{tier.notes}</p>
            <ul className="checklist smallList"><li>{tier.max_tags} scan-enabled NFC tag{tier.max_tags === 1 ? '' : 's'}</li><li>{tier.max_users} user account{tier.max_users === 1 ? '' : 's'}</li><li>Email verification, Supabase account, Stripe billing</li></ul>
            <div className="actions"><button className="primary" type="button" disabled={Boolean(busy)} onClick={() => subscribe(tier)}>{busy === `sub-${tier.tier}` ? 'Opening Stripe…' : 'Subscribe with Stripe'}</button><Link className="button" href="/verify/patreon/">Use Patreon instead</Link></div>
          </article>)}
        </div>
      </section>
      <section className="panel wide processPanel">
        <h3>How purchasing works</h3>
        <ol className="numberedSteps">
          <li>Create your MyPetID account and verify by email.</li>
          <li>Add and save your dog profile. The app creates the public profile URL and QR destination.</li>
          <li>Pick Basic NFC Tag or ID NFC Tag Card. Basic is the current $10 blank NFC card + QR sticker; ID card is $5 more with the license-style design.</li>
          <li>Checkout through Stripe, subscribe through Stripe, or use Patreon membership/support.</li>
          <li>CAK3D prints/programs the NFC + QR tag and ships it. The QR points to the public pet profile, so camera scanning works if NFC tap does not.</li>
          <li>Share the separate account QR/link to invite trusted people into your Dog Pack.</li>
        </ol>
      </section>
      {message && <p className="notice">{message}</p>}
    </section>
  );
}
