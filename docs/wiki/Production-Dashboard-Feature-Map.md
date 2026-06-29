# Production dashboard feature map

MyPetID is intended to be a full pet profile, activity, health, diet, distance, lost/found, Dog Pack, uploads, commerce, and care tracker — not a static landing page.

## Current dashboard modules

- Overview: scan gate QR, public profile link, care stats, weekly distance progress, level/XP, live activity map.
- Account: username, display name, email, phone, avatar URL, emergency contact, address, password-reset action note.
- Pets: editable pet identity, tag ID, species, breed, birthday, sex, weight, color, microchip, vet, photo, behavior notes.
- Walks: start/end walk, moving route icon, live distance/time, saved walk history, weekly walk goal.
- Diet: feeding plan, favorite treats, editable meal/snack logs, completion toggles.
- Medical: allergies, medications, vaccine/ID/document records, public-safe flags.
- Lost/found: lost reports, sighting location/note/status, last-scan sharing action, owner follow-up controls.
- Dog Pack: groups/messages plus live invite-link creation through Vercel API.
- Goals: weekly distance, meals/day, care tasks, XP, levels, task completion buttons.
- Settings: public-field toggles, alerts, units, privacy mode, theme, Google upload-sync connect button.
- Uploads: pet photos and medical docs upload to Supabase; Google Photos/Drive sync is attempted when connected.
- Admin: tag ID generation, profile/tag/search views, XP/award rule controls, found-report review, unrestricted CAK3D access.

## Customer commerce modules

- `/shop/` — customer-facing NFC tag purchase process and Stripe checkout entry point.
- `/subscribe/` — Stripe/Patreon membership explanation and tag selection path. Stripe monthly checkout is live for Basic/Silver/Gold/Diamond; Patreon remains pending credentials.
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
  - Dog Pack invite creation
- Supabase remains source of truth for auth, profiles, pets, tags, scans, QR records, orders, upload events, provider credentials, documents, and storage.

## Production backend still needed

Before wider live customer use, the following need more hardening:

- Stripe order fulfillment dashboard and webhook edge-case hardening.
- Patreon OAuth/webhook tier sync after credentials are available.
- Email verification-code sending from the MyPetID admin/setup email system.
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
