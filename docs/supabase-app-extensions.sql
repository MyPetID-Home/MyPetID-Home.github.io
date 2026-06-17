-- MyPetID app feature extensions after starter schema.
-- Adds richer care app tables and utility fields used by the Next dashboard.

alter table public.profiles
  add column if not exists patreon_linked boolean not null default false,
  add column if not exists patreon_tier text,
  add column if not exists first_tag_coupon_code text,
  add column if not exists public_contact jsonb not null default '{}'::jsonb;

alter table public.pets
  add column if not exists feeding_plan text,
  add column if not exists care_notes text,
  add column if not exists public_fields text[] not null default array['name','photo','contact','medical_public','behavior_public','lost_mode','last_scan'];

create table if not exists public.pet_care_events (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null check (event_type in ('feed','walk','play','play_date','appointment','medicine','note')),
  title text not null,
  notes text,
  scheduled_for timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.pet_documents (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  document_type text not null default 'document',
  storage_path text,
  public_visible boolean not null default false,
  expires_at date,
  created_at timestamptz not null default now()
);

create table if not exists public.membership_tiers (
  tier text primary key,
  monthly_price numeric not null default 0,
  max_tags integer not null default 0,
  max_users integer not null default 1,
  scan_tracking_enabled boolean not null default false,
  notes text
);

insert into public.membership_tiers (tier, monthly_price, max_tags, max_users, scan_tracking_enabled, notes)
values
  ('free', 0, 0, 1, false, 'One user profile and one pet profile preview; location scanning disabled.'),
  ('basic', 3, 1, 1, true, 'One NFC tag and one user account.'),
  ('silver', 4, 1, 2, true, 'One NFC tag and two user accounts.'),
  ('gold', 6, 2, 1, true, 'Two NFC tags and one user account.'),
  ('diamond', 10, 3, 2, true, 'Flexible: two tags plus two users, or three tags plus one user.'),
  ('admin', 0, 999, 999, true, 'Unrestricted CAK3D test/admin access.')
on conflict (tier) do update set
  monthly_price = excluded.monthly_price,
  max_tags = excluded.max_tags,
  max_users = excluded.max_users,
  scan_tracking_enabled = excluded.scan_tracking_enabled,
  notes = excluded.notes;

alter table public.pet_care_events enable row level security;
alter table public.pet_documents enable row level security;
alter table public.membership_tiers enable row level security;

drop policy if exists "care owner access" on public.pet_care_events;
create policy "care owner access" on public.pet_care_events for all
  using (auth.uid() = owner_id or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (auth.uid() = owner_id or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

drop policy if exists "documents owner access" on public.pet_documents;
create policy "documents owner access" on public.pet_documents for all
  using (auth.uid() = owner_id or public_visible or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (auth.uid() = owner_id or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

drop policy if exists "tiers public read" on public.membership_tiers;
create policy "tiers public read" on public.membership_tiers for select using (true);
