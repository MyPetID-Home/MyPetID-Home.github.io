# Roadmap

## Phase 1: App shell and Pages deployment — complete

- Fresh Next app.
- Logo/assets restored from the original repo.
- Full dashboard with overview, account, pet, walks, diet, documents, play, training, lost/found, Dog Pack, goals, settings, and admin areas.
- GitHub Pages static export workflow.

## Phase 2: Supabase wiring — mostly complete

- Supabase project `MyPetID-Home` created and active at ref `ryyaefxszkmibcnngnfg`.
- Core schema, RLS, storage buckets, audit/storage extension, XP/award/found-flow migration, and commerce/QR/upload migration applied.
- Email/password auth and live dashboard workspace are wired.
- Admin bypass exists for CAK3D/admin testing accounts.
- Saving pets creates live QR destination rows in `pet_qr_codes` and `account_qr_codes`.
- Remaining: finish Google OAuth provider setup/redirect verification once CAK3D completes Google-side credentials.

## Phase 3: Tag, QR, scan, and Dog Pack flows — in progress

- Admin can mint/claim physical tag codes.
- Public pet profile supports tag-code and direct pet-id URLs.
- Scan gate keeps location writes behind explicit consent.
- Dog Pack invite API creates shareable invite links.
- Remaining: production-grade invite acceptance flow, owner/trusted-device scan classification, and scan write hardening behind server-side checks.

## Phase 4: Commerce, subscriptions, and fulfillment — in progress

- Stripe products/prices configured:
  - Basic NFC Tag — `$10.00` blank NFC card + QR-code sticker.
  - ID NFC Tag Card — `$15.00` license-style NFC/QR ID card.
- `/shop/` and `/subscribe/` explain customer purchase/subscription process.
- Vercel checkout API creates Stripe Checkout sessions and Supabase `tag_orders`.
- Payment success route confirms Stripe sessions and marks paid orders.
- Patreon remains visible as a membership/support path.
- Remaining: email verification-code sending, invite acceptance/role management, final scan anti-abuse checks, and admin fulfillment dashboard polish.

## Phase 5: Uploads and Google sync — partially implemented

- Pet photos/documents upload through Vercel API to Supabase Storage.
- Private medical docs create `pet_documents` records.
- When Google is connected, photos sync to Google Photos and docs sync to Google Drive.
- Remaining: complete Google OAuth app/provider setup, verify scopes in production, add retry queue for failed syncs, and add owner file management UI.

## Phase 6: Legacy restore and production hardening — pending

- Restore useful legacy database chunks selectively, not old auth/storage internals.
- Add background jobs for webhooks, upload retry, notifications, and order fulfillment status.
- Add email verification-code flow using `mypetid@yahoo.com` for signup/verification; keep support/admin/help mailboxes separate; no automated SMS/phone PIN verification is planned.
