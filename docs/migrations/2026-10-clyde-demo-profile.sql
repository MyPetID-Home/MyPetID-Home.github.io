-- Fills Clyde's demo profile (pet 11111111-...) with the data from the old
-- MyPetID-Home/Update repo (data/dogs.json and the Oct 2024 vet visit summary).
-- Safe to run more than once. ASCII only.
-- Not included on purpose: owner/child photos, old GPS history (home location),
-- and the vet record image (it carries the vet's signature and license number;
-- upload it from the app's documents so it stays private).

-- Clyde belongs to the mypetid@yahoo.com account (moved from real_cak3d@yahoo.com).
do $$
declare new_owner uuid := (select id from public.profiles where lower(email) = 'mypetid@yahoo.com');
declare clyde uuid := '11111111-1111-4111-8111-111111111111';
begin
  if new_owner is null then raise exception 'mypetid@yahoo.com has no profile'; end if;
  update public.pets set owner_id = new_owner where id = clyde;
  update public.pet_care_events set owner_id = new_owner where pet_id = clyde;
  update public.pet_documents set owner_id = new_owner where pet_id = clyde;
  update public.calendar_events set profile_id = new_owner where pet_id = clyde;
  update public.pet_awards set profile_id = new_owner where pet_id = clyde;
  update public.pet_qr_codes set profile_id = new_owner where pet_id = clyde;
  update public.xp_events set profile_id = new_owner where pet_id = clyde;
end $$;

update public.pets set
  breed = 'American Staffordshire Terrier',
  photo_url = '/images/dog/Clyde-Nice.jpg',
  cover_url = '/images/dog/Good-Clyde.jpg',
  behavior_public = 'Good boy. Friendly and energetic. Loves chasing balls. Knows sit, stay, paw, lay down, turn and up. Barks at squirrels. Walks at 6 AM and 6 PM.',
  medical_public = 'Sensitive stomach, avoid rich treats. No known allergies. No daily medications.',
  public_fields = (select array(select distinct unnest(public_fields || array['details','vet']::text[]))),
  profile = coalesce(profile, '{}'::jsonb) || jsonb_build_object(
    'timezone', 'America/New_York',
    'status_tags', '[]'::jsonb,
    'details', coalesce(profile->'details', '{}'::jsonb) || jsonb_build_object(
      'sex', 'Male',
      'birthday', '2024-04-21',
      'weight_lb', 51.5,
      'eyes', 'Brown',
      'coat', 'Short',
      'colors', 'Tan and white',
      'rabies_tag', '8397'
    ),
    'card', coalesce(profile->'card', '{}'::jsonb) || jsonb_build_object(
      'state', 'ME',
      'full_name', 'Clyde Rio',
      'species', 'Canine',
      'restrictions', 'Must chase every ball',
      'signature_style', 'script'
    ),
    'vet', coalesce(profile->'vet', '{}'::jsonb) || jsonb_build_object(
      'clinic', 'Animal Protective Foundation',
      'vaccines', 'Rabies (1 year), DA2PP booster, flea/tick preventive - 2024-10-21'
    ),
    'care_schedule', jsonb_build_array(
      jsonb_build_object('id', 'clyde-walk', 'kind', 'walk', 'label', 'Morning and night walk', 'times', jsonb_build_array('06:00', '18:00'), 'days', '[]'::jsonb, 'alarm', true, 'public', false),
      jsonb_build_object('id', 'clyde-meal', 'kind', 'meal', 'label', 'Breakfast and dinner', 'times', jsonb_build_array('07:00', '18:30'), 'days', '[]'::jsonb, 'alarm', false, 'public', false),
      jsonb_build_object('id', 'clyde-play', 'kind', 'play', 'label', 'Ball time', 'times', jsonb_build_array('16:00'), 'days', '[]'::jsonb, 'alarm', false, 'public', false)
    ),
    'gallery', jsonb_build_array(
      jsonb_build_object('url', '/images/dog/Good-Clyde.jpg', 'caption', 'Nap on the blanket'),
      jsonb_build_object('url', '/images/dog/Clyde-Paw.jpg', 'caption', 'Nice to meet you'),
      jsonb_build_object('url', '/images/dog/Clyde-Sleeping.jpg', 'caption', 'Couch buddy'),
      jsonb_build_object('url', '/images/dog/Clyde-Family.jpg', 'caption', 'Clyde''s grandmother, mother and father')
    ),
    'socials', jsonb_build_object(
      'youtube', 'https://youtu.be/ZlnIO16qK2U',
      'instagram', 'https://www.instagram.com/clydedog416/',
      'facebook', 'https://www.facebook.com/ClydeDog416'
    ),
    'testimonials', jsonb_build_array(jsonb_build_object('text', 'Clyde is the best dog ever!', 'author', 'Neighbor')),
    'old_nfc_tag', '04:6C:E3:0F:BE:2A:81'
  ),
  updated_at = now()
where id = '11111111-1111-4111-8111-111111111111';

-- Vet history and what is due next (rabies was a 1-year shot, so it is overdue).
delete from public.pet_care_events
where pet_id = '11111111-1111-4111-8111-111111111111' and notes like '[clyde-demo]%';

insert into public.pet_care_events (pet_id, owner_id, event_type, title, notes, scheduled_for, completed_at)
select p.id, p.owner_id, e.event_type, e.title, '[clyde-demo] ' || e.notes, e.scheduled_for::timestamptz, e.completed_at::timestamptz
from public.pets p
cross join (values
  ('appointment', 'Wellness exam', 'Animal Protective Foundation. Weight 51.5 lb.', '2024-10-21 10:00-04', '2024-10-21 10:30-04'),
  ('medicine', 'Rabies vaccine (1 year)', 'Tag 8397, Merck.', '2024-10-21 10:00-04', '2024-10-21 10:30-04'),
  ('medicine', 'DA2PP booster', 'Given at the wellness visit.', '2024-10-21 10:00-04', '2024-10-21 10:30-04'),
  ('medicine', 'Flea and tick preventive', 'Given at the wellness visit.', '2024-10-21 10:00-04', '2024-10-21 10:30-04'),
  ('appointment', 'Rabies booster due', 'The 1-year rabies shot expired 2025-10-21. Book a booster.', '2026-11-01 10:00-04', null),
  ('appointment', 'Yearly checkup', 'Wellness exam and DA2PP.', '2026-11-01 10:30-04', null)
) as e(event_type, title, notes, scheduled_for, completed_at)
where p.id = '11111111-1111-4111-8111-111111111111';

select name, breed, (select email from public.profiles where id = p.owner_id) as owner, profile->'details' as details, jsonb_array_length(profile->'care_schedule') as schedule_items,
  (select count(*) from public.pet_care_events where pet_id = p.id) as care_events
from public.pets p where id = '11111111-1111-4111-8111-111111111111';
