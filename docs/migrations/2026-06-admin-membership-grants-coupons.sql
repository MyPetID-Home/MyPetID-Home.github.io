-- Admin-managed membership grants and app coupon codes.
-- Supports free paid-tier trials, admin comps, and optional Stripe promotion-code sync.

create table if not exists public.membership_grants (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  tier text not null check (tier in ('basic', 'silver', 'gold', 'diamond', 'admin')),
  status text not null default 'active' check (status in ('active', 'revoked', 'expired')),
  source text not null default 'admin' check (source in ('admin', 'coupon', 'support', 'patreon_comp', 'stripe_promo')),
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  granted_by uuid references public.profiles(id) on delete set null,
  coupon_id uuid,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.access_coupons (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  code_hint text,
  tier text not null check (tier in ('basic', 'silver', 'gold', 'diamond', 'admin')),
  duration_days integer,
  max_redemptions integer not null default 1 check (max_redemptions > 0),
  redemption_count integer not null default 0 check (redemption_count >= 0),
  status text not null default 'active' check (status in ('active', 'disabled', 'expired')),
  recipient_email text,
  created_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz,
  redeemed_by uuid references public.profiles(id) on delete set null,
  redeemed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'membership_grants_coupon_fk'
  ) then
    alter table public.membership_grants
      add constraint membership_grants_coupon_fk foreign key (coupon_id) references public.access_coupons(id) on delete set null;
  end if;
end $$;

create index if not exists membership_grants_profile_idx on public.membership_grants(profile_id, status, expires_at desc);
create index if not exists membership_grants_tier_idx on public.membership_grants(tier, status);
create index if not exists access_coupons_hash_idx on public.access_coupons(code_hash);
create index if not exists access_coupons_recipient_idx on public.access_coupons(lower(recipient_email), status, created_at desc);

alter table public.membership_grants enable row level security;
alter table public.access_coupons enable row level security;

drop policy if exists "membership grants owner/admin read" on public.membership_grants;
create policy "membership grants owner/admin read" on public.membership_grants for select using (
  auth.uid() = profile_id or public.is_app_admin()
);

drop policy if exists "membership grants admin write" on public.membership_grants;
create policy "membership grants admin write" on public.membership_grants for all using (public.is_app_admin()) with check (public.is_app_admin());

drop policy if exists "access coupons admin read" on public.access_coupons;
create policy "access coupons admin read" on public.access_coupons for select using (public.is_app_admin());

drop policy if exists "access coupons admin write" on public.access_coupons;
create policy "access coupons admin write" on public.access_coupons for all using (public.is_app_admin()) with check (public.is_app_admin());

drop trigger if exists membership_grants_touch_updated_at on public.membership_grants;
create trigger membership_grants_touch_updated_at before update on public.membership_grants
  for each row execute function public.touch_updated_at();

drop trigger if exists access_coupons_touch_updated_at on public.access_coupons;
create trigger access_coupons_touch_updated_at before update on public.access_coupons
  for each row execute function public.touch_updated_at();
