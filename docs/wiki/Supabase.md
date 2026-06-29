# Supabase Notes

## Active project

- Organization: MyPetID-Home
- Project name: MyPetID-Home
- Project ref: `ryyaefxszkmibcnngnfg`
- Region: `us-east-2`
- App URL: `https://ryyaefxszkmibcnngnfg.supabase.co`
- Static frontend: `https://mypetid-home.github.io/`
- Vercel functional app: `https://mypetid.vercel.app` once deployment alias is active

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

XP/awards/found-flow tables added by `docs/migrations/2026-06-xp-awards-found-flow.sql`:

- `xp_events`
- `award_rules`
- scan/found-report follow-up columns on `scan_events`

Commerce/QR/upload/provider tables added by `docs/migrations/2026-06-commerce-qr-uploads.sql`:

- `tag_products`
- `tag_orders`
- `pet_qr_codes`
- `account_qr_codes`
- `dog_pack_invites`
- `provider_credentials`
- `upload_events`
- `membership_events`

## Current physical tag products

`tag_products` has two active public-readable products:

| slug | name | price | Stripe purpose |
| --- | --- | ---: | --- |
| `basic-nfc-tag` | Basic NFC Tag | `$10.00` | Blank NFC card plus QR-code sticker. |
| `id-nfc-tag-card` | ID NFC Tag Card | `$15.00` | License-style ID card with NFC + QR fallback. |

Prices/products are also configured in Stripe and mirrored into Vercel env for checkout.

## Stripe subscription tiers

`membership_tiers` now stores Stripe monthly product/price IDs for the paid app tiers:

| tier | price | max tags | max users | provider |
| --- | ---: | ---: | ---: | --- |
| `basic` | `$3.00/mo` | 1 | 1 | Stripe monthly subscription |
| `silver` | `$4.00/mo` | 1 | 2 | Stripe monthly subscription |
| `gold` | `$6.00/mo` | 2 | 1 | Stripe monthly subscription |
| `diamond` | `$10.00/mo` | 3 | 2 | Stripe monthly subscription |

The Vercel webhook route verifies Stripe signatures and reconciles subscription checkout, subscription status, invoice, and refund events into `membership_events`, `profiles.tier`, and `tag_orders`.

## Storage buckets

Buckets created for app media/document flows:

- `pet-photos` — public read, image uploads
- `tag-assets` — public read, QR/NFC/tag print assets
- `profile-images` — private owner/admin read
- `medical-documents` — private owner/admin read, larger PDF/image documents

Private bucket object paths should start with the owner profile UUID so RLS can match `auth.uid()` against `storage.foldername(name)[1]`.

## Upload behavior

- Pet photos upload to `pet-photos`, create an `upload_events` row, and update the selected pet photo when a pet is selected.
- Medical documents upload to `medical-documents`, create a `pet_documents` row, and create an `upload_events` row.
- If the user has active Google credentials in `provider_credentials`, Vercel API attempts Google Photos sync for pet photos and Google Drive sync for medical docs.
- Supabase remains source of truth even if Google sync fails; failures are recorded in `upload_events.google_status/google_error`.

## Admin audit/history

The live DB has `account_activity_log` and row triggers for:

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
