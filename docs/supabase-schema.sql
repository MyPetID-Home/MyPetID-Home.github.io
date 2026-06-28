-- MyPetID-Home starter Supabase schema.
-- Run in Supabase SQL editor after project creation. Review RLS before production.

create type public.user_tier as enum ('free', 'basic', 'silver', 'gold', 'diamond', 'admin');
create type public.scan_actor as enum ('owner', 'linked_user', 'stranger');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  display_name text,
  phone text,
  tier public.user_tier not null default 'free',
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  species text not null default 'dog',
  breed text,
  photo_url text,
  medical_public text,
  behavior_public text,
  service_status text not null default 'Family pet',
  rescue_status text not null default 'Not set',
  contact_public jsonb not null default '{}'::jsonb,
  documents jsonb not null default '[]'::jsonb,
  lost_mode boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  tag_code text not null unique,
  pet_id uuid references public.pets(id) on delete set null,
  created_by uuid references public.profiles(id),
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  device_fingerprint text not null,
  trusted boolean not null default false,
  label text,
  created_at timestamptz not null default now(),
  unique(profile_id, device_fingerprint)
);

create table public.scan_events (
  id uuid primary key default gen_random_uuid(),
  tag_id uuid references public.tags(id) on delete set null,
  pet_id uuid references public.pets(id) on delete set null,
  actor public.scan_actor not null default 'stranger',
  scanner_profile_id uuid references public.profiles(id) on delete set null,
  latitude double precision,
  longitude double precision,
  accuracy_meters double precision,
  note text,
  reported_lost boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.profile_links (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('pending', 'accepted', 'blocked')) default 'pending',
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique(requester_id, receiver_id)
);

alter table public.profiles enable row level security;
alter table public.pets enable row level security;
alter table public.tags enable row level security;
alter table public.devices enable row level security;
alter table public.scan_events enable row level security;
alter table public.profile_links enable row level security;

-- Starter policies. Tighten before public launch.
-- Admin means an unrestricted CAK3D/tester profile row; never expose service-role keys in the static app.
create policy "profiles owner read" on public.profiles for select using (auth.uid() = id or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
create policy "profiles owner insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles owner update" on public.profiles for update using (auth.uid() = id or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)) with check (auth.uid() = id or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create policy "pets public read" on public.pets for select using (true);
create policy "pets owner insert" on public.pets for insert with check (auth.uid() = owner_id or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
create policy "pets owner update" on public.pets for update using (auth.uid() = owner_id or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)) with check (auth.uid() = owner_id or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
create policy "pets owner delete" on public.pets for delete using (auth.uid() = owner_id or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create policy "tags public read" on public.tags for select using (true);
create policy "tags admin insert" on public.tags for insert with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
create policy "tags owner claim or admin update" on public.tags for update using (pet_id is null or created_by = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)) with check (created_by = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create policy "devices owner read" on public.devices for select using (auth.uid() = profile_id or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
create policy "devices owner insert" on public.devices for insert with check (auth.uid() = profile_id);
create policy "devices owner update" on public.devices for update using (auth.uid() = profile_id or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)) with check (auth.uid() = profile_id or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create policy "scan insert public" on public.scan_events for insert with check (true);
create policy "scan read linked" on public.scan_events for select using (true);

create policy "profile links participant read" on public.profile_links for select using (auth.uid() in (requester_id, receiver_id) or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
create policy "profile links requester insert" on public.profile_links for insert with check (auth.uid() = requester_id);
create policy "profile links participant update" on public.profile_links for update using (auth.uid() in (requester_id, receiver_id) or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)) with check (auth.uid() in (requester_id, receiver_id) or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
