-- MyPetID pet profiles v2 (October 2026): guest dog profiles with a name + 6-digit PIN,
-- extended profile details, richer public scan page, personal Dog Pack codes,
-- "walking now" sharing, and a starter set of admin-managed achievements.
-- Target project: ryyaefxszkmibcnngnfg. Idempotent. Run after 2026-10-dog-pack-social.sql.

begin;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Pets: guest-owned pets have no owner account; extended details live in `profile`
-- ---------------------------------------------------------------------------
alter table public.pets alter column owner_id drop not null;
alter table public.pets add column if not exists profile jsonb not null default '{}'::jsonb;
alter table public.pets add column if not exists cover_url text;

-- ---------------------------------------------------------------------------
-- Guest access: log in to one dog's profile with its name + a 6-digit PIN
-- ---------------------------------------------------------------------------
create table if not exists public.pet_guest_access (
  pet_id uuid primary key references public.pets(id) on delete cascade,
  name_key text not null,
  pin_hash text not null,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists pet_guest_access_name_idx on public.pet_guest_access (name_key);
alter table public.pet_guest_access enable row level security; -- no policies: only the functions below touch it

create table if not exists public.pet_guest_sessions (
  token_hash text primary key,
  pet_id uuid not null references public.pets(id) on delete cascade,
  expires_at timestamptz not null default now() + interval '90 days',
  created_at timestamptz not null default now()
);
alter table public.pet_guest_sessions enable row level security; -- no policies

create or replace function public.mypetid_guest_name_key(p_name text)
returns text language sql immutable as $$ select lower(regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g')); $$;

create or replace function public.mypetid_guest_new_session(p_pet uuid)
returns text
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare v_token text := encode(gen_random_bytes(24), 'hex');
begin
  insert into public.pet_guest_sessions (token_hash, pet_id) values (encode(digest(v_token, 'sha256'), 'hex'), p_pet);
  delete from public.pet_guest_sessions where expires_at < now();
  return v_token;
end;
$$;
revoke all on function public.mypetid_guest_new_session(uuid) from public, anon, authenticated;

create or replace function public.mypetid_guest_pet_for(p_token text)
returns uuid
language sql
stable
security definer
set search_path = public, extensions
as $$
  select s.pet_id from public.pet_guest_sessions s
  where s.token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex') and s.expires_at > now();
$$;
revoke all on function public.mypetid_guest_pet_for(text) from public, anon, authenticated;

-- Create a dog profile without an account. Returns a guest token (keep it in the app).
create or replace function public.guest_create_pet(p_name text, p_pin text, p_breed text default null, p_photo_url text default null)
returns table (pet_id uuid, token text)
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_key text := public.mypetid_guest_name_key(p_name);
  v_pet uuid;
begin
  if length(v_key) not between 1 and 40 then raise exception 'Give your dog a name (up to 40 characters).' using errcode = '22023'; end if;
  if p_pin !~ '^[0-9]{6}$' then raise exception 'The PIN must be exactly 6 digits.' using errcode = '22023'; end if;
  if p_pin ~ '^(\d)\1{5}$' or p_pin in ('123456', '654321', '012345', '543210') then raise exception 'Pick a less guessable PIN.' using errcode = '22023'; end if;
  if exists (select 1 from public.pet_guest_access g where g.name_key = v_key and g.pin_hash = crypt(p_pin, g.pin_hash)) then
    raise exception 'That name and PIN combination is taken. Please choose a different PIN.' using errcode = '23505';
  end if;
  insert into public.pets (owner_id, name, species, breed, photo_url, public_fields)
  values (null, left(trim(p_name), 40), 'dog', nullif(trim(coalesce(p_breed, '')), ''), nullif(trim(coalesce(p_photo_url, '')), ''), array['name','photo','contact','medical_public','behavior_public','lost_mode','last_scan'])
  returning id into v_pet;
  insert into public.pet_guest_access (pet_id, name_key, pin_hash) values (v_pet, v_key, crypt(p_pin, gen_salt('bf', 8)));
  return query select v_pet, public.mypetid_guest_new_session(v_pet);
end;
$$;
revoke all on function public.guest_create_pet(text, text, text, text) from public;
grant execute on function public.guest_create_pet(text, text, text, text) to anon, authenticated;

-- Log in with the dog's name and PIN. Five wrong PINs locks that name for 15 minutes.
create or replace function public.guest_login(p_name text, p_pin text)
returns table (pet_id uuid, token text)
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_key text := public.mypetid_guest_name_key(p_name);
  v_match uuid;
begin
  if exists (select 1 from public.pet_guest_access g where g.name_key = v_key and g.locked_until > now()) then
    raise exception 'Too many tries. Please wait 15 minutes and try again.' using errcode = 'P0001';
  end if;
  select g.pet_id into v_match from public.pet_guest_access g
   where g.name_key = v_key and p_pin ~ '^[0-9]{6}$' and g.pin_hash = crypt(p_pin, g.pin_hash) limit 1;
  if v_match is null then
    update public.pet_guest_access set failed_attempts = failed_attempts + 1,
      locked_until = case when failed_attempts + 1 >= 5 then now() + interval '15 minutes' else locked_until end
     where name_key = v_key;
    raise exception 'That name and PIN don’t match.' using errcode = '28000';
  end if;
  update public.pet_guest_access set failed_attempts = 0, locked_until = null where name_key = v_key;
  return query select v_match, public.mypetid_guest_new_session(v_match);
end;
$$;
revoke all on function public.guest_login(text, text) from public;
grant execute on function public.guest_login(text, text) to anon, authenticated;

-- Read the guest's own pet (everything, including private details).
create or replace function public.guest_pet(p_token text)
returns setof public.pets
language sql
stable
security definer
set search_path = public
as $$ select p.* from public.pets p where p.id = public.mypetid_guest_pet_for(p_token) and p.owner_id is null; $$;
revoke all on function public.guest_pet(text) from public;
grant execute on function public.guest_pet(text) to anon, authenticated;

-- Update the guest's pet. Only profile fields; guests can't attach tags or change ownership.
create or replace function public.guest_update_pet(p_token text, p_patch jsonb)
returns setof public.pets
language plpgsql
volatile
security definer
set search_path = public
as $$
declare v_pet uuid := public.mypetid_guest_pet_for(p_token);
begin
  if v_pet is null then raise exception 'Please log in to your dog’s profile again.' using errcode = '28000'; end if;
  update public.pets set
    name = coalesce(left(nullif(trim(p_patch->>'name'), ''), 40), name),
    breed = case when p_patch ? 'breed' then nullif(trim(p_patch->>'breed'), '') else breed end,
    photo_url = case when p_patch ? 'photo_url' then nullif(p_patch->>'photo_url', '') else photo_url end,
    cover_url = case when p_patch ? 'cover_url' then nullif(p_patch->>'cover_url', '') else cover_url end,
    medical_public = case when p_patch ? 'medical_public' then left(p_patch->>'medical_public', 1000) else medical_public end,
    behavior_public = case when p_patch ? 'behavior_public' then left(p_patch->>'behavior_public', 1000) else behavior_public end,
    contact_public = case when p_patch ? 'contact_public' then p_patch->'contact_public' else contact_public end,
    lost_mode = case when p_patch ? 'lost_mode' then (p_patch->>'lost_mode')::boolean else lost_mode end,
    profile = case when p_patch ? 'profile' then p_patch->'profile' else profile end,
    updated_at = now()
  where id = v_pet and owner_id is null;
  if p_patch ? 'name' then update public.pet_guest_access set name_key = public.mypetid_guest_name_key(p_patch->>'name') where pet_id = v_pet; end if;
  return query select * from public.pets where id = v_pet;
end;
$$;
revoke all on function public.guest_update_pet(text, jsonb) from public;
grant execute on function public.guest_update_pet(text, jsonb) to anon, authenticated;

-- A signed-in user moves a guest dog into their account (name + PIN proves it's theirs).
create or replace function public.claim_guest_pet(p_name text, p_pin text)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare v_pet uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  select pet_id into v_pet from public.guest_login(p_name, p_pin);
  update public.pets set owner_id = auth.uid(), updated_at = now() where id = v_pet and owner_id is null;
  delete from public.pet_guest_access where pet_id = v_pet;
  delete from public.pet_guest_sessions where pet_id = v_pet;
  return v_pet;
end;
$$;
revoke all on function public.claim_guest_pet(text, text) from public;
grant execute on function public.claim_guest_pet(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Public scan page: owner-approved extras and, while lost, the last shared location
-- ---------------------------------------------------------------------------
drop function if exists public.get_public_pet(text, uuid);
create function public.get_public_pet(p_tag_code text default null, p_pet_id uuid default null)
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
  v_extra jsonb := '{}'::jsonb;
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
revoke all on function public.get_public_pet(text, uuid) from public;
grant execute on function public.get_public_pet(text, uuid) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Personal Dog Pack code (the QR made at sign-up) + "walking now"
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists pack_code text;
update public.profiles set pack_code = encode(gen_random_bytes(5), 'hex') where pack_code is null;
alter table public.profiles alter column pack_code set default encode(gen_random_bytes(5), 'hex');
create unique index if not exists profiles_pack_code_key on public.profiles (pack_code);

create or replace function public.my_pack_code()
returns text language sql stable security definer set search_path = public as $$ select pack_code from public.profiles where id = auth.uid(); $$;
revoke all on function public.my_pack_code() from public;
grant execute on function public.my_pack_code() to authenticated;

create or replace function public.join_pack_by_code(p_code text)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare v_owner uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to join a Dog Pack.' using errcode = '42501'; end if;
  select id into v_owner from public.profiles where pack_code = lower(trim(p_code));
  if v_owner is null then raise exception 'That Dog Pack code wasn’t found.' using errcode = 'P0002'; end if;
  if v_owner = auth.uid() then raise exception 'That’s your own Dog Pack code.' using errcode = '22023'; end if;
  if not public.are_pack_friends(v_owner, auth.uid()) then
    insert into public.profile_links (requester_id, receiver_id, status, accepted_at)
    values (v_owner, auth.uid(), 'accepted', now())
    on conflict (requester_id, receiver_id) do update set status = 'accepted', accepted_at = now();
  end if;
  return public.mypetid_public_name(v_owner);
end;
$$;
revoke all on function public.join_pack_by_code(text) from public;
grant execute on function public.join_pack_by_code(text) to authenticated;

alter table public.owner_presence add column if not exists walking boolean not null default false;
alter table public.owner_presence add column if not exists audience text not null default 'pack';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'owner_presence_audience_check') then
    alter table public.owner_presence add constraint owner_presence_audience_check check (audience in ('pack', 'area'));
  end if;
end $$;

-- Nearby owners: "area" sharers are visible to verified owners nearby; "pack" sharers only to friends.
drop function if exists public.nearby_owners(double precision, double precision, double precision);
create function public.nearby_owners(p_lat double precision, p_lng double precision, p_km double precision default 10)
returns table (name text, dog_name text, approx_km double precision, minutes_ago integer, is_friend boolean, walking boolean)
language sql
stable
security definer
set search_path = public
as $$
  select public.mypetid_public_name(o.profile_id), o.dog_name,
         greatest(1, round((111.32 * sqrt(power(o.lat_round - p_lat, 2) + power((o.lng_round - p_lng) * cos(radians(p_lat)), 2)))::numeric))::double precision,
         (extract(epoch from now() - o.updated_at) / 60)::int,
         public.are_pack_friends(o.profile_id, auth.uid()),
         o.walking
  from public.owner_presence o
  where public.mypetid_is_verified()
    and o.profile_id <> auth.uid()
    and o.updated_at > now() - interval '3 hours'
    and (o.audience = 'area' or public.are_pack_friends(o.profile_id, auth.uid()))
    and abs(o.lat_round - p_lat) < least(p_km, 50) / 111.0
    and abs(o.lng_round - p_lng) < least(p_km, 50) / (111.0 * greatest(cos(radians(p_lat)), 0.2))
  order by 3
  limit 40;
$$;
revoke all on function public.nearby_owners(double precision, double precision, double precision) from public;
grant execute on function public.nearby_owners(double precision, double precision, double precision) to authenticated;

-- Friends who are out walking right now, wherever they are (pack members see each other).
create or replace function public.pack_walking_now()
returns table (name text, dog_name text, minutes_ago integer)
language sql
stable
security definer
set search_path = public
as $$
  select public.mypetid_public_name(o.profile_id), o.dog_name, (extract(epoch from now() - o.updated_at) / 60)::int
  from public.owner_presence o
  where o.walking and o.updated_at > now() - interval '3 hours' and public.are_pack_friends(o.profile_id, auth.uid())
  order by o.updated_at desc;
$$;
revoke all on function public.pack_walking_now() from public;
grant execute on function public.pack_walking_now() to authenticated;

-- ---------------------------------------------------------------------------
-- Starter achievements (admins edit these in the Admin studio; users can't)
-- ---------------------------------------------------------------------------
insert into public.award_rules (title, category, trigger_key, requirement, target, points, icon, active, admin_locked)
select v.title, v.category, v.trigger_key, v.requirement, v.target, v.points, v.icon, true, true
from (values
  ('Hello, world', 'Profile', 'profile_completion', 'Create your dog''s profile.', 10, 10, '🐾'),
  ('Picture perfect', 'Profile', 'profile_photo', 'Add a profile photo for your dog.', 1, 15, '📸'),
  ('Profile pro', 'Profile', 'profile_completion', 'Fill in 90% of your dog''s profile.', 90, 60, '⭐'),
  ('Tagged & protected', 'Safety', 'tag_claimed', 'Activate a MyPetID NFC card.', 1, 100, '🪪'),
  ('Safety net', 'Safety', 'contact_public', 'Add a way for finders to reach you.', 1, 25, '📞'),
  ('Home safe', 'Safety', 'lost_resolved', 'Resolve a lost/found report with a note.', 1, 100, '🏡'),
  ('Good Samaritan', 'Safety', 'scan_shared', 'Help another dog get home by sharing a finder scan.', 1, 150, '🦸'),
  ('First steps', 'Walks', 'walks_completed', 'Finish your first tracked walk.', 1, 25, '👣'),
  ('Week of walks', 'Walks', 'walk_streak_days', 'Walk 7 days in a row.', 7, 75, '📅'),
  ('Month of walks', 'Walks', 'walk_streak_days', 'Walk 30 days in a row.', 30, 250, '🗓️'),
  ('5 mile club', 'Walks', 'miles_walked', 'Walk 5 miles in total.', 5, 50, '🥾'),
  ('Marathon mutt', 'Walks', 'miles_walked', 'Walk 26.2 miles in total.', 26.2, 200, '🏅'),
  ('Century trail', 'Walks', 'miles_walked', 'Walk 100 miles in total.', 100, 500, '🏔️'),
  ('Early bird', 'Walks', 'walks_before_8am', 'Finish 10 walks before 8 AM.', 10, 60, '🌅'),
  ('Night owl', 'Walks', 'walks_after_8pm', 'Finish 10 walks after 8 PM.', 10, 60, '🌙'),
  ('Explorer', 'Walks', 'new_places', 'Walk in 5 different places.', 5, 80, '🧭'),
  ('Park hopper', 'Walks', 'dog_parks_visited', 'Visit 3 different dog parks.', 3, 80, '🌳'),
  ('Right on schedule', 'Diet', 'meals_completed', 'Log every meal for a day.', 2, 20, '🍽️'),
  ('Meal streak', 'Diet', 'meal_streak_days', 'Log every meal for 14 days in a row.', 14, 120, '🥣'),
  ('Hydration hero', 'Diet', 'water_logged', 'Log fresh water 7 days in a row.', 7, 40, '💧'),
  ('Sit happens', 'Training', 'tricks_mastered', 'Master your first command.', 1, 25, '🎓'),
  ('Trick learner', 'Training', 'tricks_mastered', 'Master 3 commands or tricks.', 3, 75, '🏆'),
  ('Top of the class', 'Training', 'tricks_mastered', 'Master 10 commands or tricks.', 10, 250, '🎖️'),
  ('Practice makes perfect', 'Training', 'training_sessions', 'Log 20 training sessions.', 20, 100, '🔁'),
  ('Playtime', 'Play', 'play_minutes', 'Log 60 minutes of play.', 60, 30, '🎾'),
  ('Fetch fanatic', 'Play', 'play_minutes', 'Log 10 hours of play.', 600, 150, '🥏'),
  ('Health file', 'Health', 'documents_uploaded', 'Upload your dog''s first health record.', 1, 30, '📄'),
  ('Vaccines up to date', 'Health', 'vaccines_current', 'Log current rabies and core vaccines.', 2, 80, '💉'),
  ('Vet visit', 'Health', 'vet_visits', 'Log a vet check-up.', 1, 40, '🩺'),
  ('Groomed & gorgeous', 'Care', 'grooming_logged', 'Log 5 grooming sessions.', 5, 50, '✂️'),
  ('Reminder ready', 'Care', 'reminders_set', 'Set up 3 care reminders.', 3, 30, '⏰'),
  ('Pack leader', 'Social', 'pack_friends', 'Add 3 friends to your Dog Pack.', 3, 60, '🐕‍🦺'),
  ('Social butterfly', 'Social', 'meetups_joined', 'Join 3 meetups.', 3, 90, '🦋'),
  ('Host with the most', 'Social', 'meetups_hosted', 'Host a meetup that 3 dogs join.', 3, 120, '🎪'),
  ('Birthday pup', 'Milestones', 'birthday', 'Celebrate your dog''s birthday in the app.', 1, 50, '🎂'),
  ('One year together', 'Milestones', 'days_member', 'Use MyPetID for a year.', 365, 200, '🎉')
) as v(title, category, trigger_key, requirement, target, points, icon)
where not exists (select 1 from public.award_rules r where r.title = v.title);

commit;
