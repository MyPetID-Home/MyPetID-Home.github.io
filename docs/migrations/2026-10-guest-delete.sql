-- MyPetID: guests can delete their own dog profile, and remove the QA test dog (October 2026).
begin;
create or replace function public.guest_delete_pet(p_token text)
returns boolean language plpgsql volatile security definer set search_path = public as $$
declare v_pet uuid := public.mypetid_guest_pet_for(p_token);
begin
  if v_pet is null then raise exception 'Please log in to your dog''s profile again.' using errcode = '28000'; end if;
  delete from public.pets where id = v_pet and owner_id is null;
  return true;
end;
$$;
revoke all on function public.guest_delete_pet(text) from public;
grant execute on function public.guest_delete_pet(text) to anon, authenticated;
-- The live end-to-end test created this guest dog on 2026-10-25.
delete from public.pets where owner_id is null and name = 'QA Test Pup 8841' and behavior_public = 'QA test dog, please ignore.';
commit;
