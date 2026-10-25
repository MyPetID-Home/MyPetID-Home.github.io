-- Account numbers for license cards: every account gets a permanent sequential number.
-- The card license number is the dog's rabies tag number followed by the account number,
-- padded to 3 digits (8397 + 1 -> 8397001; account 1000 and up print as 4+ digits).
-- mypetid@yahoo.com is account 1; everyone else follows in sign-up order.
-- Safe to run more than once. ASCII only.

create sequence if not exists public.profile_account_number_seq;

alter table public.profiles add column if not exists account_number bigint;

do $$
declare r record; n bigint;
begin
  if exists (select 1 from public.profiles where account_number is null) then
    n := coalesce((select max(account_number) from public.profiles), 0);
    if not exists (select 1 from public.profiles where account_number = 1) then
      update public.profiles set account_number = 1 where lower(email) = 'mypetid@yahoo.com' and account_number is null;
      if found then n := greatest(n, 1); end if;
    end if;
    for r in select id from public.profiles where account_number is null order by created_at, id loop
      n := n + 1;
      update public.profiles set account_number = n where id = r.id;
    end loop;
  end if;
  perform setval('public.profile_account_number_seq', greatest(coalesce((select max(account_number) from public.profiles), 0), 1), true);
end $$;

create unique index if not exists profiles_account_number_key on public.profiles(account_number);

-- New accounts get the next number; nobody can choose or change their number.
create or replace function public.assign_account_number() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.account_number := nextval('public.profile_account_number_seq');
  elsif old.account_number is not null then
    new.account_number := old.account_number;
  elsif new.account_number is distinct from old.account_number then
    new.account_number := nextval('public.profile_account_number_seq');
  end if;
  return new;
end $$;
revoke all on function public.assign_account_number() from public, anon, authenticated;

drop trigger if exists profiles_account_number on public.profiles;
create trigger profiles_account_number before insert or update on public.profiles
  for each row execute function public.assign_account_number();

-- Card desk feed now includes the owner's account number.
drop function if exists public.admin_card_queue();
create function public.admin_card_queue()
returns table(pet_id uuid, pet_name text, breed text, photo_url text, pet_profile jsonb, owner_id uuid, owner_name text, owner_email text, owner_phone text, owner_details jsonb, tag_code text, created_at timestamptz, owner_account_number bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_app_admin() then raise exception 'Admins only.' using errcode = '42501'; end if;
  return query
  select pt.id, pt.name, pt.breed, pt.photo_url, pt.profile, p.id, p.display_name, p.email, p.phone, p.details,
         (select t.tag_code from public.tags t where t.pet_id = pt.id order by t.claimed_at desc nulls last limit 1), pt.created_at, p.account_number
  from public.pets pt left join public.profiles p on p.id = pt.owner_id
  order by pt.created_at desc
  limit 300;
end $$;
revoke all on function public.admin_card_queue() from public, anon;
grant execute on function public.admin_card_queue() to authenticated;

select email, account_number from public.profiles order by account_number;
