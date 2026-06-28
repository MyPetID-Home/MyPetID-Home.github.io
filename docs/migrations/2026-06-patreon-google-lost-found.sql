-- Idempotent MyPetID Patreon, Google, Calendar, and lost/found extension.
-- Safe to run after the starter schema exists.

alter table public.profiles add column if not exists patreon_linked boolean not null default false;
alter table public.profiles add column if not exists patreon_tier text;
alter table public.profiles add column if not exists google_photos_linked boolean not null default false;
alter table public.profiles add column if not exists google_drive_linked boolean not null default false;
alter table public.profiles add column if not exists google_calendar_linked boolean not null default false;

alter table public.scan_events add column if not exists finder_contact text;
alter table public.scan_events add column if not exists finder_note text;
alter table public.scan_events add column if not exists owner_alert_status text not null default 'new';

create table if not exists public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('patreon', 'google')),
  requested_scopes text[] not null default '{}',
  status text not null check (status in ('pending', 'approved', 'denied', 'verified', 'failed')) default 'pending',
  provider_subject text,
  verified_tier text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  pet_id uuid references public.pets(id) on delete cascade,
  title text not null,
  category text not null,
  starts_at timestamptz not null,
  source text not null default 'mypetid',
  google_event_id text,
  created_at timestamptz not null default now()
);

alter table public.verification_requests enable row level security;
alter table public.calendar_events enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='verification_requests' and policyname='verification owner read') then
    create policy "verification owner read" on public.verification_requests for select using (auth.uid() = profile_id or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='verification_requests' and policyname='verification owner insert') then
    create policy "verification owner insert" on public.verification_requests for insert with check (auth.uid() = profile_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='verification_requests' and policyname='verification owner update') then
    create policy "verification owner update" on public.verification_requests for update using (auth.uid() = profile_id or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)) with check (auth.uid() = profile_id or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='calendar_events' and policyname='calendar owner read') then
    create policy "calendar owner read" on public.calendar_events for select using (auth.uid() = profile_id or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='calendar_events' and policyname='calendar owner insert') then
    create policy "calendar owner insert" on public.calendar_events for insert with check (auth.uid() = profile_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='calendar_events' and policyname='calendar owner update') then
    create policy "calendar owner update" on public.calendar_events for update using (auth.uid() = profile_id or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)) with check (auth.uid() = profile_id or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
  end if;
end $$;
