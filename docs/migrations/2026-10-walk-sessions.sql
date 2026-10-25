-- Recorded walks: the GPS path, time, distance, speed, stops, steps and pee/poop marks.
-- Each owner can only see and change their own walks. Safe to run more than once. ASCII only.

create table if not exists public.walk_sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  pet_id uuid references public.pets(id) on delete set null,
  name text,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_s integer not null default 0 check (duration_s >= 0),
  moving_s integer not null default 0 check (moving_s >= 0),
  distance_m numeric(10, 1) not null default 0 check (distance_m >= 0),
  avg_speed_mps numeric(6, 3),
  max_speed_mps numeric(6, 3),
  stops integer not null default 0,
  avg_stop_s integer,
  steps integer,
  steps_source text check (steps_source in ('motion', 'estimate')),
  -- [[lng, lat, seconds since start], ...], thinned to at most a few thousand points
  path jsonb not null default '[]'::jsonb,
  -- [{"kind":"pee"|"poop","lng":..,"lat":..,"t":seconds}, ...]
  events jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  constraint walk_sessions_time_order check (ended_at >= started_at),
  constraint walk_sessions_path_size check (jsonb_array_length(path) <= 20000),
  constraint walk_sessions_events_size check (jsonb_array_length(events) <= 500)
);

create index if not exists walk_sessions_profile_started on public.walk_sessions(profile_id, started_at desc);

alter table public.walk_sessions enable row level security;

drop policy if exists "walk sessions own" on public.walk_sessions;
create policy "walk sessions own" on public.walk_sessions for all to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid() and (pet_id is null or exists (select 1 from public.pets p where p.id = pet_id and p.owner_id = auth.uid())));

drop policy if exists "walk sessions admin read" on public.walk_sessions;
create policy "walk sessions admin read" on public.walk_sessions for select to authenticated using (public.is_app_admin());

revoke all on public.walk_sessions from anon;
grant select, insert, update, delete on public.walk_sessions to authenticated;

select count(*) as walk_sessions_rows from public.walk_sessions;
