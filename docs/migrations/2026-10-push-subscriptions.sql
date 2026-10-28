-- MyPetID (October 2026): web push subscriptions.
--
-- One row per browser/device that opted in to push alerts. The Vercel route
-- /api/push/subscribe upserts rows (by endpoint) for the signed-in user, and
-- /api/push/dispatch (called by a Supabase Database Webhook on notifications
-- INSERT) sends to every row of that notification's profile with the service
-- role, deleting rows the push service reports as gone (404/410).
--
-- Safe to run more than once. ASCII only.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique check (length(endpoint) between 10 and 1000 and endpoint like 'https://%'),
  p256dh text not null check (length(p256dh) between 10 and 200),
  auth text not null check (length(auth) between 8 and 100),
  user_agent text check (user_agent is null or length(user_agent) <= 300),
  created_at timestamptz not null default now(),
  last_success_at timestamptz,
  failures int not null default 0
);

-- Columns added later stay idempotent for databases that ran an earlier draft.
alter table public.push_subscriptions add column if not exists user_agent text;
alter table public.push_subscriptions add column if not exists last_success_at timestamptz;
alter table public.push_subscriptions add column if not exists failures int not null default 0;

create index if not exists push_subscriptions_profile_idx on public.push_subscriptions (profile_id);

alter table public.push_subscriptions enable row level security;

-- Own rows only. The server routes use the service role and bypass RLS.
drop policy if exists "push subscriptions own read" on public.push_subscriptions;
create policy "push subscriptions own read" on public.push_subscriptions
  for select to authenticated using (profile_id = auth.uid());

drop policy if exists "push subscriptions own insert" on public.push_subscriptions;
create policy "push subscriptions own insert" on public.push_subscriptions
  for insert to authenticated with check (profile_id = auth.uid());

drop policy if exists "push subscriptions own update" on public.push_subscriptions;
create policy "push subscriptions own update" on public.push_subscriptions
  for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());

drop policy if exists "push subscriptions own delete" on public.push_subscriptions;
create policy "push subscriptions own delete" on public.push_subscriptions
  for delete to authenticated using (profile_id = auth.uid());

-- Anonymous visitors never touch this table.
revoke all on public.push_subscriptions from anon;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- No new functions are created by this migration, so there is nothing to
-- revoke from anon beyond the table grant above.

-- Check:
--   select count(*) from public.push_subscriptions;
--   select policyname from pg_policies where tablename = 'push_subscriptions';
