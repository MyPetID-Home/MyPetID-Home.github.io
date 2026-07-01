-- MyPetID email verification-code flow.
-- Uses mypetid@yahoo.com as sender through private SMTP env on Vercel.

alter table public.profiles add column if not exists email_verified_at timestamptz;

create table if not exists public.email_verification_codes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  email text not null,
  purpose text not null default 'signup' check (purpose in ('signup', 'email_change', 'account_recovery')),
  code_hash text not null,
  status text not null default 'pending' check (status in ('pending', 'verified', 'expired', 'failed', 'cancelled')),
  attempts integer not null default 0,
  sent_count integer not null default 1,
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  verified_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists email_verification_codes_profile_idx on public.email_verification_codes(profile_id, created_at desc);
create index if not exists email_verification_codes_email_idx on public.email_verification_codes(lower(email), created_at desc);
create index if not exists email_verification_codes_pending_idx on public.email_verification_codes(profile_id, purpose, status, expires_at desc);

alter table public.email_verification_codes enable row level security;

drop policy if exists "email verification owner/admin read" on public.email_verification_codes;
create policy "email verification owner/admin read" on public.email_verification_codes for select using (
  auth.uid() = profile_id or public.is_app_admin()
);

drop policy if exists "email verification admin write" on public.email_verification_codes;
create policy "email verification admin write" on public.email_verification_codes for all using (public.is_app_admin()) with check (public.is_app_admin());

drop trigger if exists email_verification_codes_touch_updated_at on public.email_verification_codes;
create trigger email_verification_codes_touch_updated_at before update on public.email_verification_codes
  for each row execute function public.touch_updated_at();
