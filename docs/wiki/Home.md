# MyPetID-Home app wiki

This folder is the source-of-truth fallback for the GitHub Wiki until the `.wiki.git` remote is initialized on GitHub.

## Current app direction

- Next.js app with two deployment modes:
  - Vercel functional app host for API routes, Stripe checkout/webhooks, subscription checkout, and provider callbacks.
  - GitHub Pages static export for public/static fallback.
- Supabase handles Auth, profile/pet/tag data, QR records, orders, upload events, storage metadata, and public scan reads/writes.
- NFC/QR tags should open `/scan/?tag=<tag_code>` for consent-aware scan writes.
- Read-only public pet profiles live at `/pet/?tag=<tag_code>` and can also load by `/pet/?pet=<pet_id>` for generated QR destinations.
- Owner/admin work happens in `/dashboard/`.
- Customer purchase education and checkout entry points live at `/shop/` and `/subscribe/`.

## Current physical tag products

| Product | Price | Description |
| --- | ---: | --- |
| Basic NFC Tag | `$10.00` | Blank NFC tag card with QR-code sticker pointing at the saved public pet profile. |
| ID NFC Tag Card | `$15.00` | License-style MyPetID card with NFC tap plus printed QR fallback. |

Both physical tag products are represented in Supabase `tag_products` and Stripe price/product metadata. Monthly Basic/Silver/Gold/Diamond memberships are represented in Supabase `membership_tiers`, Stripe recurring prices, and live Patreon campaign tier IDs. Patreon OAuth and signed webhook verification are wired on Vercel.

## Purchase/fulfillment flow

1. Customer creates a MyPetID account.
2. Customer saves a dog profile.
3. App creates public pet/account QR destination records.
4. Customer selects Basic NFC Tag or ID NFC Tag Card.
5. Vercel API starts Stripe Checkout and creates a Supabase `tag_orders` row.
6. Stripe success return confirms the session and marks the order paid.
7. Admin dashboard fulfillment queue lists paid/manual-review tag orders with customer, pet, shipping, QR/NFC payload, Stripe IDs, and status controls.
8. CAK3D prints/programs the NFC tag/card with the saved pet public QR URL, packages it, marks queued/printing/shipped/delivered, and ships it.
9. Account QR/share links let trusted users join a Dog Pack.

## Important production boundary

GitHub Pages is static. Anything involving secrets or trusted server-side decisions belongs in Vercel API routes, Supabase Auth/Storage/RLS, Supabase Edge Functions, or future backend jobs:

- Stripe Checkout/session confirmation, signed webhooks, Billing Portal, membership summaries, and tier-gated tag activation
- Patreon OAuth callbacks, signed webhooks, and tier reconciliation are wired on Vercel.
- Google OAuth client secret handling and upload sync
- admin-only tag minting, fulfillment queue status changes, and user invites
- final scan-event tier checks and anti-abuse filtering
- private document upload/signing rules
