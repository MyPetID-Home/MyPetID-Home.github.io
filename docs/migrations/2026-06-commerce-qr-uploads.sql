-- MyPetID commerce, QR, dog-pack invite, upload, and provider-token schema.
-- Live-ready idempotent migration for Supabase project ryyaefxszkmibcnngnfg.

begin;

create or replace function public.is_app_admin(check_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = check_id
      and (p.is_admin = true or p.tier::text = 'admin')
  );
$$;

grant execute on function public.is_app_admin(uuid) to anon, authenticated;

create table if not exists public.tag_products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null,
  tag_type text not null check (tag_type in ('basic_nfc', 'id_nfc')),
  price_cents integer not null,
  currency text not null default 'usd',
  stripe_product_id text,
  stripe_price_id text,
  patreon_label text,
  active boolean not null default true,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tag_orders (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  pet_id uuid references public.pets(id) on delete set null,
  tag_product_id uuid references public.tag_products(id) on delete set null,
  provider text not null default 'stripe' check (provider in ('stripe','patreon','manual','admin')),
  provider_checkout_id text,
  provider_payment_id text,
  provider_subscription_id text,
  status text not null default 'draft' check (status in ('draft','checkout_started','paid','queued','printing','shipped','delivered','cancelled','refunded','manual_review')),
  amount_cents integer,
  currency text default 'usd',
  public_pet_url text,
  qr_payload text,
  ship_to jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pet_qr_codes (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  qr_type text not null check (qr_type in ('public_pet_profile','account_share','dog_pack_invite','tag_order')),
  payload_url text not null,
  storage_path text,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(pet_id, qr_type, payload_url)
);

create table if not exists public.account_qr_codes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  payload_url text not null,
  storage_path text,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(profile_id, payload_url)
);

create table if not exists public.dog_pack_invites (
  id uuid primary key default gen_random_uuid(),
  inviter_profile_id uuid not null references public.profiles(id) on delete cascade,
  inviter_pet_id uuid references public.pets(id) on delete cascade,
  invite_code text not null unique default encode(gen_random_bytes(12), 'hex'),
  invite_url text,
  status text not null default 'open' check (status in ('open','accepted','revoked','expired')),
  max_uses integer not null default 1,
  used_count integer not null default 0,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.provider_credentials (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('google','patreon','stripe')),
  provider_subject text,
  access_token text,
  refresh_token text,
  scopes text[] not null default '{}',
  expires_at timestamptz,
  status text not null default 'active' check (status in ('active','revoked','expired','failed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(profile_id, provider)
);

create table if not exists public.upload_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  pet_id uuid references public.pets(id) on delete cascade,
  document_id uuid,
  upload_kind text not null check (upload_kind in ('pet_photo','profile_image','medical_document','tag_asset')),
  bucket_id text not null,
  storage_path text not null,
  public_url text,
  google_status text not null default 'not_connected' check (google_status in ('not_connected','queued','synced','failed','skipped')),
  google_resource_id text,
  google_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.membership_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  provider text not null check (provider in ('stripe','patreon','manual','admin')),
  provider_customer_id text,
  provider_subscription_id text,
  tier text,
  status text not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tag_products enable row level security;
alter table public.tag_orders enable row level security;
alter table public.pet_qr_codes enable row level security;
alter table public.account_qr_codes enable row level security;
alter table public.dog_pack_invites enable row level security;
alter table public.provider_credentials enable row level security;
alter table public.upload_events enable row level security;
alter table public.membership_events enable row level security;

drop policy if exists "tag products public read active" on public.tag_products;
create policy "tag products public read active" on public.tag_products for select using (active = true or public.is_app_admin());
drop policy if exists "tag products admin write" on public.tag_products;
create policy "tag products admin write" on public.tag_products for all using (public.is_app_admin()) with check (public.is_app_admin());

drop policy if exists "tag orders owner read" on public.tag_orders;
create policy "tag orders owner read" on public.tag_orders for select using (profile_id = auth.uid() or public.is_app_admin());
drop policy if exists "tag orders owner insert" on public.tag_orders;
create policy "tag orders owner insert" on public.tag_orders for insert with check (profile_id = auth.uid() or public.is_app_admin());
drop policy if exists "tag orders owner update" on public.tag_orders;
create policy "tag orders owner update" on public.tag_orders for update using (profile_id = auth.uid() or public.is_app_admin()) with check (profile_id = auth.uid() or public.is_app_admin());

drop policy if exists "pet qr owner read" on public.pet_qr_codes;
create policy "pet qr owner read" on public.pet_qr_codes for select using (profile_id = auth.uid() or public.is_app_admin());
drop policy if exists "pet qr owner write" on public.pet_qr_codes;
create policy "pet qr owner write" on public.pet_qr_codes for all using (profile_id = auth.uid() or public.is_app_admin()) with check (profile_id = auth.uid() or public.is_app_admin());

drop policy if exists "account qr owner read" on public.account_qr_codes;
create policy "account qr owner read" on public.account_qr_codes for select using (profile_id = auth.uid() or public.is_app_admin());
drop policy if exists "account qr owner write" on public.account_qr_codes;
create policy "account qr owner write" on public.account_qr_codes for all using (profile_id = auth.uid() or public.is_app_admin()) with check (profile_id = auth.uid() or public.is_app_admin());

drop policy if exists "dog pack invite owner read" on public.dog_pack_invites;
create policy "dog pack invite owner read" on public.dog_pack_invites for select using (inviter_profile_id = auth.uid() or public.is_app_admin());
drop policy if exists "dog pack invite owner write" on public.dog_pack_invites;
create policy "dog pack invite owner write" on public.dog_pack_invites for all using (inviter_profile_id = auth.uid() or public.is_app_admin()) with check (inviter_profile_id = auth.uid() or public.is_app_admin());

drop policy if exists "provider credentials server/admin read" on public.provider_credentials;
create policy "provider credentials server/admin read" on public.provider_credentials for select using (public.is_app_admin());

drop policy if exists "upload events owner read" on public.upload_events;
create policy "upload events owner read" on public.upload_events for select using (profile_id = auth.uid() or public.is_app_admin());
drop policy if exists "upload events owner insert" on public.upload_events;
create policy "upload events owner insert" on public.upload_events for insert with check (profile_id = auth.uid() or public.is_app_admin());

drop policy if exists "membership events owner read" on public.membership_events;
create policy "membership events owner read" on public.membership_events for select using (profile_id = auth.uid() or public.is_app_admin());
drop policy if exists "membership events server/admin write" on public.membership_events;
create policy "membership events server/admin write" on public.membership_events for all using (public.is_app_admin()) with check (public.is_app_admin());

create index if not exists tag_orders_profile_idx on public.tag_orders(profile_id, created_at desc);
create index if not exists tag_orders_provider_checkout_idx on public.tag_orders(provider, provider_checkout_id);
create index if not exists pet_qr_codes_pet_idx on public.pet_qr_codes(pet_id, active);
create index if not exists account_qr_codes_profile_idx on public.account_qr_codes(profile_id, active);
create index if not exists dog_pack_invites_code_idx on public.dog_pack_invites(invite_code);
create index if not exists upload_events_profile_pet_idx on public.upload_events(profile_id, pet_id, created_at desc);
create index if not exists membership_events_profile_idx on public.membership_events(profile_id, created_at desc);

insert into public.tag_products (slug, name, description, tag_type, price_cents, currency, stripe_product_id, stripe_price_id, patreon_label, active, sort_order, metadata)
values
  ('basic-nfc-tag', 'Basic NFC Tag', 'Blank NFC tag card with a MyPetID QR-code sticker. The QR points to the saved public pet profile so finders can tap or scan with a camera.', 'basic_nfc', 1000, 'usd', 'prod_Un60sX94yR5Z9F', 'price_1TnVoeRyFPKB13h6BmIypiKO', 'Basic NFC Tag add-on', true, 10, '{"includes":["Blank NFC card","QR-code sticker","Public pet profile link","Tap or camera scan"]}'::jsonb),
  ('id-nfc-tag-card', 'ID NFC Tag Card', 'License-style MyPetID NFC tag card with printed ID-card look, NFC tap, and QR-code camera fallback for the saved public pet profile.', 'id_nfc', 1500, 'usd', 'prod_Un60LcXQa31iDB', 'price_1TnVofRyFPKB13h6gdhkiqU2', 'ID NFC Tag Card add-on', true, 20, '{"includes":["License-style ID card design","Printed pet identity layout","NFC tap","QR-code camera fallback"]}'::jsonb)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  tag_type = excluded.tag_type,
  price_cents = excluded.price_cents,
  currency = excluded.currency,
  stripe_product_id = excluded.stripe_product_id,
  stripe_price_id = excluded.stripe_price_id,
  patreon_label = excluded.patreon_label,
  active = excluded.active,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  updated_at = now();

commit;
