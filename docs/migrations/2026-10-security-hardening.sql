-- MyPetID security hardening (October 2026).
-- Target project: ryyaefxszkmibcnngnfg (MyPetID-Home).
-- Idempotent: safe to run more than once. Paste into the Supabase SQL editor and run.
-- See 2026-10-security-hardening.README.md for what it changes and how to verify.
--
-- Summary
--   1. profiles: signed-in users can no longer change is_admin / tier / patreon_* /
--      google_*_linked / email / email_verified_at / first_tag_coupon_code. New
--      self-created profiles always start as free, non-admin.
--   2. pets: no longer publicly readable. Public pages use get_public_pet(), which
--      returns only owner-approved public fields (never owner_id, care_notes, feeding_plan).
--   3. tags: no longer publicly readable (claim_code_hash stays private); users can no
--      longer claim a tag by direct UPDATE. Claims go through /api/tags/activate, which
--      now finishes with claim_tag() (atomic, claim-code checked, service role only).
--   4. scan_events: no longer publicly readable or directly insertable. Finders submit
--      through submit_finder_report() (validated + rate limited). Owners read their own
--      pets' reports; owners/admins do follow-up updates.
--   5. tag_orders: users can read their orders but no longer insert/update them
--      (orders are written by the Vercel server with the service role).
--   6. Cheaper medium fixes: pet_documents policies split per command, dog_pack_invites
--      and pet_awards no longer self-writable, storage update/delete scoped to MyPetID
--      buckets, SVG removed from the public tag-assets bucket, bearer tokens no longer
--      stored in account_activity_log.source (and existing rows redacted), one Patreon/
--      Google account can link to only one profile, membership_events accepts 'coupon'.

begin;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- True when the statement runs as a trusted role: the service role (Vercel server),
-- the SQL editor (postgres), or inside a SECURITY DEFINER function. False for the
-- browser roles anon/authenticated. Must stay SECURITY INVOKER.
create or replace function public.mypetid_is_trusted_caller()
returns boolean
language sql
stable
as $$
  select current_user not in ('anon', 'authenticated');
$$;

-- Admin check used by policies (re-declared so this file is self-contained).
create or replace function public.is_app_admin(check_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = check_id
      and (p.is_admin = true or p.tier::text = 'admin')
  );
$$;
grant execute on function public.is_app_admin(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1. profiles: protect privilege / billing / verification columns
-- ---------------------------------------------------------------------------

create or replace function public.mypetid_guard_profile_columns()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  protected_columns text[] := array[
    'is_admin', 'tier', 'patreon_linked', 'patreon_tier',
    'google_photos_linked', 'google_drive_linked', 'google_calendar_linked',
    'email', 'email_verified_at', 'first_tag_coupon_code'
  ];
  old_row jsonb;
  new_row jsonb;
  col text;
begin
  if public.mypetid_is_trusted_caller() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- A browser-created profile always starts unprivileged. Columns that do not
    -- exist on this table are ignored by jsonb_populate_record.
    new := jsonb_populate_record(new, jsonb_build_object(
      'is_admin', false,
      'tier', 'free',
      'patreon_linked', false,
      'patreon_tier', null,
      'google_photos_linked', false,
      'google_drive_linked', false,
      'google_calendar_linked', false,
      'email', auth.jwt() ->> 'email',
      'email_verified_at', null,
      'first_tag_coupon_code', null
    ));
    return new;
  end if;

  old_row := to_jsonb(old);
  new_row := to_jsonb(new);
  foreach col in array protected_columns loop
    if new_row ? col and (new_row -> col) is distinct from (old_row -> col) then
      raise exception 'The profile field "%" can only be changed by MyPetID staff.', col
        using errcode = '42501';
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists mypetid_guard_profile_columns on public.profiles;
create trigger mypetid_guard_profile_columns
  before insert or update on public.profiles
  for each row execute function public.mypetid_guard_profile_columns();

-- ---------------------------------------------------------------------------
-- 2. pets: owner/admin read only; public data via get_public_pet()
-- ---------------------------------------------------------------------------

drop policy if exists "pets public read" on public.pets;
drop policy if exists "pets owner or admin read" on public.pets;
create policy "pets owner or admin read" on public.pets for select
  using (owner_id = auth.uid() or public.is_app_admin());

-- Returns the owner-approved public view of one pet, looked up by tag code or pet id.
-- Fields are included only when listed in pets.public_fields (all are listed by default).
-- Never returns owner_id, care_notes, feeding_plan or other private columns.
drop function if exists public.get_public_pet(text, uuid);
create function public.get_public_pet(p_tag_code text default null, p_pet_id uuid default null)
returns table (
  id uuid,
  name text,
  species text,
  breed text,
  photo_url text,
  medical_public text,
  behavior_public text,
  contact_public jsonb,
  lost_mode boolean,
  tag_id uuid,
  tag_code text,
  is_owner boolean
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
begin
  if p_tag_code is not null and length(trim(p_tag_code)) between 1 and 64 then
    select t.* into v_tag from public.tags t
      where t.tag_code = trim(p_tag_code)
        and coalesce(t.status, '') <> 'disabled'
      limit 1;
    if v_tag.id is null or v_tag.pet_id is null then
      return;
    end if;
    select p.* into v_pet from public.pets p where p.id = v_tag.pet_id;
  elsif p_pet_id is not null then
    select p.* into v_pet from public.pets p where p.id = p_pet_id;
  end if;

  if v_pet.id is null then
    return;
  end if;

  v_fields := coalesce(v_pet.public_fields, array['name','photo','contact','medical_public','behavior_public','lost_mode','last_scan']);

  id := v_pet.id;
  name := v_pet.name;
  species := v_pet.species;
  breed := v_pet.breed;
  photo_url := case when 'photo' = any(v_fields) then v_pet.photo_url end;
  medical_public := case when 'medical_public' = any(v_fields) then v_pet.medical_public end;
  behavior_public := case when 'behavior_public' = any(v_fields) then v_pet.behavior_public end;
  contact_public := case when 'contact' = any(v_fields) then coalesce(v_pet.contact_public, '{}'::jsonb) else '{}'::jsonb end;
  lost_mode := case when 'lost_mode' = any(v_fields) then v_pet.lost_mode else false end;
  tag_id := v_tag.id;
  tag_code := v_tag.tag_code;
  is_owner := auth.uid() is not null and auth.uid() = v_pet.owner_id;
  return next;
end;
$$;

revoke all on function public.get_public_pet(text, uuid) from public;
grant execute on function public.get_public_pet(text, uuid) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. tags: private rows, admin-only direct writes, claim via claim_tag()
-- ---------------------------------------------------------------------------

drop policy if exists "tags public read" on public.tags;
drop policy if exists "tags owner or admin read" on public.tags;
create policy "tags owner or admin read" on public.tags for select
  using (
    created_by = auth.uid()
    or exists (select 1 from public.pets p where p.id = tags.pet_id and p.owner_id = auth.uid())
    or public.is_app_admin()
  );

drop policy if exists "tags owner claim or admin update" on public.tags;
drop policy if exists "tags admin update" on public.tags;
create policy "tags admin update" on public.tags for update to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

drop policy if exists "tags admin insert" on public.tags;
create policy "tags admin insert" on public.tags for insert to authenticated
  with check (public.is_app_admin());

drop policy if exists "tags admin delete" on public.tags;
create policy "tags admin delete" on public.tags for delete to authenticated
  using (public.is_app_admin());

-- Atomically claims an unclaimed tag for a pet owned by p_profile_id when the claim-code
-- hash matches. Returns the claimed row, or no row when the tag is missing, already
-- claimed, the code does not match, or the pet is not owned by p_profile_id.
-- Called only by the Vercel server (/api/tags/activate) after its membership checks.
drop function if exists public.claim_tag(text, text, uuid, uuid);
create function public.claim_tag(p_tag_code text, p_claim_code_hash text, p_pet_id uuid, p_profile_id uuid)
returns setof public.tags
language sql
volatile
security definer
set search_path = public
as $$
  update public.tags t
     set pet_id = p_pet_id,
         created_by = p_profile_id,
         claimed_at = now(),
         status = 'claimed'
   where t.tag_code = trim(p_tag_code)
     and t.pet_id is null
     and t.claimed_at is null
     and t.claim_code_hash is not null
     and t.claim_code_hash = p_claim_code_hash
     and exists (select 1 from public.pets p where p.id = p_pet_id and p.owner_id = p_profile_id)
  returning t.*;
$$;

revoke all on function public.claim_tag(text, text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_tag(text, text, uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 4. scan_events: private reads, finder inserts only via submit_finder_report()
-- ---------------------------------------------------------------------------

drop policy if exists "scan read linked" on public.scan_events;
drop policy if exists "scan insert public" on public.scan_events;
drop policy if exists "scan events owner read" on public.scan_events;
create policy "scan events owner read" on public.scan_events for select
  using (
    exists (select 1 from public.pets p where p.id = scan_events.pet_id and p.owner_id = auth.uid())
    or scanner_profile_id = auth.uid()
    or public.is_app_admin()
  );

-- Follow-up updates: pet owner or admin only (a scanner can no longer edit reports).
drop policy if exists "scan events owner followup update" on public.scan_events;
create policy "scan events owner followup update" on public.scan_events for update
  using (
    exists (select 1 from public.pets p where p.id = scan_events.pet_id and p.owner_id = auth.uid())
    or public.is_app_admin()
  )
  with check (
    exists (select 1 from public.pets p where p.id = scan_events.pet_id and p.owner_id = auth.uid())
    or public.is_app_admin()
  );

create index if not exists scan_events_tag_created_idx on public.scan_events(tag_id, created_at desc);

-- Finder/owner scan report for a tag. Validates input, limits volume per tag, and
-- derives pet_id/actor server-side so callers cannot attach reports to arbitrary pets.
drop function if exists public.submit_finder_report(text, double precision, double precision, double precision, boolean, text, text, text);
create function public.submit_finder_report(
  p_tag_code text,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_meters double precision default null,
  p_reported_lost boolean default false,
  p_note text default null,
  p_finder_note text default null,
  p_finder_contact text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_tag public.tags%rowtype;
  v_owner uuid;
  v_actor public.scan_actor := 'stranger';
  v_recent integer;
  v_id uuid;
begin
  if p_tag_code is null or length(trim(p_tag_code)) not between 1 and 64 then
    raise exception 'A valid tag code is required.' using errcode = '22023';
  end if;
  if p_latitude is null or p_longitude is null
     or p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception 'The shared location is not valid.' using errcode = '22023';
  end if;
  if p_accuracy_meters is not null and (p_accuracy_meters < 0 or p_accuracy_meters > 100000) then
    p_accuracy_meters := null;
  end if;

  select t.* into v_tag from public.tags t
    where t.tag_code = trim(p_tag_code) and coalesce(t.status, '') <> 'disabled'
    limit 1;
  if v_tag.id is null or v_tag.pet_id is null then
    raise exception 'This tag is not linked to a pet yet.' using errcode = 'P0002';
  end if;

  select count(*) into v_recent from public.scan_events s
    where s.tag_id = v_tag.id and s.created_at > now() - interval '10 minutes';
  if v_recent >= 10 then
    raise exception 'Too many reports for this tag right now. Please try again in a few minutes.' using errcode = 'P0001';
  end if;
  select count(*) into v_recent from public.scan_events s
    where s.tag_id = v_tag.id and s.created_at > now() - interval '1 day';
  if v_recent >= 100 then
    raise exception 'This tag has received too many reports today.' using errcode = 'P0001';
  end if;

  select p.owner_id into v_owner from public.pets p where p.id = v_tag.pet_id;
  if auth.uid() is not null and auth.uid() = v_owner then
    v_actor := 'owner';
  end if;

  insert into public.scan_events (
    tag_id, pet_id, actor, scanner_profile_id, latitude, longitude, accuracy_meters,
    note, reported_lost, finder_note, finder_contact, found_status, owner_follow_up
  ) values (
    v_tag.id, v_tag.pet_id, v_actor, auth.uid(), p_latitude, p_longitude, p_accuracy_meters,
    left(p_note, 500), coalesce(p_reported_lost, false), left(p_finder_note, 1000), left(p_finder_contact, 200),
    case when p_reported_lost then 'Found report received' else 'scan_only' end,
    case when p_reported_lost then 'Needs owner review' else 'not_required' end
  )
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.submit_finder_report(text, double precision, double precision, double precision, boolean, text, text, text) from public;
grant execute on function public.submit_finder_report(text, double precision, double precision, double precision, boolean, text, text, text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. tag_orders: users read only; the server (service role) writes
-- ---------------------------------------------------------------------------

drop policy if exists "tag orders owner insert" on public.tag_orders;
drop policy if exists "tag orders owner update" on public.tag_orders;
drop policy if exists "tag orders owner read" on public.tag_orders;
create policy "tag orders owner read" on public.tag_orders for select
  using (profile_id = auth.uid() or public.is_app_admin());

-- ---------------------------------------------------------------------------
-- 6. Medium / cheap fixes
-- ---------------------------------------------------------------------------

-- pet_documents: the old FOR ALL policy let anyone delete/edit rows marked public_visible.
drop policy if exists "documents owner access" on public.pet_documents;
drop policy if exists "documents public or owner read" on public.pet_documents;
drop policy if exists "documents owner insert" on public.pet_documents;
drop policy if exists "documents owner update" on public.pet_documents;
drop policy if exists "documents owner delete" on public.pet_documents;
create policy "documents public or owner read" on public.pet_documents for select
  using (owner_id = auth.uid() or public_visible or public.is_app_admin());
create policy "documents owner insert" on public.pet_documents for insert
  with check (owner_id = auth.uid() or public.is_app_admin());
create policy "documents owner update" on public.pet_documents for update
  using (owner_id = auth.uid() or public.is_app_admin())
  with check (owner_id = auth.uid() or public.is_app_admin());
create policy "documents owner delete" on public.pet_documents for delete
  using (owner_id = auth.uid() or public.is_app_admin());

-- dog_pack_invites: created by /api/dog-pack/invites (service role) after slot checks.
drop policy if exists "dog pack invite owner write" on public.dog_pack_invites;
drop policy if exists "dog pack invite admin write" on public.dog_pack_invites;
create policy "dog pack invite admin write" on public.dog_pack_invites for all
  using (public.is_app_admin()) with check (public.is_app_admin());

-- pet_awards: owners could award themselves arbitrary points. Read stays owner/admin.
drop policy if exists "pet awards owner write" on public.pet_awards;
drop policy if exists "pet awards admin write" on public.pet_awards;
create policy "pet awards admin write" on public.pet_awards for all
  using (public.is_app_admin()) with check (public.is_app_admin());

-- Storage: update/delete were not limited to MyPetID buckets.
drop policy if exists "mypetid owner update storage" on storage.objects;
create policy "mypetid owner update storage" on storage.objects for update
  using (
    bucket_id in ('pet-photos','profile-images','medical-documents','tag-assets')
    and (auth.uid()::text = (storage.foldername(name))[1] or public.is_app_admin())
  )
  with check (
    bucket_id in ('pet-photos','profile-images','medical-documents','tag-assets')
    and (auth.uid()::text = (storage.foldername(name))[1] or public.is_app_admin())
  );
drop policy if exists "mypetid owner delete storage" on storage.objects;
create policy "mypetid owner delete storage" on storage.objects for delete
  using (
    bucket_id in ('pet-photos','profile-images','medical-documents','tag-assets')
    and (auth.uid()::text = (storage.foldername(name))[1] or public.is_app_admin())
  );

-- SVG in a public bucket allows stored script on the storage origin.
update storage.buckets
   set allowed_mime_types = array_remove(allowed_mime_types, 'image/svg+xml')
 where id = 'tag-assets' and 'image/svg+xml' = any(allowed_mime_types);

-- account_activity_log.source defaulted to the raw request headers, which include the
-- caller's bearer token and apikey. Store headers without credentials and redact old rows.
create or replace function public.mypetid_redact_headers(raw text)
returns text
language plpgsql
stable
as $$
declare
  parsed jsonb;
begin
  if raw is null or raw !~ '^\s*\{' then
    return raw;
  end if;
  begin
    parsed := raw::jsonb;
  exception when others then
    return raw;
  end;
  return (parsed - 'authorization' - 'apikey' - 'cookie' - 'x-supabase-auth')::text;
end;
$$;

alter table public.account_activity_log
  alter column source set default coalesce(public.mypetid_redact_headers(nullif(current_setting('request.headers', true), '')), 'database');

update public.account_activity_log
   set source = public.mypetid_redact_headers(source)
 where source ~* '"(authorization|apikey|cookie|x-supabase-auth)"';

-- One Patreon/Google account may only be linked to one MyPetID profile.
do $$
begin
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'provider_credentials_provider_subject_key') then
    if exists (
      select 1 from public.provider_credentials
      where provider_subject is not null
      group by provider, provider_subject
      having count(*) > 1
    ) then
      raise notice 'Skipped provider_credentials_provider_subject_key: duplicate provider subjects exist. Resolve them and re-run this file.';
    else
      create unique index provider_credentials_provider_subject_key
        on public.provider_credentials(provider, provider_subject)
        where provider_subject is not null;
    end if;
  end if;
end $$;

-- /api/coupons/redeem logs provider 'coupon', which the old check constraint rejected.
alter table public.membership_events drop constraint if exists membership_events_provider_check;
alter table public.membership_events
  add constraint membership_events_provider_check
  check (provider in ('stripe', 'patreon', 'manual', 'admin', 'coupon'));

commit;
