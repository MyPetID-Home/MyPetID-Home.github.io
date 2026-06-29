-- MyPetID XP, award rules, training catalog, and found-report follow-through schema.
-- Draft migration for live Supabase once admin UI/API wiring is ready.
-- Target project: ryyaefxszkmibcnngnfg.

begin;

create table if not exists public.training_categories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete cascade,
  name text not null,
  scope text not null default 'owner', -- system, owner, admin
  created_at timestamptz not null default now(),
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
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pet_awards (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid references public.pets(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  award_rule_id uuid references public.award_rules(id) on delete cascade,
  earned_at timestamptz,
  progress numeric not null default 0,
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
alter table public.scan_events add column if not exists owner_follow_up text default 'not_required';
alter table public.scan_events add column if not exists owner_resolution_note text;
alter table public.scan_events add column if not exists resolved_at timestamptz;

alter table public.training_categories enable row level security;
alter table public.training_commands enable row level security;
alter table public.award_rules enable row level security;
alter table public.pet_awards enable row level security;
alter table public.xp_events enable row level security;

commit;
