-- MyPetID: repair text garbled by a clipboard copy step (October 2026). Applied live 2026-10-25.
create or replace function public.accept_pack_invite(p_code text)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_invite public.dog_pack_invites%rowtype;
  v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'Sign in to join a Dog Pack.' using errcode = '42501'; end if;
  select * into v_invite from public.dog_pack_invites where invite_code = trim(p_code) for update;
  if v_invite.id is null or v_invite.status not in ('open', 'accepted')
     or (v_invite.expires_at is not null and v_invite.expires_at < now())
     or v_invite.used_count >= v_invite.max_uses then
    raise exception 'This invite link has expired or was already used.' using errcode = 'P0002';
  end if;
  if v_invite.inviter_profile_id = v_me then raise exception 'That''s your own invite link.' using errcode = '22023'; end if;
  if not public.are_pack_friends(v_invite.inviter_profile_id, v_me) then
    insert into public.profile_links (requester_id, receiver_id, status, accepted_at)
    values (v_invite.inviter_profile_id, v_me, 'accepted', now())
    on conflict (requester_id, receiver_id) do update set status = 'accepted', accepted_at = now();
  end if;
  update public.dog_pack_invites
     set used_count = used_count + 1,
         status = case when used_count + 1 >= max_uses then 'accepted' else status end,
         updated_at = now()
   where id = v_invite.id;
  return v_invite.inviter_profile_id;
end;
$$;
create or replace function public.guest_login(p_name text, p_pin text)
returns table (pet_id uuid, token text)
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_key text := public.mypetid_guest_name_key(p_name);
  v_match uuid;
begin
  if exists (select 1 from public.pet_guest_access g where g.name_key = v_key and g.locked_until > now()) then
    raise exception 'Too many tries. Please wait 15 minutes and try again.' using errcode = 'P0001';
  end if;
  select g.pet_id into v_match from public.pet_guest_access g
   where g.name_key = v_key and p_pin ~ '^[0-9]{6}$' and g.pin_hash = crypt(p_pin, g.pin_hash) limit 1;
  if v_match is null then
    update public.pet_guest_access set failed_attempts = failed_attempts + 1,
      locked_until = case when failed_attempts + 1 >= 5 then now() + interval '15 minutes' else locked_until end
     where name_key = v_key;
    raise exception 'That name and PIN don''t match.' using errcode = '28000';
  end if;
  update public.pet_guest_access set failed_attempts = 0, locked_until = null where name_key = v_key;
  return query select v_match, public.mypetid_guest_new_session(v_match);
end;
$$;
create or replace function public.guest_update_pet(p_token text, p_patch jsonb)
returns setof public.pets
language plpgsql
volatile
security definer
set search_path = public
as $$
declare v_pet uuid := public.mypetid_guest_pet_for(p_token);
begin
  if v_pet is null then raise exception 'Please log in to your dog''s profile again.' using errcode = '28000'; end if;
  update public.pets set
    name = coalesce(left(nullif(trim(p_patch->>'name'), ''), 40), name),
    breed = case when p_patch ? 'breed' then nullif(trim(p_patch->>'breed'), '') else breed end,
    photo_url = case when p_patch ? 'photo_url' then nullif(p_patch->>'photo_url', '') else photo_url end,
    cover_url = case when p_patch ? 'cover_url' then nullif(p_patch->>'cover_url', '') else cover_url end,
    medical_public = case when p_patch ? 'medical_public' then left(p_patch->>'medical_public', 1000) else medical_public end,
    behavior_public = case when p_patch ? 'behavior_public' then left(p_patch->>'behavior_public', 1000) else behavior_public end,
    contact_public = case when p_patch ? 'contact_public' then p_patch->'contact_public' else contact_public end,
    lost_mode = case when p_patch ? 'lost_mode' then (p_patch->>'lost_mode')::boolean else lost_mode end,
    profile = case when p_patch ? 'profile' then p_patch->'profile' else profile end,
    updated_at = now()
  where id = v_pet and owner_id is null;
  if p_patch ? 'name' then update public.pet_guest_access set name_key = public.mypetid_guest_name_key(p_patch->>'name') where pet_id = v_pet; end if;
  return query select * from public.pets where id = v_pet;
end;
$$;
create or replace function public.join_pack_by_code(p_code text)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare v_owner uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to join a Dog Pack.' using errcode = '42501'; end if;
  select id into v_owner from public.profiles where pack_code = lower(trim(p_code));
  if v_owner is null then raise exception 'That Dog Pack code wasn''t found.' using errcode = 'P0002'; end if;
  if v_owner = auth.uid() then raise exception 'That''s your own Dog Pack code.' using errcode = '22023'; end if;
  if not public.are_pack_friends(v_owner, auth.uid()) then
    insert into public.profile_links (requester_id, receiver_id, status, accepted_at)
    values (v_owner, auth.uid(), 'accepted', now())
    on conflict (requester_id, receiver_id) do update set status = 'accepted', accepted_at = now();
  end if;
  return public.mypetid_public_name(v_owner);
end;
$$;
update public.award_rules set icon = U&'\+01F43E' where title = 'Hello, world';
update public.award_rules set icon = U&'\+01F4F8' where title = 'Picture perfect';
update public.award_rules set icon = U&'\2B50' where title = 'Profile pro';
update public.award_rules set icon = U&'\+01FAAA' where title = 'Tagged & protected';
update public.award_rules set icon = U&'\+01F4DE' where title = 'Safety net';
update public.award_rules set icon = U&'\+01F3E1' where title = 'Home safe';
update public.award_rules set icon = U&'\+01F9B8' where title = 'Good Samaritan';
update public.award_rules set icon = U&'\+01F463' where title = 'First steps';
update public.award_rules set icon = U&'\+01F4C5' where title = 'Week of walks';
update public.award_rules set icon = U&'\+01F5D3\FE0F' where title = 'Month of walks';
update public.award_rules set icon = U&'\+01F97E' where title = '5 mile club';
update public.award_rules set icon = U&'\+01F3C5' where title = 'Marathon mutt';
update public.award_rules set icon = U&'\+01F3D4\FE0F' where title = 'Century trail';
update public.award_rules set icon = U&'\+01F305' where title = 'Early bird';
update public.award_rules set icon = U&'\+01F319' where title = 'Night owl';
update public.award_rules set icon = U&'\+01F9ED' where title = 'Explorer';
update public.award_rules set icon = U&'\+01F333' where title = 'Park hopper';
update public.award_rules set icon = U&'\+01F37D\FE0F' where title = 'Right on schedule';
update public.award_rules set icon = U&'\+01F963' where title = 'Meal streak';
update public.award_rules set icon = U&'\+01F4A7' where title = 'Hydration hero';
update public.award_rules set icon = U&'\+01F393' where title = 'Sit happens';
update public.award_rules set icon = U&'\+01F3C6' where title = 'Trick learner';
update public.award_rules set icon = U&'\+01F396\FE0F' where title = 'Top of the class';
update public.award_rules set icon = U&'\+01F501' where title = 'Practice makes perfect';
update public.award_rules set icon = U&'\+01F3BE' where title = 'Playtime';
update public.award_rules set icon = U&'\+01F94F' where title = 'Fetch fanatic';
update public.award_rules set icon = U&'\+01F4C4' where title = 'Health file';
update public.award_rules set icon = U&'\+01F489' where title = 'Vaccines up to date';
update public.award_rules set icon = U&'\+01FA7A' where title = 'Vet visit';
update public.award_rules set icon = U&'\2702\FE0F' where title = 'Groomed & gorgeous';
update public.award_rules set icon = U&'\23F0' where title = 'Reminder ready';
update public.award_rules set icon = U&'\+01F415\200D\+01F9BA' where title = 'Pack leader';
update public.award_rules set icon = U&'\+01F98B' where title = 'Social butterfly';
update public.award_rules set icon = U&'\+01F3AA' where title = 'Host with the most';
update public.award_rules set icon = U&'\+01F382' where title = 'Birthday pup';
update public.award_rules set icon = U&'\+01F389' where title = 'One year together';
select count(*) as still_garbled from public.award_rules where icon ~ ('[' || chr(195) || chr(226) || chr(240) || ']');
