-- MyPetID Patreon tier metadata.
-- Mirrors live Patreon campaign tier IDs into Supabase membership_tiers.

begin;

alter table public.membership_tiers
  add column if not exists patreon_tier_id text,
  add column if not exists patreon_title text,
  add column if not exists patreon_enabled boolean not null default false;

update public.membership_tiers set
  patreon_tier_id = '26119922',
  patreon_title = 'Free',
  patreon_enabled = true
where tier = 'free';

update public.membership_tiers set
  patreon_tier_id = '26119941',
  patreon_title = 'Basic Membership',
  patreon_enabled = true
where tier = 'basic';

update public.membership_tiers set
  patreon_tier_id = '26121496',
  patreon_title = 'Silver Membership',
  patreon_enabled = true
where tier = 'silver';

update public.membership_tiers set
  patreon_tier_id = '26119955',
  patreon_title = 'Gold Membership',
  patreon_enabled = true
where tier = 'gold';

update public.membership_tiers set
  patreon_tier_id = '26119961',
  patreon_title = 'Diamond Membership',
  patreon_enabled = true
where tier = 'diamond';

commit;
