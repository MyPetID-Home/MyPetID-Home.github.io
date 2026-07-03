# Production dashboard feature map

MyPetID is intended to be a full pet profile, activity, health, diet, distance, lost/found, Dog Pack, uploads, commerce, and care tracker — not a static landing page.

## Current dashboard modules

- Overview: scan gate QR, public profile link, care stats, weekly distance progress, level/XP, live activity map.
- Account: username, display name, email verification, phone, avatar URL, emergency contact, address, password-reset action note.
- Pets: editable pet identity, tag ID, species, breed, birthday, sex, weight, color, microchip, vet, photo, behavior notes.
- Walks: start/end walk, moving route icon, live distance/time, saved walk history, weekly walk goal.
- Diet: feeding plan, favorite treats, editable meal/snack logs, completion toggles.
- Medical: pet health display area for allergies, medications, vet info, vaccine status, and medical summaries. Medical should show documents that were uploaded/categorized from Docs, but it should not be the document-library entry point.
- Docs: dedicated document upload/library for vet paperwork, vaccine certificates, rabies documents, licenses, insurance, service/rescue/support documentation, IDs, images, and custom files. Docs must support categories/tags and links to the app sections where each document should appear, such as Medical, Public Profile, License, Insurance, or Admin Review.
- Lost/found: lost reports, sighting location/note/status, last-scan sharing action, owner follow-up controls.
- Dog Pack: groups/messages plus live invite-link creation through Vercel API.
- Goals: user-facing progress display only. Normal users should see achievements, XP, progress, and earned rewards, but should not manually grant XP or edit award rules.
- Settings: public-field toggles, alerts, units, privacy mode, theme, Google upload-sync connect button.
- Uploads: pet photos and document files upload to Supabase; Google Photos/Drive sync is attempted when connected. Upload records should feed Docs first, then linked sections.
- Admin: hidden/admin-only console for CAK3D with user/app/service metrics, connected-service links/status, tag/orders/fulfillment, membership/user status and coupon/grant controls, Stripe provider catalog/coupon/product/tier controls, Patreon tier metadata sync, purchase history, profile/tag/search views, XP/award rule controls, found-report review, and unrestricted CAK3D access.

## Customer commerce modules

- `/shop/` — customer-facing NFC tag purchase process and Stripe checkout entry point.
- `/subscribe/` — Stripe/Patreon membership explanation and tag selection path. Stripe monthly checkout is live for Basic/Silver/Gold/Diamond; Patreon OAuth and signed webhook verification are wired on Vercel.
- `/payment/success/` — confirms Stripe checkout sessions and updates Supabase order status on Vercel.
- `/payment/cancel/` — safe checkout cancellation page.

## Current physical tag products

| Product | Price | Use |
| --- | ---: | --- |
| Basic NFC Tag | `$10.00` | Blank NFC card with QR-code sticker for the saved public pet profile. |
| ID NFC Tag Card | `$15.00` | License-style MyPetID card with NFC tap plus printed QR fallback. |

## Production backend now used

- Vercel API routes handle provider-secret flows that GitHub Pages cannot run:
  - Stripe checkout/session confirmation and Stripe webhooks
  - Stripe monthly subscription checkout for Basic/Silver/Gold/Diamond
  - Google OAuth connect/callback for upload sync
  - Supabase-backed upload handling
  - Dog Pack invite creation with membership slot checks
  - membership summary, tag activation, Stripe Billing Portal routes, email verification-code routes, admin membership/coupon/provider routes, and admin tag-order fulfillment API
- Supabase remains source of truth for auth, profiles, pets, tags, scans, QR records, orders, upload events, provider credentials, documents, and storage.

## Achievement and XP rules

Achievements are admin-authored rules, not user-clickable XP buttons. Normal users can view progress and earned achievements, but they cannot edit achievement definitions, change point values, or manually mark achievements complete.

Required trigger model examples:

- First walk after cumulative or single-walk distance reaches 1 mile.
- Account profile completion reaches 100%.
- Dog profile completion reaches 100%.
- Required document uploaded and categorized, such as rabies certificate or license.
- Medication, meal, training, play, or walk streaks are completed from real logged events.
- Dog Pack invite accepted or helper role confirmed.
- Lost/found report resolved.
- Custom admin-defined trigger templates created later by CAK3D.

The engine should listen to real app events and stored progress, then auto-award XP once each rule is satisfied. User pages should show progress bars/cards like `0.72 / 1.00 miles` instead of buttons that grant XP directly.

## Admin account and admin dashboard direction

Normal users should not see the admin section or admin navigation. CAK3D wants a dedicated hidden admin login target for `CAK3D_ADMIN` with the configured private password handled only through auth/secrets, never hard-coded in public client code.

Admin mode should provide:

- Overview of all users, pets, tags, scans, uploads, purchases, memberships, and app metrics.
- Service health/status and quick links for Supabase, Vercel, GitHub Pages, Stripe, Patreon, Google OAuth/storage, email delivery, and future notification providers.
- Stripe and Patreon product/tier/membership controls: add, edit, delete/sync tiers, prices, coupons, products, and provider metadata.
- Purchase/order views: who bought what, when, status, fulfillment, membership source, coupon/grant source, and payment provider IDs.
- Achievement rule editor: create/edit/delete achievement rules, XP values, trigger types, thresholds, sections/categories, and visibility.
- User impersonation/switch-to-user-view for CAK3D testing without exposing admin controls to normal users.

## Production backend still needed

Before wider live customer use, the following need more hardening:

- Stripe order fulfillment queue is live in the admin dashboard; remaining work is shipping-notification automation, tracking links, and webhook edge-case hardening.
- Patreon OAuth/webhook tier sync is wired; keep monitoring real dashboard deliveries and edge cases.
- Email verification-code routes and dashboard controls are live; add/verify the Yahoo SMTP app password in private/Vercel env before real outbound delivery from `mypetid@yahoo.com`. Support/admin/help mailboxes remain separate.
- Final scan-event writes with active-tag, owner/trusted-device, abuse, and rate-limit checks.
- Invite acceptance and role/permission management for Dog Pack users.
- Push/email notification delivery.
- Upload retry queue and owner file-management UI.

## UI direction

The old floating emoji animations are being replaced with app-like, data-tied movement:

- route lines and map grid
- moving tracker icon during live walks
- progress bars tied to weekly goals and XP
- cards that update from editable state
- dashboard status feedback for every control
