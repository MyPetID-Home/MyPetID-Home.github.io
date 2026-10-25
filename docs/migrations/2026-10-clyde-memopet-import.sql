-- Updates Clyde (pet 11111111-...) with what the owner entered in MemoPet on their
-- phone (read on 2026-10-25), plus the owner's note about the Lyme medicine reaction.
-- Run after 2026-10-clyde-demo-profile.sql. Safe to run more than once. ASCII only.
-- Owner phone, email and home address go to the private card/account fields only;
-- nothing here is added to the public scan page except the finder safety note.

do $$
declare clyde uuid := '11111111-1111-4111-8111-111111111111';
declare v_owner uuid := (select p.owner_id from public.pets p where p.id = clyde);
begin
  update public.pets set
    breed = 'American Staffordshire Terrier',
    medical_public = 'Very skittish since a reaction to Lyme medicine in summer 2026. He will not drink from a bowl and avoids feeding areas - offer water another way (cupped hands, a hose, or a cup held low) and approach slowly and calmly. No other daily medications.',
    profile = coalesce(profile, '{}'::jsonb) || jsonb_build_object(
      'details', coalesce(profile->'details', '{}'::jsonb) || jsonb_build_object(
        'sex', 'Male',
        'birthday', '2024-04-13',
        'weight_lb', 71,
        'eyes', 'Light Brown',
        'colors', 'Brindle',
        'coat', 'Short',
        'neck_in', 16,
        'microchip', '985141006173970',
        'microchip_registry', 'HomeAgain'
      ),
      'card', coalesce(profile->'card', '{}'::jsonb) || jsonb_build_object('state', 'ME'),
      'vet', jsonb_build_object(
        'clinic', 'Taylor Brook Animal Hospital',
        'phone', '207-784-1726',
        'email', 'taylorbrookah@yourvetdoc.com',
        'address', '33 Millet Drive, Auburn, ME',
        'vaccine_clinic', 'Tractor Supply, 1619 Lisbon St, Lewiston, ME',
        'vaccines', 'Rabies (1 year), DA2PP booster, flea/tick preventive - 2024-10-21'
      ),
      -- Medicine history with how it went. outcome: worked | partly | did_not_work | stopped_side_effects | unknown
      'medications', jsonb_build_array(jsonb_build_object(
        'id', 'doxy-2026-07',
        'name', 'Doxycycline 100mg',
        'reason', 'Lyme disease',
        'dose', '1 1/2 tablets every 12 hours (7 AM and 7 PM), by mouth',
        'started', '2026-07-01',
        'planned', 'One month',
        'stopped', '2026-07-22',
        'outcome', 'stopped_side_effects',
        'side_effects', 'About 3 weeks in he became extremely skittish. Since then he will not drink water out of a bowl and is terrified of the area where he used to eat and drink - he avoids it at all costs. The medicine was stopped after 3 weeks and the behavior has continued for months.',
        'ongoing', true,
        'tell_vet', true
      )),
      'care_schedule', jsonb_build_array(
        jsonb_build_object('id', 'clyde-meal-am', 'kind', 'meal', 'label', 'Breakfast', 'times', jsonb_build_array('06:30'), 'days', '[]'::jsonb, 'dose', '1 scoop dry food', 'alarm', true, 'public', false),
        jsonb_build_object('id', 'clyde-meal-pm', 'kind', 'meal', 'label', 'Dinner', 'times', jsonb_build_array('19:30'), 'days', '[]'::jsonb, 'dose', '1 scoop dry food mixed with an equal part of wet food', 'alarm', true, 'public', false),
        jsonb_build_object('id', 'clyde-walk', 'kind', 'walk', 'label', 'Walk (about 30 min)', 'times', jsonb_build_array('06:00', '18:00'), 'days', '[]'::jsonb, 'alarm', true, 'public', false),
        jsonb_build_object('id', 'clyde-play', 'kind', 'play', 'label', 'Ball time', 'times', jsonb_build_array('16:00'), 'days', '[]'::jsonb, 'alarm', false, 'public', false)
      ),
      'gear', jsonb_build_array('MemoPet Plus Red tag', 'HTA04BLACK'),
      'memopet_documents', jsonb_build_array('Rabies, Booster', 'Rabies', 'Distemper, Dewormer', 'Distemper/Dewormer (PDF)', 'Heartworm/Lyme', 'Lyme Medication')
    ),
    updated_at = now()
  where id = clyde;

  -- Card phone and address live on the owner's private account details.
  update public.profiles set details = coalesce(details, '{}'::jsonb) || jsonb_build_object(
    'card_phone', '(518) 610-3096',
    'owner_name', 'Andrew',
    'address', jsonb_build_object('line1', '37 Fisher Ave', 'line2', '', 'city', 'Lewiston', 'state', 'ME', 'postal_code', '04240')
  ) where id = v_owner;

  -- Upcoming appointments from MemoPet replace the guessed ones from the first import.
  delete from public.pet_care_events where pet_id = clyde and notes like '[clyde-demo]%' and completed_at is null;
  delete from public.pet_care_events where pet_id = clyde and notes like '[memopet]%';
  insert into public.pet_care_events (pet_id, owner_id, event_type, title, notes, scheduled_for, completed_at) values
    (clyde, v_owner, 'medicine', 'Doxycycline 100mg for Lyme', '[memopet] 1 1/2 tablets every 12 hours. Stopped after about 3 weeks: became extremely skittish, will not drink from a bowl, avoids his old eating and drinking area. Still ongoing.', '2026-07-01 07:00-04', '2026-07-22 19:00-04'),
    (clyde, v_owner, 'appointment', 'Distemper vaccine', '[memopet] Vaccine.', '2026-11-16 17:20-05', null),
    (clyde, v_owner, 'appointment', 'HomeAgain microchip renewal', '[memopet] Microchip 985141006173970.', '2027-01-16 12:00-05', null),
    (clyde, v_owner, 'appointment', 'Rabies vaccine', '[memopet] Vaccine.', '2027-02-19 17:42-05', null),
    (clyde, v_owner, 'appointment', 'Preventive care exam and SNAP 4Dx heartworm test', '[memopet] Yearly exam.', '2027-06-30 12:00-04', null),
    (clyde, v_owner, 'appointment', 'DA2PP 3-year and Rabies 3-year vaccines', '[memopet] Vaccine.', '2028-11-15 12:00-05', null);
end $$;

select p.name, p.profile->'details'->>'weight_lb' as weight_lb, p.profile->'details'->>'birthday' as birthday,
  p.profile->'medications'->0->>'outcome' as doxy_outcome,
  (select count(*) from public.pet_care_events e where e.pet_id = p.id and e.completed_at is null and e.scheduled_for > now()) as upcoming,
  (select details->>'card_phone' from public.profiles where id = p.owner_id) as card_phone
from public.pets p where p.id = '11111111-1111-4111-8111-111111111111';
