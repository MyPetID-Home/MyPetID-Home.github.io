-- MyPetID: let new users create their own profile row (October 2026).
-- Target project: ryyaefxszkmibcnngnfg. Idempotent: safe to run more than once.
--
-- profiles had no INSERT policy, so the dashboard's first-sign-in insert was rejected
-- and new accounts (for example Google sign-ups) were left without a profile.
-- The mypetid_guard_profile_columns trigger (2026-10-security-hardening.sql) still
-- forces browser-created profiles to free / non-admin with the signed-in email.

begin;

drop policy if exists "profiles self insert" on public.profiles;
create policy "profiles self insert" on public.profiles for insert to authenticated
  with check (id = auth.uid());

-- Give existing accounts that never got a profile one now (free, non-admin by default).
insert into public.profiles (id, email, display_name)
select u.id, u.email, coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', split_part(u.email, '@', 1))
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

commit;
