-- MyPetID (October 2026): community map places, care-schedule info on the scan page,
-- birthdays, and repeat/perk options for achievements. ASCII only. Idempotent.

begin;

-- Places any verified owner can add for everyone (vets, dog parks, water, waste bins...).
create table if not exists public.community_places (
  id uuid primary key default gen_random_uuid(),
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  kind text not null check (kind in ('vet', 'dog_park', 'pet_shop', 'waste_bin', 'water', 'groomer', 'trail', 'emergency_vet', 'other')),
  name text not null check (length(trim(name)) between 2 and 80),
  note text check (note is null or length(note) <= 300),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  status text not null default 'visible' check (status in ('visible', 'hidden')),
  created_at timestamptz not null default now()
);
create index if not exists community_places_geo_idx on public.community_places (lat, lng);
alter table public.community_places enable row level security;
drop policy if exists "community places read" on public.community_places;
create policy "community places read" on public.community_places for select using (status = 'visible' or created_by = auth.uid() or public.is_app_admin());
drop policy if exists "community places add" on public.community_places;
create policy "community places add" on public.community_places for insert to authenticated with check (created_by = auth.uid() and public.mypetid_is_verified() and status = 'visible');
drop policy if exists "community places edit" on public.community_places;
create policy "community places edit" on public.community_places for update to authenticated using (created_by = auth.uid() or public.is_app_admin()) with check (created_by = auth.uid() or public.is_app_admin());
drop policy if exists "community places remove" on public.community_places;
create policy "community places remove" on public.community_places for delete to authenticated using (created_by = auth.uid() or public.is_app_admin());

create table if not exists public.community_place_reports (
  place_id uuid not null references public.community_places(id) on delete cascade,
  reporter_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  reason text check (reason is null or length(reason) <= 200),
  created_at timestamptz not null default now(),
  primary key (place_id, reporter_id)
);
alter table public.community_place_reports enable row level security;
drop policy if exists "place reports add" on public.community_place_reports;
create policy "place reports add" on public.community_place_reports for insert to authenticated with check (reporter_id = auth.uid() and public.mypetid_is_verified());
drop policy if exists "place reports admin read" on public.community_place_reports;
create policy "place reports admin read" on public.community_place_reports for select using (public.is_app_admin() or reporter_id = auth.uid());

create or replace function public.mypetid_autohide_place()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.community_place_reports r where r.place_id = new.place_id) >= 3 then
    update public.community_places set status = 'hidden' where id = new.place_id;
  end if;
  return new;
end;
$$;
drop trigger if exists mypetid_autohide_place on public.community_place_reports;
create trigger mypetid_autohide_place after insert on public.community_place_reports for each row execute function public.mypetid_autohide_place();
revoke execute on function public.mypetid_autohide_place() from public, anon, authenticated;

-- Achievements: how often they can be earned and what perk they give.
alter table public.award_rules add column if not exists period text not null default 'once';
alter table public.award_rules add column if not exists perk text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'award_rules_period_check') then
    alter table public.award_rules add constraint award_rules_period_check check (period in ('once', 'daily', 'weekly', 'monthly'));
  end if;
end $$;

-- Public scan page: public care times, timezone and birthday (month-day).
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
  v_extra := jsonb_build_object('status_tags', coalesce(v_pet.profile->'status_tags', '[]'::jsonb), 'species', coalesce(v_pet.profile->'card'->>'species', 'Canine'),
    -- Care times the owner marked public (e.g. medicine), so a finder knows how urgent it is.
    'care_schedule', coalesce((select jsonb_agg(item) from jsonb_array_elements(coalesce(v_pet.profile->'care_schedule', '[]'::jsonb)) item where (item->>'public')::boolean is true), '[]'::jsonb),
    'timezone', coalesce(v_pet.profile->>'timezone', 'America/New_York'),
    -- Month and day only, to celebrate birthdays without revealing age.
    'birthday_md', nullif(substr(coalesce(v_pet.profile->'details'->>'birthday', ''), 6, 5), ''));
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

commit;
