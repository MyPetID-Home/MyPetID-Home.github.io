-- MyPetID: signed-in-only functions (October 2026). Applied live on 2026-10-25.
-- Supabase grants EXECUTE on new functions to anon directly, so "revoke from public"
-- in the earlier files didn't stop signed-out callers. Trigger functions are never RPCs.
revoke execute on function public.accept_pack_invite(text), public.are_pack_friends(uuid, uuid), public.claim_guest_pet(text, text), public.join_pack_by_code(text), public.meetups_near(double precision, double precision, double precision), public.my_pack_code(), public.mypetid_is_verified(uuid), public.mypetid_public_name(uuid), public.nearby_owners(double precision, double precision, double precision), public.pack_friends(), public.pack_walking_now(), public.mypetid_autohide_reported_meetup(), public.audit_row_change() from anon;
revoke execute on function public.mypetid_autohide_reported_meetup(), public.audit_row_change() from authenticated;
alter function public.mypetid_round_presence() set search_path = public;
alter function public.mypetid_guest_name_key(text) set search_path = public;
