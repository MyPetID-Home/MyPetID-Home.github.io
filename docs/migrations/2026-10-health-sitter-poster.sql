-- Health records, weight log and sitter share links.
--   pet_health_records : vet visits, vaccines, medications with due dates + daily reminders
--   pet_weights        : weight log for the health charts
--   sitter_links       : expiring share links for sitters/walkers (only a sha256 of the token is stored)
--   mypetid_health_reminders() : one notification per record when due_on - remind_days is reached
--   get_sitter_view(p_token)   : public (anon) read of a sitter link, only the included sections
-- The lost-dog poster needs no new SQL (it reads pets + scan_events as the owner).
-- Safe to run more than once. ASCII only.

-- ---------------------------------------------------------------------------
-- pet_health_records
-- ---------------------------------------------------------------------------
create table if not exists public.pet_health_records (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('visit', 'vaccine', 'medication', 'other')),
  title text not null check (char_length(title) between 1 and 120),
  given_on date,
  due_on date,
  clinic text check (clinic is null or char_length(clinic) <= 160),
  notes text check (notes is null or char_length(notes) <= 4000),
  attachment_url text check (attachment_url is null or (char_length(attachment_url) <= 1000 and attachment_url ~* '^https?://')),
  remind_days integer not null default 14 check (remind_days between 0 and 365),
  reminded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.pet_health_records add column if not exists reminded_at timestamptz;

create index if not exists pet_health_records_pet on public.pet_health_records(pet_id, due_on);
create index if not exists pet_health_records_owner on public.pet_health_records(owner_id);
create index if not exists pet_health_records_due on public.pet_health_records(due_on) where due_on is not null and reminded_at is null;

-- Keeps updated_at fresh and re-arms the reminder when the due date or lead time changes.
create or replace function public.mypetid_health_record_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' and (new.due_on is distinct from old.due_on or new.remind_days is distinct from old.remind_days) then
    new.reminded_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists pet_health_records_touch on public.pet_health_records;
create trigger pet_health_records_touch before insert or update on public.pet_health_records
  for each row execute function public.mypetid_health_record_touch();

alter table public.pet_health_records enable row level security;

drop policy if exists "health records own" on public.pet_health_records;
create policy "health records own" on public.pet_health_records for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and exists (select 1 from public.pets p where p.id = pet_id and p.owner_id = auth.uid()));

drop policy if exists "health records admin read" on public.pet_health_records;
create policy "health records admin read" on public.pet_health_records for select to authenticated using (public.is_app_admin());

revoke all on public.pet_health_records from anon;
grant select, insert, update, delete on public.pet_health_records to authenticated;

-- ---------------------------------------------------------------------------
-- pet_weights
-- ---------------------------------------------------------------------------
create table if not exists public.pet_weights (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  weighed_on date not null default current_date,
  weight_lb numeric(6, 2) not null check (weight_lb > 0 and weight_lb < 400),
  note text check (note is null or char_length(note) <= 300),
  created_at timestamptz not null default now()
);

create index if not exists pet_weights_pet_day on public.pet_weights(pet_id, weighed_on);
create index if not exists pet_weights_owner on public.pet_weights(owner_id);

alter table public.pet_weights enable row level security;

drop policy if exists "pet weights own" on public.pet_weights;
create policy "pet weights own" on public.pet_weights for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and exists (select 1 from public.pets p where p.id = pet_id and p.owner_id = auth.uid()));

drop policy if exists "pet weights admin read" on public.pet_weights;
create policy "pet weights admin read" on public.pet_weights for select to authenticated using (public.is_app_admin());

revoke all on public.pet_weights from anon;
grant select, insert, update, delete on public.pet_weights to authenticated;

-- ---------------------------------------------------------------------------
-- sitter_links
-- ---------------------------------------------------------------------------
create table if not exists public.sitter_links (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  label text check (label is null or char_length(label) <= 80),
  expires_at timestamptz not null,
  include jsonb not null default '{}'::jsonb check (jsonb_typeof(include) = 'object'),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  last_opened_at timestamptz,
  constraint sitter_links_max_length check (expires_at <= created_at + interval '92 days')
);

create index if not exists sitter_links_pet on public.sitter_links(pet_id, created_at desc);
create index if not exists sitter_links_owner on public.sitter_links(owner_id);

alter table public.sitter_links enable row level security;

drop policy if exists "sitter links own" on public.sitter_links;
create policy "sitter links own" on public.sitter_links for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and exists (select 1 from public.pets p where p.id = pet_id and p.owner_id = auth.uid()));

drop policy if exists "sitter links admin read" on public.sitter_links;
create policy "sitter links admin read" on public.sitter_links for select to authenticated using (public.is_app_admin());

revoke all on public.sitter_links from anon;
grant select, insert, update, delete on public.sitter_links to authenticated;

-- ---------------------------------------------------------------------------
-- Daily health reminders -> notifications
-- ---------------------------------------------------------------------------
create or replace function public.mypetid_health_reminders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  with due as (
    select r.id, r.owner_id, r.kind, r.title, r.due_on, p.name as pet_name
      from public.pet_health_records r
      join public.pets p on p.id = r.pet_id
     where r.due_on is not null
       and r.reminded_at is null
       and current_date >= r.due_on - r.remind_days
       -- Do not dig up long-forgotten records (e.g. a just-imported old history).
       and r.due_on >= current_date - 60
     for update of r skip locked
  ), sent as (
    insert into public.notifications (profile_id, kind, title, body, link)
    select d.owner_id,
           'health',
           left(case when d.due_on < current_date then d.pet_name || ': ' || d.title || ' is overdue'
                     when d.due_on = current_date then d.pet_name || ': ' || d.title || ' is due today'
                     else d.pet_name || ': ' || d.title || ' is due soon' end, 200),
           'Due ' || to_char(d.due_on, 'Mon DD, YYYY') || case d.kind when 'vaccine' then '. Book the shot with your vet.' when 'medication' then '. Time to refill or give the next dose.' else '.' end,
           '/dashboard/medical/'
      from due d
    returning 1
  ), marked as (
    update public.pet_health_records r set reminded_at = now()
      from due d
     where r.id = d.id
    returning 1
  )
  select count(*) into v_count from marked;
  return v_count;
end;
$$;

-- Run it every day at 13:15 UTC (morning in the US) when pg_cron is available; skip cleanly otherwise.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(j.jobid) from cron.job j where j.jobname = 'mypetid-health-reminders';
    perform cron.schedule('mypetid-health-reminders', '15 13 * * *', 'select public.mypetid_health_reminders()');
    raise notice 'Scheduled mypetid-health-reminders with pg_cron.';
  else
    raise notice 'pg_cron is not installed: health reminders are not scheduled. Enable pg_cron and run this file again.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Public sitter view
-- ---------------------------------------------------------------------------
create or replace function public.get_sitter_view(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_link public.sitter_links%rowtype;
  v_pet public.pets%rowtype;
  v_inc jsonb;
  v_profile jsonb;
  v_out jsonb;
begin
  if p_token is null or length(p_token) < 32 or length(p_token) > 128 or p_token !~ '^[A-Za-z0-9_-]+$' then
    return jsonb_build_object('status', 'invalid');
  end if;

  select l.* into v_link from public.sitter_links l
   where l.token_hash = encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex');
  if v_link.id is null then return jsonb_build_object('status', 'invalid'); end if;
  if v_link.revoked_at is not null then return jsonb_build_object('status', 'revoked'); end if;
  if v_link.expires_at <= now() then return jsonb_build_object('status', 'expired', 'expires_at', v_link.expires_at); end if;

  select p.* into v_pet from public.pets p where p.id = v_link.pet_id;
  if v_pet.id is null then return jsonb_build_object('status', 'invalid'); end if;

  update public.sitter_links set last_opened_at = now() where id = v_link.id;

  v_inc := coalesce(v_link.include, '{}'::jsonb);
  v_profile := coalesce(v_pet.profile, '{}'::jsonb);
  v_out := jsonb_build_object(
    'status', 'ok',
    'label', v_link.label,
    'expires_at', v_link.expires_at,
    'pet', jsonb_build_object(
      'name', v_pet.name,
      'breed', v_pet.breed,
      'photo_url', v_pet.photo_url,
      'status_tags', coalesce(v_profile->'status_tags', '[]'::jsonb),
      'sex', v_profile->'details'->>'sex',
      'weight_lb', v_profile->'details'->>'weight_lb'),
    'timezone', coalesce(v_profile->>'timezone', 'America/New_York'));

  if coalesce((v_inc->>'care_schedule')::boolean, false) then
    v_out := v_out || jsonb_build_object('care_schedule', coalesce(v_profile->'care_schedule', '[]'::jsonb));
  end if;

  if coalesce((v_inc->>'feeding')::boolean, false) then
    v_out := v_out || jsonb_build_object('feeding', jsonb_build_object(
      'plan', v_pet.feeding_plan,
      'notes', v_profile->'sitter'->>'feeding_notes'));
  end if;

  if coalesce((v_inc->>'meds')::boolean, false) then
    v_out := v_out || jsonb_build_object('meds', jsonb_build_object(
      'medical_notes', v_pet.medical_public,
      -- Current medications from the medicine history (not stopped, or stopping in the future).
      'current', coalesce((
        select jsonb_agg(jsonb_build_object('name', m->>'name', 'dose', m->>'dose', 'reason', m->>'reason'))
          from jsonb_array_elements(case when jsonb_typeof(v_profile->'medications') = 'array' then v_profile->'medications' else '[]'::jsonb end) m
         where coalesce(m->>'stopped', '') = '' or (m->>'stopped') >= to_char(current_date, 'YYYY-MM-DD')
      ), '[]'::jsonb),
      'records', coalesce((
        select jsonb_agg(jsonb_build_object('title', r.title, 'given_on', r.given_on, 'due_on', r.due_on, 'notes', r.notes) order by r.due_on nulls last)
          from public.pet_health_records r
         where r.pet_id = v_pet.id and r.kind = 'medication' and (r.due_on is null or r.due_on >= current_date - 7)
      ), '[]'::jsonb)));
  end if;

  if coalesce((v_inc->>'vet')::boolean, false) then
    v_out := v_out || jsonb_build_object('vet', jsonb_build_object(
      'clinic', v_profile->'vet'->>'clinic',
      'phone', v_profile->'vet'->>'phone',
      'address', v_profile->'vet'->>'address',
      'owner_phone', v_pet.contact_public->>'phone',
      'owner_email', v_pet.contact_public->>'email',
      'emergency_name', v_profile->'sitter'->>'emergency_name',
      'emergency_phone', v_profile->'sitter'->>'emergency_phone'));
  end if;

  if coalesce((v_inc->>'behavior')::boolean, false) then
    v_out := v_out || jsonb_build_object('behavior', jsonb_build_object(
      'public', v_pet.behavior_public,
      'care_notes', v_pet.care_notes,
      'sitter_notes', v_profile->'sitter'->>'behavior_notes'));
  end if;

  if coalesce((v_inc->>'walk')::boolean, false) then
    v_out := v_out || jsonb_build_object('walk', jsonb_build_object(
      'notes', v_profile->'sitter'->>'walk_notes'));
  end if;

  return v_out;
end;
$$;

-- ---------------------------------------------------------------------------
-- Function permissions (Supabase grants EXECUTE to anon by default: revoke explicitly)
-- ---------------------------------------------------------------------------
revoke all on function public.mypetid_health_record_touch() from public, anon, authenticated;
revoke all on function public.mypetid_health_reminders() from public, anon, authenticated;
revoke all on function public.get_sitter_view(text) from public;
grant execute on function public.get_sitter_view(text) to anon, authenticated;

select
  (select count(*) from public.pet_health_records) as health_records,
  (select count(*) from public.pet_weights) as weights,
  (select count(*) from public.sitter_links) as sitter_links,
  exists (select 1 from pg_extension where extname = 'pg_cron') as pg_cron_installed;
