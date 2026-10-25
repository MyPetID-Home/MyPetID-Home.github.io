-- MyPetID (October 2026): notifications + announcements, map pins + saved walks/loops,
-- ID card templates, owner card details, and admin support/analytics functions.
-- Target project: ryyaefxszkmibcnngnfg. Idempotent. ASCII only (safe to paste).

begin;

-- ---------------------------------------------------------------------------
-- Owner details used on the ID card (address, card phone, state). Owner/admin only.
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists details jsonb not null default '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- Notifications (in-app inbox; email/push are sent by the server from these rows)
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'info' check (kind in ('info', 'alert', 'scan', 'pack', 'meetup', 'announcement', 'system')),
  title text not null check (length(title) between 1 and 120),
  body text check (body is null or length(body) <= 1000),
  link text check (link is null or length(link) <= 300),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_inbox_idx on public.notifications (profile_id, created_at desc);
alter table public.notifications enable row level security;
drop policy if exists "notifications own read" on public.notifications;
create policy "notifications own read" on public.notifications for select using (profile_id = auth.uid() or public.is_app_admin());
drop policy if exists "notifications own mark read" on public.notifications;
create policy "notifications own mark read" on public.notifications for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
drop policy if exists "notifications own remove" on public.notifications;
create policy "notifications own remove" on public.notifications for delete to authenticated using (profile_id = auth.uid());
drop policy if exists "notifications admin write" on public.notifications;
create policy "notifications admin write" on public.notifications for insert to authenticated with check (public.is_app_admin());
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

-- Users may only change read_at on their own notifications.
create or replace function public.mypetid_guard_notification_update()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user in ('anon', 'authenticated') and not public.is_app_admin() then
    new.kind := old.kind; new.title := old.title; new.body := old.body; new.link := old.link; new.profile_id := old.profile_id; new.created_at := old.created_at;
  end if;
  return new;
end;
$$;
drop trigger if exists mypetid_guard_notification_update on public.notifications;
create trigger mypetid_guard_notification_update before update on public.notifications
  for each row execute function public.mypetid_guard_notification_update();

-- Owner is notified when someone scans their dog's tag.
create or replace function public.mypetid_notify_scan()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_name text;
begin
  if new.actor <> 'stranger' or new.pet_id is null then return new; end if;
  select owner_id, name into v_owner, v_name from public.pets where id = new.pet_id;
  if v_owner is null then return new; end if;
  insert into public.notifications (profile_id, kind, title, body, link)
  values (v_owner, case when new.reported_lost then 'alert' else 'scan' end,
          case when new.reported_lost then v_name || ' was found! Someone shared a location.' else 'Someone scanned ' || v_name || '''s tag' end,
          nullif(left(coalesce(new.finder_note, '') || case when new.finder_contact is not null then ' Contact: ' || new.finder_contact else '' end, 900), ''),
          '/dashboard/alerts/');
  return new;
end;
$$;
drop trigger if exists mypetid_notify_scan on public.scan_events;
create trigger mypetid_notify_scan after insert on public.scan_events for each row execute function public.mypetid_notify_scan();

-- Dog Pack message -> notification for the receiver.
create or replace function public.mypetid_notify_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (profile_id, kind, title, body, link)
  values (new.receiver_id, 'pack', public.mypetid_public_name(new.sender_id) || ' sent you a message', left(new.body, 200), '/dashboard/pack/');
  return new;
end;
$$;
drop trigger if exists mypetid_notify_message on public.pack_messages;
create trigger mypetid_notify_message after insert on public.pack_messages for each row execute function public.mypetid_notify_message();

-- ---------------------------------------------------------------------------
-- Announcements (admin -> everyone or a group). Each one fans out to notifications.
-- ---------------------------------------------------------------------------
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 1 and 120),
  body text not null check (length(body) between 1 and 2000),
  link text check (link is null or length(link) <= 300),
  audience text not null default 'all' check (audience in ('all', 'members', 'free', 'admins')),
  send_email boolean not null default false,
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  recipients integer not null default 0,
  emailed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.announcements enable row level security;
drop policy if exists "announcements read" on public.announcements;
create policy "announcements read" on public.announcements for select to authenticated using (true);
drop policy if exists "announcements admin write" on public.announcements;
create policy "announcements admin write" on public.announcements for all to authenticated using (public.is_app_admin()) with check (public.is_app_admin());

create or replace function public.mypetid_fanout_announcement()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  insert into public.notifications (profile_id, kind, title, body, link)
  select p.id, 'announcement', new.title, left(new.body, 1000), new.link
  from public.profiles p
  where new.audience = 'all'
     or (new.audience = 'admins' and (p.is_admin or p.tier::text = 'admin'))
     or (new.audience = 'members' and p.tier::text not in ('free'))
     or (new.audience = 'free' and p.tier::text = 'free');
  get diagnostics v_count = row_count;
  update public.announcements set recipients = v_count where id = new.id;
  return new;
end;
$$;
drop trigger if exists mypetid_fanout_announcement on public.announcements;
create trigger mypetid_fanout_announcement after insert on public.announcements for each row execute function public.mypetid_fanout_announcement();

-- ---------------------------------------------------------------------------
-- Map pins and saved walks/loops (owner only)
-- ---------------------------------------------------------------------------
create table if not exists public.map_pins (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  kind text not null default 'favorite' check (kind in ('favorite', 'park', 'water', 'vet', 'parking', 'hazard', 'other')),
  note text check (note is null or length(note) <= 300),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  created_at timestamptz not null default now()
);
alter table public.map_pins enable row level security;
drop policy if exists "map pins own" on public.map_pins;
create policy "map pins own" on public.map_pins for all to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
drop policy if exists "map pins admin read" on public.map_pins;
create policy "map pins admin read" on public.map_pins for select using (public.is_app_admin());

create table if not exists public.saved_walks (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  kind text not null default 'route' check (kind in ('route', 'recorded')),
  is_loop boolean not null default false,
  path jsonb not null default '[]'::jsonb,
  distance_mi numeric(7, 2) not null default 0,
  duration_min integer,
  times_walked integer not null default 0,
  last_walked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists saved_walks_owner_idx on public.saved_walks (profile_id, created_at desc);
alter table public.saved_walks enable row level security;
drop policy if exists "saved walks own" on public.saved_walks;
create policy "saved walks own" on public.saved_walks for all to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
drop policy if exists "saved walks admin read" on public.saved_walks;
create policy "saved walks admin read" on public.saved_walks for select using (public.is_app_admin());

-- ---------------------------------------------------------------------------
-- ID card templates per US state (background image + where each field goes)
-- ---------------------------------------------------------------------------
create table if not exists public.card_templates (
  state text primary key check (state ~ '^[A-Z]{2}$'),
  background_url text,
  layout jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.card_templates enable row level security;
drop policy if exists "card templates read" on public.card_templates;
create policy "card templates read" on public.card_templates for select using (true);
drop policy if exists "card templates admin write" on public.card_templates;
create policy "card templates admin write" on public.card_templates for all to authenticated using (public.is_app_admin()) with check (public.is_app_admin());

-- ---------------------------------------------------------------------------
-- Admin support: search accounts, full account sheet, fix profiles and pets
-- ---------------------------------------------------------------------------
create or replace function public.admin_search_accounts(p_query text default '')
returns table (id uuid, email text, display_name text, tier text, is_admin boolean, verified boolean, pets integer, guest boolean, created_at timestamptz, last_sign_in_at timestamptz)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.is_app_admin() then raise exception 'Admins only.' using errcode = '42501'; end if;
  return query
  select p.id, p.email, p.display_name, p.tier::text, p.is_admin, (u.email_confirmed_at is not null or p.email_verified_at is not null),
         (select count(*)::int from public.pets pt where pt.owner_id = p.id), false, p.created_at, u.last_sign_in_at
  from public.profiles p left join auth.users u on u.id = p.id
  where coalesce(p_query, '') = '' or p.email ilike '%' || p_query || '%' or p.display_name ilike '%' || p_query || '%' or p.phone ilike '%' || p_query || '%' or p.id::text = p_query
     or exists (select 1 from public.pets pt where pt.owner_id = p.id and pt.name ilike '%' || p_query || '%')
  order by p.created_at desc
  limit 100;
end;
$$;

create or replace function public.admin_account_sheet(p_profile uuid)
returns jsonb
language plpgsql stable security definer set search_path = public, auth as $$
declare v jsonb;
begin
  if not public.is_app_admin() then raise exception 'Admins only.' using errcode = '42501'; end if;
  select jsonb_build_object(
    'profile', to_jsonb(p) - 'first_tag_coupon_code',
    'auth', (select jsonb_build_object('created_at', u.created_at, 'last_sign_in_at', u.last_sign_in_at, 'email_confirmed_at', u.email_confirmed_at, 'providers', coalesce(u.raw_app_meta_data -> 'providers', '[]'::jsonb), 'banned_until', u.banned_until) from auth.users u where u.id = p.id),
    'pets', coalesce((select jsonb_agg(to_jsonb(pt) order by pt.created_at) from public.pets pt where pt.owner_id = p.id), '[]'::jsonb),
    'tags', coalesce((select jsonb_agg(jsonb_build_object('tag_code', t.tag_code, 'status', t.status, 'pet_id', t.pet_id, 'claimed_at', t.claimed_at, 'nfc_uid', t.nfc_uid)) from public.tags t where t.created_by = p.id or t.pet_id in (select pt.id from public.pets pt where pt.owner_id = p.id)), '[]'::jsonb),
    'scans', coalesce((select jsonb_agg(s order by s.created_at desc) from (select s.created_at, s.reported_lost, s.latitude, s.longitude, s.finder_note, s.finder_contact, s.found_status from public.scan_events s where s.pet_id in (select pt.id from public.pets pt where pt.owner_id = p.id) order by s.created_at desc limit 20) s), '[]'::jsonb),
    'grants', coalesce((select jsonb_agg(to_jsonb(g) order by g.created_at desc) from public.membership_grants g where g.profile_id = p.id), '[]'::jsonb),
    'walks', (select count(*) from public.saved_walks w where w.profile_id = p.id),
    'pins', (select count(*) from public.map_pins m where m.profile_id = p.id),
    'friends', (select count(*) from public.profile_links l where l.status = 'accepted' and (l.requester_id = p.id or l.receiver_id = p.id)),
    'activity', coalesce((select jsonb_agg(a order by a.event_time desc) from (select a.event_time, a.action, a.target_table, a.changed_fields, a.actor_email from public.account_activity_log a where a.target_profile_id = p.id order by a.event_time desc limit 30) a), '[]'::jsonb)
  ) into v
  from public.profiles p where p.id = p_profile;
  return v;
end;
$$;

-- Fix a user's profile. Runs as definer, so it may change tier/verification/admin.
create or replace function public.admin_update_profile(p_profile uuid, p_patch jsonb)
returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_app_admin() then raise exception 'Admins only.' using errcode = '42501'; end if;
  update public.profiles set
    display_name = case when p_patch ? 'display_name' then nullif(trim(p_patch->>'display_name'), '') else display_name end,
    phone = case when p_patch ? 'phone' then nullif(trim(p_patch->>'phone'), '') else phone end,
    tier = case when p_patch ? 'tier' then (p_patch->>'tier')::user_tier else tier end,
    is_admin = case when p_patch ? 'is_admin' then (p_patch->>'is_admin')::boolean else is_admin end,
    email_verified_at = case when p_patch ? 'verified' then (case when (p_patch->>'verified')::boolean then coalesce(email_verified_at, now()) else null end) else email_verified_at end,
    public_contact = case when p_patch ? 'public_contact' then p_patch->'public_contact' else public_contact end,
    details = case when p_patch ? 'details' then p_patch->'details' else details end,
    updated_at = now()
  where id = p_profile;
end;
$$;

-- Fix any pet (including guest pets). Same whitelisted fields as the owner editor.
create or replace function public.admin_update_pet(p_pet uuid, p_patch jsonb)
returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_app_admin() then raise exception 'Admins only.' using errcode = '42501'; end if;
  update public.pets set
    name = coalesce(left(nullif(trim(p_patch->>'name'), ''), 40), name),
    breed = case when p_patch ? 'breed' then nullif(trim(p_patch->>'breed'), '') else breed end,
    photo_url = case when p_patch ? 'photo_url' then nullif(p_patch->>'photo_url', '') else photo_url end,
    medical_public = case when p_patch ? 'medical_public' then p_patch->>'medical_public' else medical_public end,
    behavior_public = case when p_patch ? 'behavior_public' then p_patch->>'behavior_public' else behavior_public end,
    contact_public = case when p_patch ? 'contact_public' then p_patch->'contact_public' else contact_public end,
    lost_mode = case when p_patch ? 'lost_mode' then (p_patch->>'lost_mode')::boolean else lost_mode end,
    public_fields = case when p_patch ? 'public_fields' then array(select jsonb_array_elements_text(p_patch->'public_fields')) else public_fields end,
    profile = case when p_patch ? 'profile' then p_patch->'profile' else profile end,
    updated_at = now()
  where id = p_pet;
end;
$$;

-- App analytics for the admin dashboard.
create or replace function public.admin_stats()
returns jsonb
language plpgsql stable security definer set search_path = public, auth as $$
declare v jsonb;
begin
  if not public.is_app_admin() then raise exception 'Admins only.' using errcode = '42501'; end if;
  select jsonb_build_object(
    'accounts', (select count(*) from public.profiles),
    'verified', (select count(*) from auth.users where email_confirmed_at is not null),
    'tiers', coalesce((select jsonb_object_agg(t, n) from (select tier::text t, count(*) n from public.profiles group by 1) x), '{}'::jsonb),
    'pets', (select count(*) from public.pets where owner_id is not null),
    'guest_pets', (select count(*) from public.pets where owner_id is null),
    'lost_now', (select count(*) from public.pets where lost_mode),
    'tags_claimed', (select count(*) from public.tags where pet_id is not null),
    'tags_unclaimed', (select count(*) from public.tags where pet_id is null),
    'scans_30d', (select count(*) from public.scan_events where created_at > now() - interval '30 days'),
    'found_reports_30d', (select count(*) from public.scan_events where reported_lost and created_at > now() - interval '30 days'),
    'saved_walks', (select count(*) from public.saved_walks),
    'walk_miles', (select coalesce(sum(distance_mi), 0) from public.saved_walks where kind = 'recorded'),
    'pins', (select count(*) from public.map_pins),
    'messages_30d', (select count(*) from public.pack_messages where created_at > now() - interval '30 days'),
    'meetups_upcoming', (select count(*) from public.meetups where status = 'active' and starts_at > now()),
    'pack_links', (select count(*) from public.profile_links where status = 'accepted'),
    'signups_by_day', coalesce((select jsonb_agg(jsonb_build_object('day', d, 'n', n) order by d) from (select date_trunc('day', created_at)::date d, count(*) n from public.profiles where created_at > now() - interval '30 days' group by 1) x), '[]'::jsonb),
    'scans_by_day', coalesce((select jsonb_agg(jsonb_build_object('day', d, 'n', n) order by d) from (select date_trunc('day', created_at)::date d, count(*) n from public.scan_events where created_at > now() - interval '30 days' group by 1) x), '[]'::jsonb),
    'top_breeds', coalesce((select jsonb_agg(jsonb_build_object('breed', b, 'n', n) order by n desc) from (select coalesce(breed, 'Unknown') b, count(*) n from public.pets group by 1 order by 2 desc limit 10) x), '[]'::jsonb),
    'status_tags', coalesce((select jsonb_object_agg(t, n) from (select st.tag t, count(*) n from public.pets pt2 cross join lateral jsonb_array_elements_text(coalesce(pt2.profile->'status_tags', '[]'::jsonb)) as st(tag) group by st.tag) x), '{}'::jsonb),
    'card_states', coalesce((select jsonb_object_agg(s, n) from (select coalesce(nullif(profile->'card'->>'state', ''), 'none') s, count(*) n from public.pets group by 1) x), '{}'::jsonb)
  ) into v;
  return v;
end;
$$;

-- Everything needed to make a dog's ID card in one call (admin card desk).
create or replace function public.admin_card_queue()
returns table (pet_id uuid, pet_name text, breed text, photo_url text, pet_profile jsonb, owner_id uuid, owner_name text, owner_email text, owner_phone text, owner_details jsonb, tag_code text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_app_admin() then raise exception 'Admins only.' using errcode = '42501'; end if;
  return query
  select pt.id, pt.name, pt.breed, pt.photo_url, pt.profile, p.id, p.display_name, p.email, p.phone, p.details,
         (select t.tag_code from public.tags t where t.pet_id = pt.id order by t.claimed_at desc nulls last limit 1), pt.created_at
  from public.pets pt left join public.profiles p on p.id = pt.owner_id
  order by pt.created_at desc
  limit 300;
end;
$$;

-- Public scan page: always include the status tags.
create or replace function public.get_public_pet(p_tag_code text default null, p_pet_id uuid default null)
returns table (
  id uuid, name text, species text, breed text, photo_url text, cover_url text,
  medical_public text, behavior_public text, contact_public jsonb, lost_mode boolean,
  tag_id uuid, tag_code text, is_owner boolean, public_extra jsonb,
  last_seen_at timestamptz, last_seen_lat double precision, last_seen_lng double precision
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_pet public.pets%rowtype;
  v_tag public.tags%rowtype;
  v_fields text[];
  v_seen_at timestamptz;
  v_seen_lat double precision;
  v_seen_lng double precision;
  v_extra jsonb;
begin
  if p_tag_code is not null and length(trim(p_tag_code)) between 1 and 64 then
    select t.* into v_tag from public.tags t where t.tag_code = trim(p_tag_code) and coalesce(t.status, '') <> 'disabled' limit 1;
    if v_tag.id is null or v_tag.pet_id is null then return; end if;
    select p.* into v_pet from public.pets p where p.id = v_tag.pet_id;
  elsif p_pet_id is not null then
    select p.* into v_pet from public.pets p where p.id = p_pet_id;
    select t.* into v_tag from public.tags t where t.pet_id = v_pet.id and coalesce(t.status, '') <> 'disabled' order by t.claimed_at desc nulls last limit 1;
  end if;
  if v_pet.id is null then return; end if;

  v_fields := coalesce(v_pet.public_fields, array['name','photo','contact','medical_public','behavior_public','lost_mode','last_scan']);
  -- Status tags (service, medical alert, rescue...) are always shown: finders need them.
  v_extra := jsonb_build_object('status_tags', coalesce(v_pet.profile->'status_tags', '[]'::jsonb), 'species', coalesce(v_pet.profile->'card'->>'species', 'Canine'));
  -- Optional sections the owner can switch on: details (size, sex, coat...), vet, care.
  if 'details' = any(v_fields) then v_extra := v_extra || jsonb_build_object('details', coalesce(v_pet.profile->'details', '{}'::jsonb)); end if;
  if 'vet' = any(v_fields) then v_extra := v_extra || jsonb_build_object('vet', coalesce(v_pet.profile->'vet', '{}'::jsonb)); end if;
  if 'care' = any(v_fields) then v_extra := v_extra || jsonb_build_object('care', coalesce(v_pet.profile->'care', '{}'::jsonb)); end if;

  if v_pet.lost_mode and 'last_scan' = any(v_fields) then
    select s.created_at, s.latitude, s.longitude into v_seen_at, v_seen_lat, v_seen_lng from public.scan_events s
     where s.pet_id = v_pet.id and s.latitude is not null order by s.created_at desc limit 1;
  end if;

  id := v_pet.id; name := v_pet.name; species := v_pet.species; breed := v_pet.breed;
  photo_url := case when 'photo' = any(v_fields) then v_pet.photo_url end;
  cover_url := case when 'photo' = any(v_fields) then v_pet.cover_url end;
  medical_public := case when 'medical_public' = any(v_fields) then v_pet.medical_public end;
  behavior_public := case when 'behavior_public' = any(v_fields) then v_pet.behavior_public end;
  contact_public := case when 'contact' = any(v_fields) then coalesce(v_pet.contact_public, '{}'::jsonb) else '{}'::jsonb end;
  lost_mode := case when 'lost_mode' = any(v_fields) then v_pet.lost_mode else false end;
  tag_id := v_tag.id; tag_code := v_tag.tag_code;
  is_owner := auth.uid() is not null and auth.uid() = v_pet.owner_id;
  public_extra := v_extra;
  -- Rounded to ~100 m and only while the dog is marked lost.
  last_seen_at := v_seen_at;
  last_seen_lat := round(v_seen_lat::numeric, 3)::double precision;
  last_seen_lng := round(v_seen_lng::numeric, 3)::double precision;
  return next;
end;
$$;
grant execute on function public.get_public_pet(text, uuid) to anon, authenticated, service_role;

revoke all on function public.admin_search_accounts(text), public.admin_account_sheet(uuid), public.admin_update_profile(uuid, jsonb), public.admin_update_pet(uuid, jsonb), public.admin_stats(), public.admin_card_queue() from public, anon;
grant execute on function public.admin_search_accounts(text), public.admin_account_sheet(uuid), public.admin_update_profile(uuid, jsonb), public.admin_update_pet(uuid, jsonb), public.admin_stats(), public.admin_card_queue() to authenticated;
revoke execute on function public.mypetid_notify_scan(), public.mypetid_notify_message(), public.mypetid_fanout_announcement(), public.mypetid_guard_notification_update() from public, anon, authenticated;

commit;
