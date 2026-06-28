-- MyPetID admin audit, storage, verification, and calendar migration.
-- Target project: ryyaefxszkmibcnngnfg (MyPetID-Home).
-- Idempotent: safe to rerun.

begin;

create extension if not exists pgcrypto with schema extensions;

-- Shared helpers ------------------------------------------------------------
create or replace function public.is_mypetid_admin(check_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = check_user
      and (p.is_admin = true or p.tier = 'admin')
  );
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Missing app tables --------------------------------------------------------
create table if not exists public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('patreon', 'google', 'email', 'phone', 'manual')),
  requested_scopes text[] not null default '{}',
  status text not null check (status in ('pending', 'approved', 'denied', 'verified', 'failed', 'cancelled')) default 'pending',
  provider_subject text,
  verified_tier text,
  metadata jsonb not null default '{}'::jsonb,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.verification_requests add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.verification_requests add column if not exists reviewed_by uuid references public.profiles(id) on delete set null;
alter table public.verification_requests add column if not exists reviewed_at timestamptz;

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  pet_id uuid references public.pets(id) on delete cascade,
  title text not null,
  category text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  timezone text,
  repeat_rule text,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled', 'missed')),
  source text not null default 'mypetid',
  google_event_id text,
  reminder_minutes integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.calendar_events add column if not exists ends_at timestamptz;
alter table public.calendar_events add column if not exists timezone text;
alter table public.calendar_events add column if not exists repeat_rule text;
alter table public.calendar_events add column if not exists status text not null default 'scheduled';
alter table public.calendar_events add column if not exists reminder_minutes integer;
alter table public.calendar_events add column if not exists metadata jsonb not null default '{}'::jsonb;

-- Audit history -------------------------------------------------------------
create table if not exists public.account_activity_log (
  id uuid primary key default gen_random_uuid(),
  event_time timestamptz not null default now(),
  actor_profile_id uuid references public.profiles(id) on delete set null,
  actor_email text,
  target_profile_id uuid references public.profiles(id) on delete set null,
  target_pet_id uuid references public.pets(id) on delete set null,
  target_table text not null,
  target_record_id text,
  action text not null check (action in ('insert', 'update', 'delete', 'admin_action', 'system')),
  changed_fields text[] not null default '{}',
  before_data jsonb,
  after_data jsonb,
  source text not null default coalesce(nullif(current_setting('request.headers', true), ''), 'database'),
  request_id text default nullif(current_setting('request.request_id', true), ''),
  user_agent text,
  device_fingerprint text,
  note text
);

create index if not exists account_activity_log_event_time_idx on public.account_activity_log (event_time desc);
create index if not exists account_activity_log_actor_idx on public.account_activity_log (actor_profile_id, event_time desc);
create index if not exists account_activity_log_target_profile_idx on public.account_activity_log (target_profile_id, event_time desc);
create index if not exists account_activity_log_target_pet_idx on public.account_activity_log (target_pet_id, event_time desc);
create index if not exists account_activity_log_target_table_idx on public.account_activity_log (target_table, target_record_id);

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  before_row jsonb;
  after_row jsonb;
  actor uuid;
  claims jsonb;
  actor_mail text;
  profile_target uuid;
  pet_target uuid;
  record_target text;
  changed text[] := '{}';
begin
  if tg_op = 'INSERT' then
    after_row := to_jsonb(new);
  elsif tg_op = 'UPDATE' then
    before_row := to_jsonb(old);
    after_row := to_jsonb(new);
    select coalesce(array_agg(key order by key), '{}')
      into changed
      from jsonb_each(after_row)
      where before_row -> key is distinct from after_row -> key;
  elsif tg_op = 'DELETE' then
    before_row := to_jsonb(old);
  end if;

  begin
    claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  exception when others then
    claims := '{}'::jsonb;
  end;

  begin
    actor := nullif(coalesce(claims ->> 'sub', current_setting('request.jwt.claim.sub', true)), '')::uuid;
  exception when others then
    actor := null;
  end;

  actor_mail := coalesce(claims ->> 'email', current_setting('request.jwt.claim.email', true));

  profile_target := nullif(coalesce(
    after_row ->> 'owner_id', before_row ->> 'owner_id',
    after_row ->> 'profile_id', before_row ->> 'profile_id',
    after_row ->> 'created_by', before_row ->> 'created_by',
    after_row ->> 'scanner_profile_id', before_row ->> 'scanner_profile_id',
    case when tg_table_name = 'profiles' then coalesce(after_row ->> 'id', before_row ->> 'id') end
  ), '')::uuid;

  pet_target := nullif(coalesce(
    after_row ->> 'pet_id', before_row ->> 'pet_id',
    case when tg_table_name = 'pets' then coalesce(after_row ->> 'id', before_row ->> 'id') end
  ), '')::uuid;

  record_target := coalesce(after_row ->> 'id', before_row ->> 'id', after_row ->> 'tag_code', before_row ->> 'tag_code');

  insert into public.account_activity_log (
    actor_profile_id, actor_email, target_profile_id, target_pet_id,
    target_table, target_record_id, action, changed_fields, before_data, after_data
  ) values (
    actor, actor_mail, profile_target, pet_target,
    tg_table_name, record_target, lower(tg_op), coalesce(changed, '{}'), before_row, after_row
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- RLS -----------------------------------------------------------------------
alter table public.verification_requests enable row level security;
alter table public.calendar_events enable row level security;
alter table public.account_activity_log enable row level security;

drop policy if exists "verification owner/admin read" on public.verification_requests;
create policy "verification owner/admin read" on public.verification_requests for select
  using (auth.uid() = profile_id or public.is_mypetid_admin(auth.uid()));
drop policy if exists "verification owner insert" on public.verification_requests;
create policy "verification owner insert" on public.verification_requests for insert
  with check (auth.uid() = profile_id or public.is_mypetid_admin(auth.uid()));
drop policy if exists "verification owner/admin update" on public.verification_requests;
create policy "verification owner/admin update" on public.verification_requests for update
  using (auth.uid() = profile_id or public.is_mypetid_admin(auth.uid()))
  with check (auth.uid() = profile_id or public.is_mypetid_admin(auth.uid()));

drop policy if exists "calendar owner/admin read" on public.calendar_events;
create policy "calendar owner/admin read" on public.calendar_events for select
  using (auth.uid() = profile_id or public.is_mypetid_admin(auth.uid()));
drop policy if exists "calendar owner insert" on public.calendar_events;
create policy "calendar owner insert" on public.calendar_events for insert
  with check (auth.uid() = profile_id or public.is_mypetid_admin(auth.uid()));
drop policy if exists "calendar owner/admin update" on public.calendar_events;
create policy "calendar owner/admin update" on public.calendar_events for update
  using (auth.uid() = profile_id or public.is_mypetid_admin(auth.uid()))
  with check (auth.uid() = profile_id or public.is_mypetid_admin(auth.uid()));
drop policy if exists "calendar owner/admin delete" on public.calendar_events;
create policy "calendar owner/admin delete" on public.calendar_events for delete
  using (auth.uid() = profile_id or public.is_mypetid_admin(auth.uid()));

drop policy if exists "activity admin read" on public.account_activity_log;
create policy "activity admin read" on public.account_activity_log for select
  using (public.is_mypetid_admin(auth.uid()));

-- Updated-at triggers -------------------------------------------------------
drop trigger if exists verification_requests_touch_updated_at on public.verification_requests;
create trigger verification_requests_touch_updated_at before update on public.verification_requests
for each row execute function public.touch_updated_at();

drop trigger if exists calendar_events_touch_updated_at on public.calendar_events;
create trigger calendar_events_touch_updated_at before update on public.calendar_events
for each row execute function public.touch_updated_at();

-- Change-history triggers ---------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'pets', 'tags', 'devices', 'scan_events', 'profile_links',
    'pet_care_events', 'pet_documents', 'verification_requests', 'calendar_events'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists mypetid_audit_%I on public.%I', t, t);
      execute format('create trigger mypetid_audit_%I after insert or update or delete on public.%I for each row execute function public.audit_row_change()', t, t);
    end if;
  end loop;
end $$;

-- Admin lookup view ---------------------------------------------------------
create or replace view public.admin_account_debug_view
with (security_invoker = true)
as
select
  p.id as profile_id,
  p.email,
  p.display_name,
  p.phone,
  p.tier,
  p.is_admin,
  p.created_at,
  p.updated_at,
  coalesce(pet_counts.pet_count, 0) as pet_count,
  coalesce(tag_counts.tag_count, 0) as tag_count,
  coalesce(scan_counts.scan_count, 0) as scan_count,
  coalesce(device_counts.device_count, 0) as device_count,
  coalesce(doc_counts.document_count, 0) as document_count,
  coalesce(care_counts.care_event_count, 0) as care_event_count,
  coalesce(calendar_counts.calendar_event_count, 0) as calendar_event_count,
  coalesce(verify_counts.verification_count, 0) as verification_count,
  activity.last_activity_at
from public.profiles p
left join lateral (select count(*)::int pet_count from public.pets where owner_id = p.id) pet_counts on true
left join lateral (select count(*)::int tag_count from public.tags where created_by = p.id or pet_id in (select id from public.pets where owner_id = p.id)) tag_counts on true
left join lateral (select count(*)::int scan_count from public.scan_events where scanner_profile_id = p.id or pet_id in (select id from public.pets where owner_id = p.id)) scan_counts on true
left join lateral (select count(*)::int device_count from public.devices where profile_id = p.id) device_counts on true
left join lateral (select count(*)::int document_count from public.pet_documents where owner_id = p.id) doc_counts on true
left join lateral (select count(*)::int care_event_count from public.pet_care_events where owner_id = p.id) care_counts on true
left join lateral (select count(*)::int calendar_event_count from public.calendar_events where profile_id = p.id) calendar_counts on true
left join lateral (select count(*)::int verification_count from public.verification_requests where profile_id = p.id) verify_counts on true
left join lateral (select max(event_time) last_activity_at from public.account_activity_log where target_profile_id = p.id or actor_profile_id = p.id) activity on true;

grant select on public.admin_account_debug_view to authenticated;

-- Storage buckets -----------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('pet-photos', 'pet-photos', true, 10485760, array['image/jpeg','image/png','image/webp','image/gif']),
  ('profile-images', 'profile-images', false, 10485760, array['image/jpeg','image/png','image/webp','image/gif']),
  ('medical-documents', 'medical-documents', false, 52428800, array['application/pdf','image/jpeg','image/png','image/webp']),
  ('tag-assets', 'tag-assets', true, 10485760, array['image/svg+xml','image/png','image/jpeg','application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "mypetid public read pet photos" on storage.objects;
create policy "mypetid public read pet photos" on storage.objects for select
  using (bucket_id = 'pet-photos');
drop policy if exists "mypetid public read tag assets" on storage.objects;
create policy "mypetid public read tag assets" on storage.objects for select
  using (bucket_id = 'tag-assets');
drop policy if exists "mypetid owner read private storage" on storage.objects;
create policy "mypetid owner read private storage" on storage.objects for select
  using (
    bucket_id in ('profile-images','medical-documents')
    and (auth.uid()::text = (storage.foldername(name))[1] or public.is_mypetid_admin(auth.uid()))
  );
drop policy if exists "mypetid owner upload storage" on storage.objects;
create policy "mypetid owner upload storage" on storage.objects for insert
  with check (
    bucket_id in ('pet-photos','profile-images','medical-documents','tag-assets')
    and (auth.uid()::text = (storage.foldername(name))[1] or public.is_mypetid_admin(auth.uid()))
  );
drop policy if exists "mypetid owner update storage" on storage.objects;
create policy "mypetid owner update storage" on storage.objects for update
  using (auth.uid()::text = (storage.foldername(name))[1] or public.is_mypetid_admin(auth.uid()))
  with check (auth.uid()::text = (storage.foldername(name))[1] or public.is_mypetid_admin(auth.uid()));
drop policy if exists "mypetid owner delete storage" on storage.objects;
create policy "mypetid owner delete storage" on storage.objects for delete
  using (auth.uid()::text = (storage.foldername(name))[1] or public.is_mypetid_admin(auth.uid()));

commit;
