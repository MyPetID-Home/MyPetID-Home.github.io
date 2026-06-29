-- MyPetID Stripe subscription tier metadata.
-- Adds Stripe monthly product/price IDs to membership_tiers and mirrors live Stripe objects.

begin;

alter table public.membership_tiers
  add column if not exists stripe_product_id text,
  add column if not exists stripe_price_id text,
  add column if not exists payment_provider text not null default 'stripe',
  add column if not exists checkout_enabled boolean not null default false;

update public.membership_tiers set
  stripe_product_id = null,
  stripe_price_id = null,
  payment_provider = 'none',
  checkout_enabled = false
where tier in ('free','admin');

update public.membership_tiers set
  monthly_price = 3,
  max_tags = 1,
  max_users = 1,
  scan_tracking_enabled = true,
  notes = 'One NFC tag and one user account. Stripe monthly subscription alternative to Patreon.',
  stripe_product_id = 'prod_UnELC96x4o7wAn',
  stripe_price_id = 'price_1TndsTRyFPKB13h6G1R3E0sR',
  payment_provider = 'stripe',
  checkout_enabled = true
where tier = 'basic';

update public.membership_tiers set
  monthly_price = 4,
  max_tags = 1,
  max_users = 2,
  scan_tracking_enabled = true,
  notes = 'One NFC tag and two user accounts. Stripe monthly subscription alternative to Patreon.',
  stripe_product_id = 'prod_UnELy5gMUXtQmz',
  stripe_price_id = 'price_1TndsURyFPKB13h6SVRR8lkZ',
  payment_provider = 'stripe',
  checkout_enabled = true
where tier = 'silver';

update public.membership_tiers set
  monthly_price = 6,
  max_tags = 2,
  max_users = 1,
  scan_tracking_enabled = true,
  notes = 'Two NFC tags and one user account. Stripe monthly subscription alternative to Patreon.',
  stripe_product_id = 'prod_UnELAtqw2lFGrE',
  stripe_price_id = 'price_1TndsURyFPKB13h6Eu0o8F6P',
  payment_provider = 'stripe',
  checkout_enabled = true
where tier = 'gold';

update public.membership_tiers set
  monthly_price = 10,
  max_tags = 3,
  max_users = 2,
  scan_tracking_enabled = true,
  notes = 'Flexible: two tags plus two users, or three tags plus one user. Stripe monthly subscription alternative to Patreon.',
  stripe_product_id = 'prod_UnELeqT3ZB2UXy',
  stripe_price_id = 'price_1TndsVRyFPKB13h6P2ZDk9Vr',
  payment_provider = 'stripe',
  checkout_enabled = true
where tier = 'diamond';

commit;
