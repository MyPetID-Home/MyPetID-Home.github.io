# Supabase Notes

## Active project

- Organization: MyPetID-Home
- Project name: MyPetID-Home
- Project ref: `ryyaefxszkmibcnngnfg`
- Region: `us-east-2`
- App URL: `https://ryyaefxszkmibcnngnfg.supabase.co`
- Public frontend: `https://mypetid-home.github.io/`

Older/import refs may appear in historical backups, but current MyPetID app operations should target `ryyaefxszkmibcnngnfg` only.

## Current live tables

Core app tables:

- `profiles`
- `pets`
- `tags`
- `devices`
- `scan_events`
- `profile_links`
- `pet_care_events`
- `pet_documents`
- `membership_tiers`

Verification/calendar/admin-debug tables added by `docs/migrations/2026-06-admin-audit-storage.sql`:

- `verification_requests`
- `calendar_events`
- `account_activity_log`
- `admin_account_debug_view`

## Storage buckets

Buckets created for app media/document flows:

- `pet-photos` — public read, image uploads
- `tag-assets` — public read, QR/NFC/tag print assets
- `profile-images` — private owner/admin read
- `medical-documents` — private owner/admin read, larger PDF/image documents

Private bucket object paths should start with the owner profile UUID so RLS can match `auth.uid()` against `storage.foldername(name)[1]`.

## Admin audit/history

The live DB now has `account_activity_log` and row triggers for:

- `profiles`
- `pets`
- `tags`
- `devices`
- `scan_events`
- `profile_links`
- `pet_care_events`
- `pet_documents`
- `verification_requests`
- `calendar_events`

The audit table records insert/update/delete events with actor, target profile, target pet, changed fields, before/after JSON, and timestamp. This starts tracking from the migration forward; it does not reconstruct pre-migration edits.

`admin_account_debug_view` aggregates account-related counts so an unrestricted admin can quickly find an account and see related pets, tags, scans, documents, care events, calendar events, verification requests, and last activity.

## Backups and rollback

Before the audit/storage migration, a catalog snapshot was written outside the repo under:

- `/home/ubuntu/workspaces/mypetid/backups/`

A full `pg_dump` was not possible from this VM because the installed `pg_dump` is older than Supabase Postgres 17, so the rollback snapshot is a SQL/catalog snapshot plus the idempotent migration file.

Historical imports kept for reference:

- `/home/ubuntu/workspaces/mypetid/imports/db_cluster-29-09-2025.backup.gz`
- `/home/ubuntu/workspaces/mypetid/imports/bzfmluscikipkwaiophn.storage.zip`

The old database backup contains useful public tables such as users, pets, NFC tags, pet locations, scan records, found pet reports, profile views, admin users, notifications, user settings, social links, device logins, and system health. Restore selectively; do not blindly import old auth/storage internals.
