-- Numbered tag codes: MPID-000001, MPID-000002, ... handed out in order by the database, so two
-- admins can never get the same number. Each tag opens https://mypetid.vercel.app/public/<code>.
-- Safe to run more than once. ASCII only.

create sequence if not exists public.tag_number_seq;

-- Start after any MPID- codes that already exist.
do $$
declare top bigint;
begin
  select max((regexp_match(tag_code, '^MPID-(\d+)$'))[1]::bigint) into top from public.tags where tag_code ~ '^MPID-\d+$';
  if top is not null then perform setval('public.tag_number_seq', top, true); end if;
end $$;

-- Admin only: give a dog its next tag code (or return the one it already has).
create or replace function public.admin_create_tag(p_pet uuid)
returns text language plpgsql security definer set search_path = public as $$
declare existing text; code text;
begin
  if not public.is_app_admin() then raise exception 'Admins only.' using errcode = '42501'; end if;
  if not exists (select 1 from public.pets where id = p_pet) then raise exception 'Dog not found.'; end if;
  select tag_code into existing from public.tags where pet_id = p_pet and tag_code ~ '^MPID-\d+$' order by created_at limit 1;
  if existing is not null then return existing; end if;
  code := 'MPID-' || lpad(nextval('public.tag_number_seq')::text, 6, '0');
  insert into public.tags (tag_code, pet_id, created_by, status, claimed_at) values (code, p_pet, auth.uid(), 'active', now());
  return code;
end $$;
revoke all on function public.admin_create_tag(uuid) from public, anon;
grant execute on function public.admin_create_tag(uuid) to authenticated;

-- Card desk shows the dog's numbered tag first (then any older code).
drop function if exists public.admin_card_queue();
create function public.admin_card_queue()
returns table(pet_id uuid, pet_name text, breed text, photo_url text, pet_profile jsonb, owner_id uuid, owner_name text, owner_email text, owner_phone text, owner_details jsonb, tag_code text, created_at timestamptz, owner_account_number bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_app_admin() then raise exception 'Admins only.' using errcode = '42501'; end if;
  return query
  select pt.id, pt.name, pt.breed, pt.photo_url, pt.profile, p.id, p.display_name, p.email, p.phone, p.details,
         (select t.tag_code from public.tags t where t.pet_id = pt.id order by (t.tag_code ~ '^MPID-\d+$') desc, t.claimed_at desc nulls last limit 1),
         pt.created_at, p.account_number
  from public.pets pt left join public.profiles p on p.id = pt.owner_id
  order by pt.created_at desc
  limit 300;
end $$;
revoke all on function public.admin_card_queue() from public, anon;
grant execute on function public.admin_card_queue() to authenticated;

select last_value as tag_number_now from public.tag_number_seq;
