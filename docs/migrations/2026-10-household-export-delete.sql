-- MyPetID: households (several people on one dog), data export support, account deletion support.
-- Target project: ryyaefxszkmibcnngnfg (MyPetID-Home).
-- Idempotent: safe to run more than once. ASCII only. Paste into the Supabase SQL editor and run.
--
-- Depends on the entitlement migration (public.mypetid_plan_limits(uuid) returning jsonb with
-- tier, paid, max_users, ...). If that function is missing, every household check below fails
-- CLOSED (no shared access), so running this file first is harmless; it starts working as soon
-- as the entitlement migration lands.
--
-- IMPORTANT: mypetid_plan_limits() refuses p_uid <> auth.uid() for browser JWTs, even when
-- called from a SECURITY DEFINER function. Members' access checks read the OWNER's plan, so the
-- entitlement migration must also provide public.mypetid_plan_limits_internal(uuid) (same body,
-- no caller guard, execute revoked from public/anon/authenticated). Until it exists, owners can
-- manage invites but members fail closed (no shared access).
--
-- Run this file again AFTER docs/migrations/2026-10-health-sitter-poster.sql so the household
-- read policies are added to pet_health_records / pet_weights (they are skipped while those
-- tables do not exist).
--
-- What household members can do (enforced here, not just in the UI):
--   viewer    : read the shared dog's pets row, and its health records / weights (if those
--               tables exist). Nothing else, no writes.
--   caretaker : everything a viewer can, plus UPDATE the shared pets row, but only the keys
--               profile.care_schedule and profile.care_log (ticking off and editing the care
--               schedule). A trigger rejects any other column or profile key change.
--   Members can never: delete the dog, change name/photo/contact/public fields/lost mode, see
--   or edit tags, scans, documents, walks, invite others, change roles, or read the owner's
--   profile row. Members can leave (household_remove on their own row).
--   Access exists only while the OWNER's plan allows it: plan paid (or admin), max_users >= 2,
--   and owner + distinct active members <= max_users. When the owner stops paying or downgrades,
--   every member loses access automatically (rows stay, so it comes back if they resubscribe).

begin;

-- ---------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------

create table if not exists public.pet_household_members (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  member_id uuid references public.profiles(id) on delete cascade,
  role text not null default 'caretaker',
  status text not null default 'invited',
  invite_code_hash text,
  invited_email text,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pet_household_members_role_check') then
    alter table public.pet_household_members add constraint pet_household_members_role_check check (role in ('caretaker', 'viewer'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pet_household_members_status_check') then
    alter table public.pet_household_members add constraint pet_household_members_status_check check (status in ('invited', 'active', 'removed'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pet_household_members_not_owner') then
    alter table public.pet_household_members add constraint pet_household_members_not_owner check (member_id is null or member_id <> owner_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pet_household_members_email_len') then
    alter table public.pet_household_members add constraint pet_household_members_email_len check (invited_email is null or length(invited_email) <= 254);
  end if;
end;
$$;

create unique index if not exists pet_household_members_code_hash_idx on public.pet_household_members (invite_code_hash) where invite_code_hash is not null;
create unique index if not exists pet_household_members_one_active_idx on public.pet_household_members (pet_id, member_id) where status = 'active';
create index if not exists pet_household_members_member_idx on public.pet_household_members (member_id, status);
create index if not exists pet_household_members_owner_idx on public.pet_household_members (owner_id, status);

alter table public.pet_household_members enable row level security;

-- Reads: the owner sees rows for their dogs, a member sees their own rows. All writes go
-- through the SECURITY DEFINER functions below.
drop policy if exists "household owner or member read" on public.pet_household_members;
create policy "household owner or member read" on public.pet_household_members for select to authenticated
  using (owner_id = auth.uid() or member_id = auth.uid() or public.is_app_admin());

revoke all on public.pet_household_members from anon;
revoke insert, update, delete on public.pet_household_members from authenticated;
grant select on public.pet_household_members to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Plan checks
-- ---------------------------------------------------------------------------

-- True when p_owner's plan currently allows a household with p_extra more distinct members
-- than it has now. Fails closed when the entitlement function is missing.
create or replace function public.mypetid_household_plan_ok(p_owner uuid, p_extra integer default 0)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limits jsonb;
  v_max integer;
  v_admin boolean;
  v_paid boolean;
  v_members integer;
begin
  if p_owner is null then
    return false;
  end if;
  -- mypetid_plan_limits() refuses to report on another user when the request JWT is a browser
  -- role, even when called from inside a SECURITY DEFINER function (it checks auth.jwt()).
  -- A household member's RLS check must read the OWNER's plan, so prefer the unguarded
  -- internal variant mypetid_plan_limits_internal(uuid) when the entitlement migration
  -- provides it. Otherwise only the owner's own checks succeed and members fail closed.
  begin
    if to_regprocedure('public.mypetid_plan_limits_internal(uuid)') is not null then
      execute 'select public.mypetid_plan_limits_internal($1)' into v_limits using p_owner;
    elsif to_regprocedure('public.mypetid_plan_limits(uuid)') is not null then
      execute 'select public.mypetid_plan_limits($1)' into v_limits using p_owner;
    else
      return false;
    end if;
  exception when others then
    return false;
  end;
  if v_limits is null then
    return false;
  end if;
  v_admin := coalesce(v_limits ->> 'tier', '') = 'admin';
  v_paid := coalesce((v_limits ->> 'paid')::boolean, false);
  if not v_admin and not v_paid then
    return false;
  end if;
  -- null max_users means unlimited (admin)
  v_max := case when v_limits ? 'max_users' and jsonb_typeof(v_limits -> 'max_users') = 'number'
                then (v_limits ->> 'max_users')::numeric::integer end;
  if v_max is null and not v_admin then
    return false;
  end if;
  if v_max is not null and v_max < 2 then
    return false;
  end if;
  if v_max is null then
    return true;
  end if;
  select count(distinct m.member_id) into v_members
    from public.pet_household_members m
   where m.owner_id = p_owner and m.status = 'active' and m.member_id is not null;
  return 1 + v_members + greatest(coalesce(p_extra, 0), 0) <= v_max;
end;
$$;

-- True only if p_uid has an ACTIVE membership on p_pet, the membership's owner still owns the
-- pet, and that owner's plan currently allows the household. Used by RLS policies.
create or replace function public.mypetid_household_can_access(p_pet uuid, p_uid uuid default auth.uid())
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  if p_pet is null or p_uid is null then
    return false;
  end if;
  select m.owner_id into v_owner
    from public.pet_household_members m
    join public.pets p on p.id = m.pet_id and p.owner_id = m.owner_id
   where m.pet_id = p_pet and m.member_id = p_uid and m.status = 'active'
   limit 1;
  if v_owner is null then
    return false;
  end if;
  return public.mypetid_household_plan_ok(v_owner, 0);
end;
$$;

-- The member's role on p_pet when they currently have access, else null.
create or replace function public.mypetid_household_role(p_pet uuid, p_uid uuid default auth.uid())
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  if not public.mypetid_household_can_access(p_pet, p_uid) then
    return null;
  end if;
  select m.role into v_role from public.pet_household_members m
   where m.pet_id = p_pet and m.member_id = p_uid and m.status = 'active' limit 1;
  return v_role;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. RPCs (all writes)
-- ---------------------------------------------------------------------------

-- Owner creates an invite for one dog. Returns the plain code ONCE; only its sha256 is stored.
-- Codes expire 7 days after created_at and work once.
create or replace function public.create_household_invite(p_pet uuid, p_role text default 'caretaker', p_email text default null)
returns table (invite_id uuid, code text, expires_at timestamptz)
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_me uuid := auth.uid();
  v_code text;
  v_id uuid;
  v_created timestamptz;
  v_open integer;
begin
  if v_me is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  if p_role not in ('caretaker', 'viewer') then raise exception 'Choose caretaker or viewer.' using errcode = '22023'; end if;
  if not exists (select 1 from public.pets p where p.id = p_pet and p.owner_id = v_me) then
    raise exception 'Only the dog''s owner can invite people.' using errcode = '42501';
  end if;
  if not public.mypetid_household_plan_ok(v_me, 1) then
    raise exception 'Households need a Silver or Diamond plan with a free seat.' using errcode = '42501';
  end if;
  select count(*) into v_open from public.pet_household_members m
   where m.owner_id = v_me and m.status = 'invited' and m.created_at > now() - interval '7 days';
  if v_open >= 10 then
    raise exception 'You have too many open invites. Remove some first.' using errcode = '54000';
  end if;
  v_code := encode(gen_random_bytes(16), 'hex');
  insert into public.pet_household_members (pet_id, owner_id, role, status, invite_code_hash, invited_email)
  values (p_pet, v_me, p_role, 'invited', encode(digest(v_code, 'sha256'), 'hex'), nullif(lower(trim(coalesce(p_email, ''))), ''))
  returning id, created_at into v_id, v_created;
  invite_id := v_id;
  code := v_code;
  expires_at := v_created + interval '7 days';
  return next;
end;
$$;

-- Invitee accepts. Checks expiry, single use, and the OWNER's plan seats (owner counts as 1).
create or replace function public.accept_household_invite(p_code text)
returns table (pet_id uuid, pet_name text, role text)
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
#variable_conflict use_column
declare
  v_me uuid := auth.uid();
  v_inv public.pet_household_members%rowtype;
  v_extra integer;
  v_name text;
begin
  if v_me is null then raise exception 'Sign in to join a household.' using errcode = '42501'; end if;
  if p_code is null or length(trim(p_code)) not between 16 and 128 then
    raise exception 'This household invite is not valid.' using errcode = 'P0002';
  end if;
  select * into v_inv from public.pet_household_members m
   where m.invite_code_hash = encode(digest(lower(trim(p_code)), 'sha256'), 'hex')
   for update;
  if v_inv.id is null or v_inv.status <> 'invited' or v_inv.created_at < now() - interval '7 days' then
    raise exception 'This household invite has expired or was already used.' using errcode = 'P0002';
  end if;
  if v_inv.owner_id = v_me then
    raise exception 'That is your own invite. Send it to the person you want to add.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.pets p where p.id = v_inv.pet_id and p.owner_id = v_inv.owner_id) then
    raise exception 'This dog is no longer on that account.' using errcode = 'P0002';
  end if;

  -- Serialize seat checks per owner so two people cannot take the last seat at once.
  perform pg_advisory_xact_lock(hashtext('mypetid-household:' || v_inv.owner_id::text));

  select p.name into v_name from public.pets p where p.id = v_inv.pet_id;

  if exists (select 1 from public.pet_household_members m where m.pet_id = v_inv.pet_id and m.member_id = v_me and m.status = 'active') then
    update public.pet_household_members set status = 'removed', invite_code_hash = null where id = v_inv.id;
    pet_id := v_inv.pet_id; pet_name := v_name;
    select m.role into role from public.pet_household_members m where m.pet_id = v_inv.pet_id and m.member_id = v_me and m.status = 'active' limit 1;
    return next;
    return;
  end if;

  v_extra := case when exists (select 1 from public.pet_household_members m where m.owner_id = v_inv.owner_id and m.member_id = v_me and m.status = 'active') then 0 else 1 end;
  if not public.mypetid_household_plan_ok(v_inv.owner_id, v_extra) then
    raise exception 'This household is full or the owner''s plan no longer includes extra people.' using errcode = '42501';
  end if;

  update public.pet_household_members
     set member_id = v_me, status = 'active', accepted_at = now(), invite_code_hash = null
   where id = v_inv.id;

  insert into public.notifications (profile_id, kind, title, body, link)
  values (v_inv.owner_id, 'info', 'Someone joined your household',
          left(coalesce(public.mypetid_public_name(v_me), 'A MyPetID member') || ' can now help with ' || coalesce(v_name, 'your dog') || '.', 1000),
          '/dashboard/account/');

  pet_id := v_inv.pet_id; pet_name := v_name; role := v_inv.role;
  return next;
end;
$$;

-- Members and pending invites for one dog, with display names. Owner or an active member only.
create or replace function public.household_members(p_pet uuid)
returns table (id uuid, member_id uuid, name text, role text, status text, invited_email text, created_at timestamptz, accepted_at timestamptz, expires_at timestamptz, is_me boolean, is_owner boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_me uuid := auth.uid();
  v_owner uuid;
begin
  select p.owner_id into v_owner from public.pets p where p.id = p_pet;
  if v_me is null or v_owner is null then return; end if;
  if v_owner <> v_me and not exists (select 1 from public.pet_household_members m where m.pet_id = p_pet and m.member_id = v_me and m.status = 'active') and not public.is_app_admin() then
    return;
  end if;
  return query
    select v_owner, v_owner, public.mypetid_public_name(v_owner), 'owner'::text, 'active'::text, null::text, null::timestamptz, null::timestamptz, null::timestamptz, v_owner = v_me, true
    union all
    select m.id, m.member_id,
           case when m.member_id is null then null else public.mypetid_public_name(m.member_id) end,
           m.role, m.status,
           case when v_owner = v_me then m.invited_email end,
           m.created_at, m.accepted_at,
           case when m.status = 'invited' then m.created_at + interval '7 days' end,
           coalesce(m.member_id = v_me, false), false
      from public.pet_household_members m
     where m.pet_id = p_pet
       and (m.status = 'active' or (v_owner = v_me and m.status = 'invited' and m.created_at > now() - interval '7 days'));
end;
$$;

-- Dogs shared with me, and whether access is currently on (owner's plan still allows it).
create or replace function public.my_household_pets()
returns table (pet_id uuid, pet_name text, photo_url text, owner_name text, role text, has_access boolean, accepted_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select m.pet_id, p.name, p.photo_url, public.mypetid_public_name(m.owner_id), m.role,
         public.mypetid_household_can_access(m.pet_id, auth.uid()), m.accepted_at
    from public.pet_household_members m
    join public.pets p on p.id = m.pet_id and p.owner_id = m.owner_id
   where m.member_id = auth.uid() and m.status = 'active'
   order by m.accepted_at desc nulls last;
$$;

-- Owner changes a member's role.
create or replace function public.household_set_role(p_id uuid, p_role text)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if p_role not in ('caretaker', 'viewer') then raise exception 'Choose caretaker or viewer.' using errcode = '22023'; end if;
  update public.pet_household_members set role = p_role
   where id = p_id and owner_id = auth.uid() and status in ('invited', 'active');
  if not found then raise exception 'Only the dog''s owner can change roles.' using errcode = '42501'; end if;
end;
$$;

-- Owner removes a member or cancels an invite; a member can remove themselves (leave).
create or replace function public.household_remove(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  update public.pet_household_members set status = 'removed', invite_code_hash = null
   where id = p_id and status in ('invited', 'active') and (owner_id = auth.uid() or member_id = auth.uid());
  if not found then raise exception 'Nothing to remove.' using errcode = 'P0002'; end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. pets: household read + caretaker care-schedule update
-- ---------------------------------------------------------------------------

drop policy if exists "pets household read" on public.pets;
create policy "pets household read" on public.pets for select to authenticated
  using (public.mypetid_household_can_access(id, auth.uid()));

drop policy if exists "pets household caretaker update" on public.pets;
create policy "pets household caretaker update" on public.pets for update to authenticated
  using (public.mypetid_household_role(id, auth.uid()) = 'caretaker')
  with check (public.mypetid_household_role(id, auth.uid()) = 'caretaker');

-- A caretaker update may only change profile.care_schedule / profile.care_log.
create or replace function public.mypetid_guard_household_pet_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.mypetid_is_trusted_caller() or auth.uid() is null or auth.uid() = old.owner_id or public.is_app_admin() then
    return new;
  end if;
  if (to_jsonb(new) - 'profile' - 'updated_at') is distinct from (to_jsonb(old) - 'profile' - 'updated_at')
     or (coalesce(new.profile, '{}'::jsonb) - 'care_schedule' - 'care_log') is distinct from (coalesce(old.profile, '{}'::jsonb) - 'care_schedule' - 'care_log') then
    raise exception 'Household caretakers can only update the care schedule.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists mypetid_guard_household_pet_update on public.pets;
create trigger mypetid_guard_household_pet_update
  before update on public.pets
  for each row execute function public.mypetid_guard_household_pet_update();

-- ---------------------------------------------------------------------------
-- 5. Health records / weights (created by another migration; only if present)
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['pet_health_records', 'pet_weights'] loop
    if to_regclass('public.' || t) is not null
       and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = t and column_name = 'pet_id') then
      execute format('drop policy if exists "household read" on public.%I', t);
      execute format('create policy "household read" on public.%I for select to authenticated using (public.mypetid_household_can_access(pet_id, auth.uid()))', t);
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Function grants (Supabase grants EXECUTE to anon by default)
-- ---------------------------------------------------------------------------

revoke all on function public.mypetid_household_plan_ok(uuid, integer) from public, anon, authenticated;
revoke all on function public.mypetid_household_can_access(uuid, uuid) from public, anon;
revoke all on function public.mypetid_household_role(uuid, uuid) from public, anon;
revoke all on function public.create_household_invite(uuid, text, text) from public, anon;
revoke all on function public.accept_household_invite(text) from public, anon;
revoke all on function public.household_members(uuid) from public, anon;
revoke all on function public.my_household_pets() from public, anon;
revoke all on function public.household_set_role(uuid, text) from public, anon;
revoke all on function public.household_remove(uuid) from public, anon;
revoke all on function public.mypetid_guard_household_pet_update() from public, anon, authenticated;

grant execute on function public.mypetid_household_can_access(uuid, uuid) to authenticated;
grant execute on function public.mypetid_household_role(uuid, uuid) to authenticated;
grant execute on function public.create_household_invite(uuid, text, text) to authenticated;
grant execute on function public.accept_household_invite(text) to authenticated;
grant execute on function public.household_members(uuid) to authenticated;
grant execute on function public.my_household_pets() to authenticated;
grant execute on function public.household_set_role(uuid, text) to authenticated;
grant execute on function public.household_remove(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Account deletion support
-- ---------------------------------------------------------------------------
-- tags.created_by references profiles with NO ACTION, so deleting a profile that ever claimed
-- a tag fails. /api/account/delete nulls created_by first (service role); this makes it
-- SET NULL as a safety net so the physical tag record always survives.
do $$
declare
  v_con text;
begin
  select con.conname into v_con
    from pg_constraint con
    join pg_attribute a on a.attrelid = con.conrelid and a.attnum = any (con.conkey)
   where con.contype = 'f' and con.conrelid = 'public.tags'::regclass and a.attname = 'created_by'
     and con.confdeltype <> 'n'
   limit 1;
  if v_con is not null then
    execute format('alter table public.tags drop constraint %I', v_con);
    alter table public.tags add constraint tags_created_by_fkey foreign key (created_by) references public.profiles(id) on delete set null;
  end if;
end;
$$;

commit;

-- Verify (read-only):
--   select * from public.pet_household_members limit 5;
--   select policyname, cmd from pg_policies where tablename in ('pets','pet_household_members','pet_health_records','pet_weights');
--   select proname, proacl from pg_proc where proname like '%household%';
