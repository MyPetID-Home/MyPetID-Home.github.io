-- MyPetID XP, award rules, training catalog, and found-report follow-through schema.
-- Live-ready idempotent migration for Supabase project ryyaefxszkmibcnngnfg.
-- Excludes Vercel and Google OAuth wiring.

begin;

create table if not exists public.training_categories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete cascade,
  name text not null,
  scope text not null default 'owner', -- system, owner, admin
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, name)
);

create table if not exists public.training_commands (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid references public.pets(id) on delete cascade,
  category_id uuid references public.training_categories(id) on delete set null,
  command text not null,
  verbal_cue text,
  hand_signal text,
  proofing_goal text,
  status text not null default 'Not started',
  points integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.award_rules (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'Custom',
  icon text not null default '🏆',
  trigger_key text not null,
  target numeric not null default 1,
  points integer not null default 0,
  requirement text not null,
  active boolean not null default true,
  admin_locked boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(title, trigger_key)
);

create table if not exists public.pet_awards (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid references public.pets(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  award_rule_id uuid references public.award_rules(id) on delete cascade,
  earned_at timestamptz,
  progress numeric not null default 0,
  points_awarded integer not null default 0,
  source_event text,
  audit_note text,
  unique(pet_id, award_rule_id)
);

create table if not exists public.xp_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  pet_id uuid references public.pets(id) on delete cascade,
  award_rule_id uuid references public.award_rules(id) on delete set null,
  event_type text not null,
  points integer not null,
  source_table text,
  source_id uuid,
  note text,
  created_at timestamptz not null default now()
);

alter table public.scan_events add column if not exists found_status text default 'scan_only';
alter table public.scan_events add column if not exists finder_contact text;
alter table public.scan_events add column if not exists finder_note text;
alter table public.scan_events add column if not exists owner_follow_up text default 'not_required';
alter table public.scan_events add column if not exists owner_resolution_note text;
alter table public.scan_events add column if not exists resolved_at timestamptz;

alter table public.training_categories enable row level security;
alter table public.training_commands enable row level security;
alter table public.award_rules enable row level security;
alter table public.pet_awards enable row level security;
alter table public.xp_events enable row level security;

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

create index if not exists training_categories_owner_idx on public.training_categories(owner_id);
create index if not exists training_commands_pet_idx on public.training_commands(pet_id);
create index if not exists award_rules_active_idx on public.award_rules(active, trigger_key);
create index if not exists pet_awards_pet_idx on public.pet_awards(pet_id, profile_id);
create index if not exists xp_events_pet_profile_idx on public.xp_events(pet_id, profile_id, created_at desc);
create index if not exists scan_events_found_status_idx on public.scan_events(found_status, owner_follow_up, resolved_at);

drop policy if exists "profiles owner read" on public.profiles;
drop policy if exists "profiles owner update" on public.profiles;
drop policy if exists "pets owner write" on public.pets;

drop policy if exists "training categories owner read" on public.training_categories;
drop policy if exists "training categories owner write" on public.training_categories;
drop policy if exists "training commands owner read" on public.training_commands;
drop policy if exists "training commands owner write" on public.training_commands;
drop policy if exists "award rules active read" on public.award_rules;
drop policy if exists "award rules admin write" on public.award_rules;
drop policy if exists "pet awards owner read" on public.pet_awards;
drop policy if exists "pet awards owner write" on public.pet_awards;
drop policy if exists "xp events owner read" on public.xp_events;
drop policy if exists "xp events owner insert" on public.xp_events;
drop policy if exists "scan events owner followup update" on public.scan_events;

create policy "profiles owner read" on public.profiles for select using (
  auth.uid() = id or public.is_app_admin()
);

create policy "profiles owner update" on public.profiles for update using (
  auth.uid() = id or public.is_app_admin()
) with check (
  auth.uid() = id or public.is_app_admin()
);

create policy "pets owner write" on public.pets for all using (
  auth.uid() = owner_id or public.is_app_admin()
) with check (
  auth.uid() = owner_id or public.is_app_admin()
);

create policy "scan events owner followup update" on public.scan_events for update using (
  exists (select 1 from public.pets pet where pet.id = scan_events.pet_id and pet.owner_id = auth.uid())
  or scanner_profile_id = auth.uid()
  or public.is_app_admin()
) with check (
  exists (select 1 from public.pets pet where pet.id = scan_events.pet_id and pet.owner_id = auth.uid())
  or scanner_profile_id = auth.uid()
  or public.is_app_admin()
);

create policy "training categories owner read" on public.training_categories for select using (
  owner_id = auth.uid()
  or owner_id is null
  or public.is_app_admin()
);

create policy "training categories owner write" on public.training_categories for all using (
  owner_id = auth.uid()
  or public.is_app_admin()
) with check (
  owner_id = auth.uid()
  or public.is_app_admin()
);

create policy "training commands owner read" on public.training_commands for select using (
  exists (select 1 from public.pets pet where pet.id = training_commands.pet_id and pet.owner_id = auth.uid())
  or public.is_app_admin()
);

create policy "training commands owner write" on public.training_commands for all using (
  exists (select 1 from public.pets pet where pet.id = training_commands.pet_id and pet.owner_id = auth.uid())
  or public.is_app_admin()
) with check (
  exists (select 1 from public.pets pet where pet.id = training_commands.pet_id and pet.owner_id = auth.uid())
  or public.is_app_admin()
);

create policy "award rules active read" on public.award_rules for select using (
  active = true
  or public.is_app_admin()
);

create policy "award rules admin write" on public.award_rules for all using (
  public.is_app_admin()
) with check (
  public.is_app_admin()
);

create policy "pet awards owner read" on public.pet_awards for select using (
  profile_id = auth.uid()
  or exists (select 1 from public.pets pet where pet.id = pet_awards.pet_id and pet.owner_id = auth.uid())
  or public.is_app_admin()
);

create policy "pet awards owner write" on public.pet_awards for all using (
  profile_id = auth.uid()
  or exists (select 1 from public.pets pet where pet.id = pet_awards.pet_id and pet.owner_id = auth.uid())
  or public.is_app_admin()
) with check (
  profile_id = auth.uid()
  or exists (select 1 from public.pets pet where pet.id = pet_awards.pet_id and pet.owner_id = auth.uid())
  or public.is_app_admin()
);

create policy "xp events owner read" on public.xp_events for select using (
  profile_id = auth.uid()
  or exists (select 1 from public.pets pet where pet.id = xp_events.pet_id and pet.owner_id = auth.uid())
  or public.is_app_admin()
);

create policy "xp events owner insert" on public.xp_events for insert with check (
  profile_id = auth.uid()
  or exists (select 1 from public.pets pet where pet.id = xp_events.pet_id and pet.owner_id = auth.uid())
  or public.is_app_admin()
);

insert into public.award_rules (title, category, icon, trigger_key, target, points, requirement, active, admin_locked)
values
  ('Profile pro', 'Profile', '🐾', 'profile_completion', 90, 60, 'Complete public, medical, and contact profile sections.', true, true),
  ('Patreon linked', 'Account', '💎', 'patreon_linked', 1, 100, 'Link an active Patreon/subscription membership.', true, true),
  ('First real walk', 'Walks', '👣', 'miles_walked', 0.1, 50, 'Save one GPS-backed walk.', true, true),
  ('Mile club', 'Walks', '🏞️', 'miles_walked', 10, 150, 'Walk ten verified miles.', true, true),
  ('Trick learner', 'Training', '🏅', 'tricks_mastered', 3, 75, 'Master three commands or tricks.', true, true),
  ('Meal streak', 'Diet', '🍖', 'meals_completed', 2, 40, 'Mark meal times met for the day.', true, true),
  ('Play pro', 'Play', '🎾', 'play_minutes', 60, 60, 'Log one hour of enrichment play.', true, true),
  ('Found follow-through', 'Safety', '🛟', 'lost_resolved', 1, 100, 'Resolve or decline a found report with an owner note.', true, true)
on conflict (title, trigger_key) do update set
  category = excluded.category,
  icon = excluded.icon,
  target = excluded.target,
  points = excluded.points,
  requirement = excluded.requirement,
  active = excluded.active,
  admin_locked = excluded.admin_locked,
  updated_at = now();

commit;
