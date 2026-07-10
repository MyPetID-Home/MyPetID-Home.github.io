# MyPetID service layout and free-tier strategy

_Last audited: 2026-07-10_

This document maps what MyPetID currently stores or runs on each provider, what should move there next, and how to stay under free/low-cost limits during development.

No secret values belong in this document. Provider dashboards/Vercel/Supabase secret stores hold credentials.

## Core rule

Supabase should not carry bulky payloads or high-egress public media. Supabase is the relational/auth source of truth; Google/Cloudflare/Vercel/GitHub/Stripe/Patreon each do their native job.

- **Supabase:** auth + relational records + lightweight Google/Stripe/Patreon references.
- **Google Photos:** pet photos/photo-heavy media.
- **Google Drive/Docs:** documents, notes, attachments, printable/source files.
- **Vercel:** full-stack Next.js runtime/API routes/OAuth/webhooks/server secrets.
- **GitHub Pages:** static marketing/fallback public frontend only.
- **Cloudflare:** best candidate for public CDN/R2 assets if Google sharing/API limits make public media awkward.
- **Stripe:** payments, subscriptions, products/prices, checkout, billing portal, webhooks.
- **Patreon:** creator membership verification/sync, not primary app entitlement database.

## Current provider state verified

### Supabase — current state

Project ref from config: `ryyaefxszkmibcnngnfg`.

Live status as of audit:

- Auth health: HTTP 402 restricted.
- REST/table queries: HTTP 402 restricted.
- Storage bucket listing: HTTP 402 restricted.
- Error: `exceed_egress_quota`.

Committed schema/migrations show Supabase currently owns or is intended to own:

- `profiles` — app profiles, email, tier, admin flag, linked-provider flags.
- `pets` — pet identity/profile text, public contact JSON, `photo_url`, `documents` JSON.
- `tags` — tag/card code relationship to pet/profile.
- `devices` / trusted devices.
- `scan_events` — finder/owner scans, location consent output, lost/found notes.
- `verification_requests` — Google/Patreon/email/manual verification workflow.
- `calendar_events` — care/reminder events with optional `google_event_id`.
- `profile_links` / dog-pack relationship rows.
- `tag_products`, `tag_orders` — NFC/card products/orders/fulfillment.
- `pet_qr_codes`, `account_qr_codes`, `dog_pack_invites`.
- `provider_credentials` — OAuth token records per profile/provider.
- `upload_events` — upload metadata, bucket path, Google sync status/resource id.
- `membership_events`, `membership_tiers`, `membership_grants`, `access_coupons`.
- `email_verification_codes`.
- `account_activity_log`, admin debug/audit view.
- Card activation-code migrations for one-time card claim codes.
- XP/achievement migrations for admin-defined awards.

Current Supabase Storage design in committed migration creates buckets:

- `pet-photos` public, 10 MB/object.
- `profile-images` private, 10 MB/object.
- `medical-documents` private, 50 MB/object.
- `tag-assets` public, 10 MB/object.

Current upload API behavior (`app/api/uploads/route.ts`) is not aligned with the desired architecture yet:

1. Uploads file bytes to Supabase Storage first.
2. Updates Supabase row metadata.
3. Then tries to sync to Google Photos/Drive if a Google refresh token exists.

That should be inverted/changed:

1. Upload heavy payload to Google Photos/Drive/Docs/R2 first.
2. Store only lightweight metadata and provider object IDs/URLs in Supabase.
3. Use Supabase Storage only for tiny generated thumbnails/cache/QR/tag assets when necessary.

Free-tier risk:

- Supabase Free includes 5 GB egress, 5 GB cached egress, 1 GB file storage, 500 MB DB, 50,000 MAU.
- Public Supabase Storage pet photos can consume 5 GB quickly.
- Example: 1,000 views of a 5 MB pet photo = about 5 GB egress.

Recommended Supabase budget target during development:

- DB: under 250 MB.
- Storage: ideally near zero; max small thumbnails only.
- Egress: under 3 GB/month warning, under 4 GB/month emergency action.
- Public scan route payload: under ~50 KB JSON before media thumbnails.

### Vercel — current state

Current Vercel project is linked and deployed:

- Team ID present in private env.
- Project ID present in private env.
- Project name/slug in memory: `mypetid` under team `my-pet-id`.
- Latest full-stack deployments are READY.

Vercel env keys currently present include:

- Supabase public/private keys: `NEXT_PUBLIC_SUPABASE_URL`, publishable/anon keys, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_JWKS_URL`.
- Google OAuth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
- Stripe: public price IDs, publishable key, secret/restricted keys, webhook secret/endpoint.
- Patreon: client ID/secret, creator access/refresh token, webhook secret, API version.
- Email: Yahoo SMTP host/user/password/port/from plus email verification secret.
- Admin/public settings: admin emails, app base URL, coupon secret.

Temporary `GOOGLE_FALLBACK_*` env vars were removed.

Current free/Hobby limits observed from Vercel pricing page:

- Fast data transfer: 100 GB/month included on Hobby.
- Edge requests: 1M/month included on Hobby.
- Blob storage: 1 GB/month included; Blob transfer 10 GB/month included.
- Image transformations: 5K/month included.
- Avoid putting heavy public media on Vercel Blob on Hobby unless small; R2 is better for public binary assets.

Recommended Vercel role:

- OAuth callbacks and token exchange.
- Stripe checkout/webhooks/billing portal.
- Patreon OAuth/webhooks/sync routes.
- Google Photos/Drive/Docs server-side calls.
- Supabase secret-key admin routes.
- API orchestration and lightweight transforms.
- Do not use Vercel as primary media storage/CDN for pet photos.

### GitHub / GitHub Pages — current state

Repo: `MyPetID-Home/MyPetID-Home.github.io`.

Verified:

- Public repo.
- Push/admin permissions available to maintainer token.
- GitHub Pages built and enabled at `https://mypetid-home.github.io/`.
- Actions variables: `NEXT_PUBLIC_ADMIN_EMAILS`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL`.
- Actions secrets include Google/Yahoo/Patreon-related legacy keys and other older secrets; they should be reviewed/cleaned separately.

GitHub Pages limits from docs:

- Published site max size: 1 GB.
- Soft bandwidth limit: 100 GB/month.
- Soft build limit: 10 builds/hour unless custom Actions workflow.
- Not meant for sensitive transactions or SaaS/payment processing.

Recommended GitHub role:

- Source control, issues, docs, migrations, architecture notes.
- GitHub Pages static marketing/demo/fallback frontend.
- Never secret-bearing runtime, webhooks, payments, Google token exchange, or private admin APIs.
- Keep repo under 1 GB and avoid committing generated media/uploads.

### Google — current state

Private env has Google OAuth client ID/secret. The saved OAuth client JSON indicates current authorized redirect URI historically included Supabase Auth callback; the Vercel callback had to be added manually for app OAuth flows.

Committed schema supports flags:

- `google_photos_linked`
- `google_drive_linked`
- `google_calendar_linked`
- `provider_credentials` for Google tokens
- `upload_events.google_status/google_resource_id`
- `calendar_events.google_event_id`

Current upload API attempts:

- `pet_photo` image uploads to Google Photos API after Supabase Storage upload.
- Non-photo uploads to Google Drive after Supabase Storage upload.

Desired Google role:

- Google Photos: original/full pet photos, albums where possible, owner media library.
- Google Drive: documents, medical PDFs/images, notes exports, tag design files, printable card assets, backups.
- Google Docs: editable pet notes/care documents where native Docs collaboration is useful.
- Google Calendar: reminders/care appointments; Supabase stores lightweight event refs.

Google free storage:

- Standard Google account includes 15 GB shared across Gmail, Drive, Photos.
- Google One Basic 100 GB is low-cost if needed, but free-tier target is to remain below 15 GB.

Important caveats:

- Google Photos API is not identical to Drive folders/public static hosting. Verify album/sharing/public-access behavior before relying on it for public scan pages.
- Public scan pages may need a thumbnail proxy/cache or Cloudflare R2 copy if Google Photos direct URLs are unstable or not publicly appropriate.
- Google OAuth/token exchange must stay on Vercel/server routes.

Recommended Google budget controls:

- Resize/compress uploads before Google Photos when user chooses app-optimized copies.
- Keep originals if user wants, but track storage usage and surface warnings.
- Store only Google IDs/base URLs/metadata in Supabase.
- For public pages, store a small thumbnail variant separately, preferably R2 or generated lightweight cached URL.

### Cloudflare — current state

No Cloudflare env/config was found in current MyPetID repo or private env. Cloudflare is not currently wired.

Cloudflare Pages Free limits from docs:

- 500 builds/month.
- 100 custom domains per Pages project.
- 20,000 files/site on Free.
- 25 MiB max single Pages asset.

Cloudflare R2 Free limits from docs:

- 10 GB-month storage/month.
- 1M Class A operations/month.
- 10M Class B operations/month.
- Internet egress from R2 is free.

Recommended Cloudflare role if added:

- R2 bucket for public thumbnails, generated QR images, printable tag assets, app-safe public media cache.
- Optional custom domain like `media.mypetid...` later.
- Avoid moving private source-of-truth docs here if Google Drive/Docs is the user-facing editing/storage experience.
- Best fit: public, cacheable, app-generated derivatives that should not burn Supabase/Vercel egress.

Free-tier strategy:

- Use R2 Standard only.
- Keep public thumbnail sizes small: e.g. 256–512 px WebP.
- Avoid per-page list operations; store public object URLs in Supabase metadata.
- Class B reads are generous but not infinite; cache via CDN headers.

### Stripe — current state

Stripe API verified with configured test key. Live mode is false/test mode.

Products present:

- MyPetID Basic Membership.
- MyPetID Silver Membership.
- MyPetID Gold Membership.
- MyPetID Diamond Membership.
- MyPetID Basic NFC Tag.
- MyPetID ID NFC Tag Card.

Prices present:

- Basic membership: $3/month.
- Silver membership: $4/month.
- Gold membership: $6/month.
- Diamond membership: $10/month.
- Basic NFC tag: $10 one-time.
- ID NFC tag card: $15 one-time.

Webhook endpoint present:

- `https://mypetid.vercel.app/api/stripe/webhook/`
- Enabled, test mode.

Coupons/promotion codes:

- None currently present in Stripe test account.
- App has Supabase `access_coupons`; future Stripe promo sync can be added server-side if needed.

Stripe standard pricing:

- No monthly fee for standard payments.
- Domestic cards listed as 2.9% + 30¢ per successful transaction.
- Costs occur when real payments process, not from storing product metadata.

Recommended Stripe role:

- Paid checkout and subscriptions.
- Billing portal.
- Payment webhooks to update Supabase membership state.
- Products/prices/coupons/promo codes managed by admin API or Stripe Dashboard.
- Do not store cards or payment info in Supabase.

Free-tier strategy:

- Stay in test mode until launch.
- Keep metadata small.
- Stripe costs are transaction-based; no free-tier storage/egress risk like Supabase.

### Patreon — current state

Private env has Patreon app/client/webhook/creator-token keys, but live API calls returned 401 Unauthorized during this audit. Tokens likely expired or need refresh before creator/tier inventory can be trusted.

Committed app support includes:

- Patreon OAuth start/callback routes.
- Patreon webhook route.
- Patreon tier migration/docs.
- Provider credential and verification workflows.
- Account/profile private provider status and public tier-only display guidance.

Recommended Patreon role:

- Optional membership verification/source.
- Creator supporters can link Patreon account.
- Patreon tier sync should update app-owned Supabase entitlements, not become the app's only permission source.
- Admin grants/coupons can mirror Patreon comps where Patreon cannot provide app-native coupons.

Free-tier/cost note:

- Patreon is not a storage/egress provider for MyPetID.
- Main cost is Patreon platform/payment fees on creator revenue; verify current creator plan in Patreon dashboard because public pricing page blocked automated access in this audit.

### Yahoo SMTP / email — current state

Vercel has Yahoo SMTP env for `mypetid@yahoo.com` sender and email verification routes.

Recommended role:

- Signup/email verification codes.
- Account notices.
- Low-volume admin emails during development.

Free-tier risk:

- Yahoo app-password SMTP is okay for testing, but not ideal for production volume/deliverability.
- For launch, move to a transactional provider such as Resend, SendGrid, Postmark, Mailgun, or AWS SES with clear free/low-cost quota.

## Recommended target architecture

### Database / auth source of truth

Supabase stores:

- User identity/profile/tier/admin.
- Pets: text profile, owner, service/lost status, public-contact settings.
- Tags/cards: IDs, claim codes, activation state, linked pet.
- Trusted devices and dog-pack access.
- Scan/lost/found events: text, location coordinates only after consent, status.
- Membership/tier/grants/coupons/order/payment references.
- Provider credential metadata/token rows only where needed server-side.
- Google asset references: `google_photo_id`, `google_album_id`, `drive_file_id`, `drive_folder_id`, `docs_document_id`, thumbnail URL, mime/size/hash.
- Audit rows and small metadata.

Supabase should not store:

- Original pet photos.
- Medical PDFs/images.
- Long notes/documents.
- Printable card source images/PDFs.
- Publicly served large images.

### Media/docs storage

Google Photos:

- Pet original photos and albums.
- Owner-facing photo gallery.
- Source record: Supabase `pet_media` table should store Google media item ID, album ID, dimensions, created time, owner/profile/pet refs.

Google Drive/Docs:

- Medical/vet documents.
- Vaccination PDFs/images.
- Notes and long-form care instructions.
- Printable/admin fulfillment files.
- Source record: Supabase `pet_documents`/`pet_notes` table stores Drive file ID / Docs ID, mime, title, owner/pet refs, visibility flags.

Cloudflare R2, optional but strongly useful:

- Public thumbnails for scan pages.
- QR/print/tag generated assets.
- Small public copies that must load fast without Google auth and without Supabase egress.

### Public scan page loading budget

For `/scan` and public pet pages:

1. Query Supabase only for tag, pet public profile, lost status, contact policy, and thumbnail refs.
2. Do not fetch original photo/doc lists by default.
3. Load a tiny public thumbnail from R2 or an optimized Google-derived URL.
4. Location collection only after explicit finder consent.
5. Insert one scan/lost-found row; avoid broad admin reads from public routes.

### Upload flow redesign

Current: browser -> Vercel API -> Supabase Storage -> Google sync -> Supabase metadata.

Target:

1. Browser -> Vercel API with auth bearer.
2. Vercel validates profile/pet permission via Supabase lightweight row check.
3. Vercel uploads original to Google Photos/Drive/Docs.
4. Vercel optionally creates/resizes a small public thumbnail and uploads it to R2 or tiny Supabase Storage cache.
5. Vercel writes Supabase metadata row with provider IDs/URLs/sizes.
6. Public pages read only metadata and thumbnail URL.

### Tables to add/adjust

Add or evolve:

- `pet_media`: pet/profile refs, provider (`google_photos`, `drive`, `r2`), provider media ID, album ID, thumbnail URL, mime, width/height, bytes, visibility, sort order.
- `pet_documents`: currently referenced in migrations; ensure it stores Drive/Docs IDs instead of Supabase storage path as primary.
- `pet_notes`: docs-backed notes, Google Docs ID, summary excerpt, visibility.
- `asset_derivatives`: links original Google asset to R2 thumbnails/preview PDFs.
- `provider_connections`: optional normalized provider status separate from raw `provider_credentials`.

Deprecate or minimize:

- `pets.photo_url` as Supabase public URL. Replace with thumbnail/reference field.
- `pets.documents` JSON for real docs. Keep only cached summary or migrate to rows.
- Supabase Storage buckets for originals.

## Provider-by-provider “what else can we add free/cheap?”

### Supabase

Safe additions:

- More relational tables and indexes.
- RLS policies/functions.
- Lightweight event/audit records.
- Provider reference metadata.
- Small thumbnails only if absolutely necessary.

Avoid:

- Public large media.
- Broad `select('*')` admin pages loading all rows frequently.
- Realtime/polling unless necessary.
- Large JSON blobs/documents.

### Google

Safe additions within 15 GB free account storage:

- Pet photo albums.
- Drive folder per user/pet.
- Docs for editable notes and care sheets.
- Calendar reminders.
- Sheets only for admin exports/reports, not app database.

Avoid:

- Treating Google Sheets as the operational DB.
- Depending on Google Photos URLs as stable unauthenticated CDN without testing.

### Cloudflare

Safe additions if we create an account/R2 bucket:

- Public media derivatives.
- QR/static generated assets.
- CDN in front of public asset domain.
- Potential Pages static mirror if desired.

Avoid:

- Private medical documents unless access control is designed.
- Many uncached per-object reads beyond 10M/month free Class B.

### Vercel

Safe additions:

- API routes for provider orchestration.
- Webhooks.
- OAuth callbacks.
- Admin server routes.
- Small server-rendered/admin pages.

Avoid:

- Large file proxying on every request.
- Using Vercel Blob for everything on Hobby.
- Heavy image transformations beyond 5K/month.

### GitHub

Safe additions:

- Docs/wiki/migrations/code.
- Static GitHub Pages frontend under 1 GB.
- Actions-based static deploys.

Avoid:

- Secrets in repo/docs/issues.
- Large media binaries.
- Commercial sensitive transactions on Pages.

### Stripe

Safe additions:

- Products/prices for memberships and tag/card purchases.
- Coupons/promotion codes via server API.
- Billing portal.
- Checkout/customer portal webhooks.

Avoid:

- Storing payment data outside Stripe.
- Treating Stripe as app membership source without mirrored Supabase entitlement rows.

### Patreon

Safe additions after token refresh:

- Tier sync.
- Webhook reconciliation.
- Patron-only grants/coupons in app.

Avoid:

- Relying on Patreon alone for app permissions.
- Storing private Patreon account details publicly.

## Current execution focus

CAK3D's current direction is to hold off on Supabase changes until the quota restriction is handled, skip Cloudflare for now, and park Patreon until later. The non-Supabase pieces to situate now are Google, Vercel, Stripe, GitHub, and email.

Completed/staged in this pass:

1. Added a reusable server-side Google service layer for future Photos, Drive, Docs, and Calendar operations.
2. Expanded Google OAuth scopes to cover:
   - Drive file writes,
   - Docs document creation,
   - Calendar event creation,
   - Google Photos append-only uploads.
3. Added `/api/google/status/`, a Supabase-free readiness endpoint that reports Google env/scopes/redirect configuration without exposing secrets.

Deferred until Supabase is back/approved:

1. Supabase metadata migrations for Google asset references.
2. Upload-route rewrite that stores originals in Google first and Supabase references second.
3. Public scan/profile page changes that rely on new metadata rows.

Deferred until later by request:

1. Cloudflare R2 public thumbnail/cache integration.
2. Patreon reconnect/tier sync.
3. GitHub Actions stale-secret cleanup, unless explicitly requested.

## Later implementation plan

1. Add metadata tables for Google Photos/Drive/Docs references.
2. Disable or rewrite upload flow so originals no longer go to Supabase Storage first.
3. Build `POST /api/media/upload` for photos -> Google Photos + metadata.
4. Build `POST /api/documents/upload` for files -> Google Drive/Docs + metadata.
5. Change public scan/profile pages to use thumbnail/reference metadata, not Supabase Storage originals.
6. Add optional Cloudflare R2 integration for public thumbnails/QR/tag assets.
7. Add provider quota/status admin panel:
   - Supabase health + egress warning where API allows.
   - Google connected/storage estimate fields.
   - R2 object count/usage if added.
   - Vercel deployment/API health.
   - Stripe webhook status/test mode.
   - Patreon token freshness.

## Notes from audit blockers

- Supabase live table/storage counts could not be retrieved because the project is currently restricted by egress quota.
- Direct Postgres from this VM tried IPv6 and failed; REST also returns 402, so committed migrations are the source for schema layout until Supabase is restored.
- Patreon creator token returned 401; refresh or reconnect before using live Patreon data.
- Cloudflare is not currently wired for this repo.
- Stripe is wired in test mode and products/prices/webhook endpoint are present.
