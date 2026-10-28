-- MyPetID server-side entitlements (October 2026).
-- Target project: ryyaefxszkmibcnngnfg (MyPetID-Home).
-- Idempotent: safe to run more than once. Paste into the Supabase SQL editor and run.
--
-- Summary
--   1. mypetid_plan_limits(uid) decides a member's plan from the database only:
--      admin flag, active unexpired membership_grants, and Stripe/Patreon
--      membership_events that are still paid through (period end + 3 day grace).
--      profiles.tier on its own is no longer trusted.
--   2. my_entitlement() is the browser RPC; mypetid_has_paid_plan() is used by RLS.
--   3. mypetid_sync_profile_tier(uid) / mypetid_sync_all_profile_tiers() write the
--      effective tier back to profiles.tier (admins untouched). The Vercel cron
--      /api/cron/validate-memberships calls the sweep daily; pg_cron also runs it
--      when that extension is installed.
--   4. saved_walks and map_pins (walk planner, a paid feature): insert/update need a
--      paid plan. Members can still read and delete their own rows after a plan lapses.
--
-- Paid-through time for a membership_events row:
--   metadata->>'current_period_end' (ISO timestamp or epoch seconds), else
--   metadata->>'paid_through', else updated_at + 35 days. The row stays entitled
--   until that time + 3 days. Only the newest row per subscription/customer counts,
--   so a later cancelled row overrides an older active one.

begin;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Paid-through time stored on a membership event (see header). Never raises.
create or replace function public.mypetid_paid_through(p_metadata jsonb, p_updated_at timestamptz)
returns timestamptz
language plpgsql
stable
set search_path = public
as $$
declare
  raw text := nullif(trim(coalesce(p_metadata ->> 'current_period_end', p_metadata ->> 'paid_through', '')), '');
begin
  if raw is null then
    return p_updated_at + interval '35 days';
  end if;
  if raw ~ '^[0-9]+(\.[0-9]+)?$' then
    return to_timestamp(raw::double precision);
  end if;
  return raw::timestamptz;
exception when others then
  return p_updated_at + interval '35 days';
end;
$$;

revoke all on function public.mypetid_paid_through(jsonb, timestamptz) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1. Plan limits (the one place the effective tier is decided)
-- ---------------------------------------------------------------------------

-- Returns {tier, paid, max_tags, max_users, scan_tracking, source, paid_through}.
-- source: 'admin' | 'grant' | provider name ('stripe', 'patreon', ...) | 'free'.
-- The _internal version has no caller check and is only callable by other definer
-- functions (household access reads the dog owner's plan on a member's behalf).
create or replace function public.mypetid_plan_limits_internal(p_uid uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rank constant text[] := array['free', 'basic', 'silver', 'gold', 'diamond', 'admin'];
  v_paid_tiers constant text[] := array['basic', 'silver', 'gold', 'diamond'];
  v_is_admin boolean := false;
  v_tier text := 'free';
  v_source text := 'free';
  v_paid_through timestamptz := null;
  v_grant record;
  v_event record;
  v_limits public.membership_tiers%rowtype;
begin
  if p_uid is not null then
    select coalesce(p.is_admin, false) into v_is_admin from public.profiles p where p.id = p_uid;
  end if;

  if coalesce(v_is_admin, false) then
    v_tier := 'admin';
    v_source := 'admin';
  elsif p_uid is not null then
    -- (a) Admin/coupon/support grants that are active and unexpired.
    select g.tier, g.expires_at into v_grant
      from public.membership_grants g
     where g.profile_id = p_uid
       and g.status = 'active'
       and g.starts_at <= now()
       and (g.expires_at is null or g.expires_at > now())
     order by array_position(v_rank, lower(g.tier)) desc nulls last, g.expires_at desc nulls first
     limit 1;
    if found and array_position(v_rank, lower(v_grant.tier)) > array_position(v_rank, v_tier) then
      v_tier := lower(v_grant.tier);
      v_source := 'grant';
      v_paid_through := v_grant.expires_at;
    end if;

    -- (b) Provider memberships still paid through. Newest row per subscription wins.
    select e.provider, e.tier, e.paid_through into v_event
      from (
        select distinct on (m.provider, coalesce(m.provider_subscription_id, m.provider_customer_id, m.id::text))
               m.provider,
               lower(m.tier) as tier,
               m.status,
               public.mypetid_paid_through(m.metadata, coalesce(m.updated_at, m.created_at)) as paid_through
          from public.membership_events m
         where m.profile_id = p_uid
           and m.status not in ('checkout_started', 'pending')
         order by m.provider, coalesce(m.provider_subscription_id, m.provider_customer_id, m.id::text),
                  coalesce(m.updated_at, m.created_at) desc, m.created_at desc
      ) e
     where e.status in ('active', 'trialing')
       and e.tier = any(v_paid_tiers)
       and e.paid_through + interval '3 days' > now()
     order by array_position(v_rank, e.tier) desc, e.paid_through desc
     limit 1;
    if found and array_position(v_rank, v_event.tier) > array_position(v_rank, v_tier) then
      v_tier := v_event.tier;
      v_source := v_event.provider;
      v_paid_through := v_event.paid_through;
    end if;
  end if;

  select t.* into v_limits from public.membership_tiers t where t.tier = v_tier;

  return jsonb_build_object(
    'tier', v_tier,
    'paid', v_tier <> 'free',
    'max_tags', coalesce(v_limits.max_tags, case when v_tier = 'admin' then 999 else 0 end),
    'max_users', coalesce(v_limits.max_users, case when v_tier = 'admin' then 999 else 1 end),
    'scan_tracking', coalesce(v_limits.scan_tracking_enabled, v_tier <> 'free'),
    'source', v_source,
    'paid_through', v_paid_through
  );
end;
$$;

-- Browser callers may only ask about themselves (admins may ask about anyone).
create or replace function public.mypetid_plan_limits(p_uid uuid default auth.uid())
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_uid is not null
     and p_uid is distinct from auth.uid()
     and coalesce(auth.jwt() ->> 'role', '') in ('anon', 'authenticated')
     and not public.is_app_admin(auth.uid()) then
    raise exception 'You can only read your own plan.' using errcode = '42501';
  end if;
  return public.mypetid_plan_limits_internal(p_uid);
end;
$$;

create or replace function public.mypetid_effective_tier(p_uid uuid default auth.uid())
returns text
language sql
stable
security definer
set search_path = public
as $$
  select public.mypetid_plan_limits(p_uid) ->> 'tier';
$$;

create or replace function public.mypetid_has_paid_plan(p_uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((public.mypetid_plan_limits(p_uid) ->> 'paid')::boolean, false);
$$;

-- Browser RPC: supabase.rpc('my_entitlement').
create or replace function public.my_entitlement()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.mypetid_plan_limits(auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- 2. Write the effective tier back to profiles.tier
-- ---------------------------------------------------------------------------

-- SECURITY DEFINER, so mypetid_guard_profile_columns() sees a trusted caller and
-- allows the tier change. Admin profiles are never touched. Returns the tier now stored.
create or replace function public.mypetid_sync_profile_tier(p_uid uuid)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_tier text;
begin
  if p_uid is null then
    return null;
  end if;
  v_tier := public.mypetid_effective_tier(p_uid);
  update public.profiles p
     set tier = v_tier::public.user_tier
   where p.id = p_uid
     and not coalesce(p.is_admin, false)
     and p.tier::text <> 'admin'
     and v_tier <> 'admin'
     and p.tier::text is distinct from v_tier;
  return (select p.tier::text from public.profiles p where p.id = p_uid);
end;
$$;

-- Daily sweep: every non-free profile, plus free profiles that have an active
-- membership event or grant (so a missed upgrade is also repaired). Returns the
-- number of profiles whose tier changed.
create or replace function public.mypetid_sync_all_profile_tiers()
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_before text;
  v_after text;
  v_changed integer := 0;
begin
  for v_id, v_before in
    select p.id, p.tier::text
      from public.profiles p
     where not coalesce(p.is_admin, false)
       and p.tier::text <> 'admin'
       and (
         p.tier::text <> 'free'
         or exists (select 1 from public.membership_events m where m.profile_id = p.id and m.status in ('active', 'trialing'))
         or exists (select 1 from public.membership_grants g where g.profile_id = p.id and g.status = 'active')
       )
  loop
    v_after := public.mypetid_sync_profile_tier(v_id);
    if v_after is distinct from v_before then
      v_changed := v_changed + 1;
    end if;
  end loop;
  return v_changed;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Grants (Supabase gives anon EXECUTE on new functions by default)
-- ---------------------------------------------------------------------------

revoke all on function public.mypetid_plan_limits_internal(uuid) from public, anon, authenticated;
revoke all on function public.mypetid_plan_limits(uuid) from public, anon;
revoke all on function public.mypetid_effective_tier(uuid) from public, anon;
revoke all on function public.mypetid_has_paid_plan(uuid) from public, anon;
revoke all on function public.my_entitlement() from public, anon;
revoke all on function public.mypetid_sync_profile_tier(uuid) from public, anon, authenticated;
revoke all on function public.mypetid_sync_all_profile_tiers() from public, anon, authenticated;

grant execute on function public.mypetid_plan_limits_internal(uuid) to service_role;
grant execute on function public.mypetid_plan_limits(uuid) to authenticated, service_role;
grant execute on function public.mypetid_has_paid_plan(uuid) to authenticated, service_role;
grant execute on function public.my_entitlement() to authenticated, service_role;
grant execute on function public.mypetid_effective_tier(uuid) to authenticated, service_role;
grant execute on function public.mypetid_sync_profile_tier(uuid) to service_role;
grant execute on function public.mypetid_sync_all_profile_tiers() to service_role;

-- ---------------------------------------------------------------------------
-- 4. RLS: walk planner rows need a paid plan to create or change
-- ---------------------------------------------------------------------------

drop policy if exists "saved walks own" on public.saved_walks;
drop policy if exists "saved walks own read" on public.saved_walks;
drop policy if exists "saved walks paid insert" on public.saved_walks;
drop policy if exists "saved walks paid update" on public.saved_walks;
drop policy if exists "saved walks own delete" on public.saved_walks;
create policy "saved walks own read" on public.saved_walks for select to authenticated
  using (profile_id = auth.uid());
create policy "saved walks paid insert" on public.saved_walks for insert to authenticated
  with check (profile_id = auth.uid() and public.mypetid_has_paid_plan(auth.uid()));
create policy "saved walks paid update" on public.saved_walks for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid() and public.mypetid_has_paid_plan(auth.uid()));
create policy "saved walks own delete" on public.saved_walks for delete to authenticated
  using (profile_id = auth.uid());

drop policy if exists "map pins own" on public.map_pins;
drop policy if exists "map pins own read" on public.map_pins;
drop policy if exists "map pins paid insert" on public.map_pins;
drop policy if exists "map pins paid update" on public.map_pins;
drop policy if exists "map pins own delete" on public.map_pins;
create policy "map pins own read" on public.map_pins for select to authenticated
  using (profile_id = auth.uid());
create policy "map pins paid insert" on public.map_pins for insert to authenticated
  with check (profile_id = auth.uid() and public.mypetid_has_paid_plan(auth.uid()));
create policy "map pins paid update" on public.map_pins for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid() and public.mypetid_has_paid_plan(auth.uid()));
create policy "map pins own delete" on public.map_pins for delete to authenticated
  using (profile_id = auth.uid());

commit;

-- ---------------------------------------------------------------------------
-- 5. Optional pg_cron job (skipped cleanly when pg_cron is not installed).
--    Outside the transaction so a pg_cron error cannot roll back the functions.
--    The Vercel cron does the same sweep, so either one is enough.
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    execute $cmd$select cron.schedule('mypetid-sync-profile-tiers', '17 4 * * *', 'select public.mypetid_sync_all_profile_tiers()')$cmd$;
    raise notice 'pg_cron job mypetid-sync-profile-tiers scheduled (daily 04:17 UTC).';
  else
    raise notice 'pg_cron is not installed; skipped the database job. The Vercel cron /api/cron/validate-memberships runs the sweep instead.';
  end if;
end $$;

-- Verify (read-only):
--   select public.mypetid_plan_limits('<profile uuid>');
--   select proname, proacl from pg_proc where proname in ('my_entitlement','mypetid_plan_limits','mypetid_has_paid_plan','mypetid_effective_tier','mypetid_sync_profile_tier','mypetid_sync_all_profile_tiers');
--   select policyname, cmd, with_check from pg_policies where tablename in ('saved_walks','map_pins');
