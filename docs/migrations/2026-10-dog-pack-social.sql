-- MyPetID Dog Pack social features (October 2026): friends via invite, chat,
-- meetups on the map, and opt-in "nearby owners".
-- Target project: ryyaefxszkmibcnngnfg. Idempotent: safe to run more than once.
-- Requires 2026-10-security-hardening.sql (is_app_admin) to have run first.
--
-- Safety rules (all enforced here, not just in the app):
--   * Only verified accounts (confirmed email, or admin) can message, meet up or see nearby owners.
--   * Chat is only between Dog Pack friends.
--   * Nearby locations are stored rounded to ~1 km and only returned as an approximate distance.
--   * A meetup with 3+ reports is hidden automatically until an admin reviews it.

begin;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.mypetid_is_verified(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select uid is not null and (
    exists (select 1 from auth.users u where u.id = uid and u.email_confirmed_at is not null)
    or exists (select 1 from public.profiles p where p.id = uid and (p.email_verified_at is not null or p.is_admin))
  );
$$;
revoke all on function public.mypetid_is_verified(uuid) from public;
grant execute on function public.mypetid_is_verified(uuid) to authenticated;

create or replace function public.are_pack_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profile_links l
    where l.status = 'accepted'
      and ((l.requester_id = a and l.receiver_id = b) or (l.requester_id = b and l.receiver_id = a))
  );
$$;
revoke all on function public.are_pack_friends(uuid, uuid) from public;
grant execute on function public.are_pack_friends(uuid, uuid) to authenticated;

-- A short, friendly name for showing to other owners (never the email address).
create or replace function public.mypetid_public_name(uid uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(nullif(split_part(trim(p.display_name), ' ', 1), ''), 'Dog owner') from public.profiles p where p.id = uid;
$$;
revoke all on function public.mypetid_public_name(uuid) from public;
grant execute on function public.mypetid_public_name(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Dog Pack friends (profile_links had RLS on but no policies)
-- ---------------------------------------------------------------------------
drop policy if exists "pack links own read" on public.profile_links;
create policy "pack links own read" on public.profile_links for select
  using (requester_id = auth.uid() or receiver_id = auth.uid() or public.is_app_admin());
drop policy if exists "pack links own delete" on public.profile_links;
create policy "pack links own delete" on public.profile_links for delete
  using (requester_id = auth.uid() or receiver_id = auth.uid());

-- Accept a Dog Pack invite link (/dashboard/pack/?invite=CODE). Returns the inviter's id.
create or replace function public.accept_pack_invite(p_code text)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_invite public.dog_pack_invites%rowtype;
  v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'Sign in to join a Dog Pack.' using errcode = '42501'; end if;
  select * into v_invite from public.dog_pack_invites where invite_code = trim(p_code) for update;
  if v_invite.id is null or v_invite.status not in ('open', 'accepted')
     or (v_invite.expires_at is not null and v_invite.expires_at < now())
     or v_invite.used_count >= v_invite.max_uses then
    raise exception 'This invite link has expired or was already used.' using errcode = 'P0002';
  end if;
  if v_invite.inviter_profile_id = v_me then raise exception 'That’s your own invite link.' using errcode = '22023'; end if;
  if not public.are_pack_friends(v_invite.inviter_profile_id, v_me) then
    insert into public.profile_links (requester_id, receiver_id, status, accepted_at)
    values (v_invite.inviter_profile_id, v_me, 'accepted', now())
    on conflict (requester_id, receiver_id) do update set status = 'accepted', accepted_at = now();
  end if;
  update public.dog_pack_invites
     set used_count = used_count + 1,
         status = case when used_count + 1 >= max_uses then 'accepted' else status end,
         updated_at = now()
   where id = v_invite.id;
  return v_invite.inviter_profile_id;
end;
$$;
revoke all on function public.accept_pack_invite(text) from public;
grant execute on function public.accept_pack_invite(text) to authenticated;

-- My Dog Pack friends with display names (profiles aren't readable across accounts).
create or replace function public.pack_friends()
returns table (profile_id uuid, name text, dog_name text, since timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select f.id, public.mypetid_public_name(f.id),
         (select pt.name from public.pets pt where pt.owner_id = f.id order by pt.created_at limit 1),
         l.accepted_at
  from public.profile_links l
  cross join lateral (select case when l.requester_id = auth.uid() then l.receiver_id else l.requester_id end as id) f
  where l.status = 'accepted' and (l.requester_id = auth.uid() or l.receiver_id = auth.uid())
  order by l.accepted_at desc nulls last;
$$;
revoke all on function public.pack_friends() from public;
grant execute on function public.pack_friends() to authenticated;

-- ---------------------------------------------------------------------------
-- Chat between Dog Pack friends
-- ---------------------------------------------------------------------------
create table if not exists public.pack_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists pack_messages_pair_idx on public.pack_messages (least(sender_id, receiver_id), greatest(sender_id, receiver_id), created_at desc);
alter table public.pack_messages enable row level security;
drop policy if exists "pack messages own read" on public.pack_messages;
create policy "pack messages own read" on public.pack_messages for select
  using (sender_id = auth.uid() or receiver_id = auth.uid());
drop policy if exists "pack messages friend send" on public.pack_messages;
create policy "pack messages friend send" on public.pack_messages for insert to authenticated
  with check (sender_id = auth.uid() and public.mypetid_is_verified() and public.are_pack_friends(sender_id, receiver_id));
drop policy if exists "pack messages own delete" on public.pack_messages;
create policy "pack messages own delete" on public.pack_messages for delete
  using (sender_id = auth.uid());

-- Live updates for chat (Supabase Realtime respects the read policy above)
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pack_messages') then
    alter publication supabase_realtime add table public.pack_messages;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Meetups
-- ---------------------------------------------------------------------------
create table if not exists public.meetups (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title text not null check (length(trim(title)) between 3 and 80),
  details text check (details is null or length(details) <= 600),
  starts_at timestamptz not null,
  place_name text check (place_name is null or length(place_name) <= 160),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  visibility text not null default 'public' check (visibility in ('public', 'pack')),
  max_dogs integer not null default 10 check (max_dogs between 2 and 50),
  status text not null default 'active' check (status in ('active', 'cancelled', 'hidden')),
  created_at timestamptz not null default now()
);
create index if not exists meetups_when_idx on public.meetups (starts_at);
alter table public.meetups enable row level security;
drop policy if exists "meetups visible read" on public.meetups;
create policy "meetups visible read" on public.meetups for select
  using (
    host_id = auth.uid() or public.is_app_admin()
    or (status = 'active' and public.mypetid_is_verified() and (visibility = 'public' or public.are_pack_friends(host_id, auth.uid())))
  );
drop policy if exists "meetups verified create" on public.meetups;
create policy "meetups verified create" on public.meetups for insert to authenticated
  with check (host_id = auth.uid() and public.mypetid_is_verified() and starts_at > now() - interval '1 hour' and status = 'active');
drop policy if exists "meetups host update" on public.meetups;
create policy "meetups host update" on public.meetups for update
  using (host_id = auth.uid() or public.is_app_admin())
  with check (host_id = auth.uid() or public.is_app_admin());
drop policy if exists "meetups host delete" on public.meetups;
create policy "meetups host delete" on public.meetups for delete
  using (host_id = auth.uid() or public.is_app_admin());

-- Hosts can't un-hide a meetup that reports hid; only admins can.
create or replace function public.mypetid_guard_meetup_status()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = 'hidden' and new.status <> 'hidden' and not public.is_app_admin() and current_user in ('anon', 'authenticated') then
    raise exception 'This meetup is under review by MyPetID.' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists mypetid_guard_meetup_status on public.meetups;
create trigger mypetid_guard_meetup_status before update on public.meetups
  for each row execute function public.mypetid_guard_meetup_status();

create table if not exists public.meetup_attendees (
  meetup_id uuid not null references public.meetups(id) on delete cascade,
  profile_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  dog_name text check (dog_name is null or length(dog_name) <= 60),
  created_at timestamptz not null default now(),
  primary key (meetup_id, profile_id)
);
alter table public.meetup_attendees enable row level security;
drop policy if exists "meetup attendees read" on public.meetup_attendees;
create policy "meetup attendees read" on public.meetup_attendees for select
  using (profile_id = auth.uid() or exists (select 1 from public.meetups m where m.id = meetup_id and m.host_id = auth.uid()) or public.is_app_admin());
drop policy if exists "meetup attendees join" on public.meetup_attendees;
create policy "meetup attendees join" on public.meetup_attendees for insert to authenticated
  with check (profile_id = auth.uid() and public.mypetid_is_verified() and exists (select 1 from public.meetups m where m.id = meetup_id and m.status = 'active'));
drop policy if exists "meetup attendees leave" on public.meetup_attendees;
create policy "meetup attendees leave" on public.meetup_attendees for delete
  using (profile_id = auth.uid() or exists (select 1 from public.meetups m where m.id = meetup_id and m.host_id = auth.uid()));

create table if not exists public.meetup_reports (
  id uuid primary key default gen_random_uuid(),
  meetup_id uuid not null references public.meetups(id) on delete cascade,
  reporter_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  reason text not null check (length(trim(reason)) between 3 and 300),
  created_at timestamptz not null default now(),
  unique (meetup_id, reporter_id)
);
alter table public.meetup_reports enable row level security;
drop policy if exists "meetup reports create" on public.meetup_reports;
create policy "meetup reports create" on public.meetup_reports for insert to authenticated
  with check (reporter_id = auth.uid() and public.mypetid_is_verified());
drop policy if exists "meetup reports admin read" on public.meetup_reports;
create policy "meetup reports admin read" on public.meetup_reports for select
  using (public.is_app_admin() or reporter_id = auth.uid());

create or replace function public.mypetid_autohide_reported_meetup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.meetup_reports r where r.meetup_id = new.meetup_id) >= 3 then
    update public.meetups set status = 'hidden' where id = new.meetup_id and status = 'active';
  end if;
  return new;
end;
$$;
drop trigger if exists mypetid_autohide_reported_meetup on public.meetup_reports;
create trigger mypetid_autohide_reported_meetup after insert on public.meetup_reports
  for each row execute function public.mypetid_autohide_reported_meetup();

-- Upcoming meetups near a point, with the host's first name and how many dogs are going.
create or replace function public.meetups_near(p_lat double precision, p_lng double precision, p_km double precision default 25)
returns table (id uuid, title text, details text, starts_at timestamptz, place_name text, lat double precision, lng double precision,
               visibility text, max_dogs integer, host_name text, is_host boolean, going integer, i_am_going boolean, km double precision)
language sql
stable
security definer
set search_path = public
as $$
  with mine as (select auth.uid() as uid)
  select m.id, m.title, m.details, m.starts_at, m.place_name, m.lat, m.lng, m.visibility, m.max_dogs,
         public.mypetid_public_name(m.host_id), m.host_id = mine.uid,
         (select count(*)::int from public.meetup_attendees a where a.meetup_id = m.id),
         exists (select 1 from public.meetup_attendees a where a.meetup_id = m.id and a.profile_id = mine.uid),
         round((111.32 * sqrt(power(m.lat - p_lat, 2) + power((m.lng - p_lng) * cos(radians(p_lat)), 2)))::numeric, 1)::double precision
  from public.meetups m, mine
  where m.status = 'active'
    and m.starts_at > now() - interval '2 hours'
    and public.mypetid_is_verified(mine.uid)
    and (m.visibility = 'public' or m.host_id = mine.uid or public.are_pack_friends(m.host_id, mine.uid))
    and abs(m.lat - p_lat) < least(p_km, 200) / 111.0
    and abs(m.lng - p_lng) < least(p_km, 200) / (111.0 * greatest(cos(radians(p_lat)), 0.2))
  order by m.starts_at
  limit 50;
$$;
revoke all on function public.meetups_near(double precision, double precision, double precision) from public;
grant execute on function public.meetups_near(double precision, double precision, double precision) to authenticated;

-- ---------------------------------------------------------------------------
-- Nearby owners (opt-in, approximate only)
-- ---------------------------------------------------------------------------
create table if not exists public.owner_presence (
  profile_id uuid primary key default auth.uid() references public.profiles(id) on delete cascade,
  lat_round double precision not null,
  lng_round double precision not null,
  dog_name text check (dog_name is null or length(dog_name) <= 60),
  updated_at timestamptz not null default now()
);
alter table public.owner_presence enable row level security;
drop policy if exists "presence own" on public.owner_presence;
create policy "presence own" on public.owner_presence for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid() and public.mypetid_is_verified());

-- Never store an exact position: snap to a ~1 km grid on every write.
create or replace function public.mypetid_round_presence()
returns trigger
language plpgsql
as $$
begin
  new.lat_round := round(new.lat_round::numeric, 2)::double precision;
  new.lng_round := round(new.lng_round::numeric, 2)::double precision;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists mypetid_round_presence on public.owner_presence;
create trigger mypetid_round_presence before insert or update on public.owner_presence
  for each row execute function public.mypetid_round_presence();

-- Owners who shared their area in the last 3 hours, as a first name + dog + rough distance.
create or replace function public.nearby_owners(p_lat double precision, p_lng double precision, p_km double precision default 10)
returns table (name text, dog_name text, approx_km double precision, minutes_ago integer, is_friend boolean)
language sql
stable
security definer
set search_path = public
as $$
  select public.mypetid_public_name(o.profile_id), o.dog_name,
         greatest(1, round((111.32 * sqrt(power(o.lat_round - p_lat, 2) + power((o.lng_round - p_lng) * cos(radians(p_lat)), 2)))::numeric))::double precision,
         (extract(epoch from now() - o.updated_at) / 60)::int,
         public.are_pack_friends(o.profile_id, auth.uid())
  from public.owner_presence o
  where public.mypetid_is_verified()
    and o.profile_id <> auth.uid()
    and o.updated_at > now() - interval '3 hours'
    and abs(o.lat_round - p_lat) < least(p_km, 50) / 111.0
    and abs(o.lng_round - p_lng) < least(p_km, 50) / (111.0 * greatest(cos(radians(p_lat)), 0.2))
  order by 3
  limit 40;
$$;
revoke all on function public.nearby_owners(double precision, double precision, double precision) from public;
grant execute on function public.nearby_owners(double precision, double precision, double precision) to authenticated;

commit;
