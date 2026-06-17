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
  contact_public jsonb not null default '{}'::jsonb,
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
create policy "profiles owner read" on public.profiles for select using (auth.uid() = id or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
create policy "profiles owner update" on public.profiles for update using (auth.uid() = id or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
create policy "pets public read" on public.pets for select using (true);
create policy "pets owner write" on public.pets for all using (auth.uid() = owner_id or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
create policy "tags public read" on public.tags for select using (true);
create policy "scan insert public" on public.scan_events for insert with check (true);
create policy "scan read linked" on public.scan_events for select using (true);
