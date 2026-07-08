-- MyPetID card activation claim-code support.
-- Public NFC/QR Card ID remains printable/scannable; private claim code is one-time use and package-only.

alter table public.tags add column if not exists claim_code_hash text;
alter table public.tags add column if not exists claim_code_hint text;
alter table public.tags add column if not exists nfc_uid text;
alter table public.tags add column if not exists status text not null default 'unassigned';
alter table public.tags add column if not exists activated_by_device text;

create index if not exists tags_claim_code_hash_idx on public.tags(claim_code_hash) where claim_code_hash is not null;
create index if not exists tags_nfc_uid_idx on public.tags(nfc_uid) where nfc_uid is not null;

comment on column public.tags.claim_code_hash is 'SHA-256 of normalized one-time private package claim code. Never store raw claim codes.';
comment on column public.tags.claim_code_hint is 'Short non-secret support hint, e.g. final 4 characters.';
comment on column public.tags.nfc_uid is 'Optional NFC chip UID/internal inventory value, e.g. 046CE30FBE2A81.';
comment on column public.tags.status is 'unassigned, claimed, disabled, replaced, testing, etc.';

-- One-time use rule is enforced by /api/tags/activate:
-- if pet_id or claimed_at is already set, the Card ID/claim code cannot be reused.
