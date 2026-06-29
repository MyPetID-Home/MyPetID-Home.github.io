# MyPetID-Home

Clydius-maintained rebuild for the MyPetID NFC/QR pet profile, tracker, Dog Pack, and customer tag-purchase app.

## What works now

- Dual-host Next.js app:
  - **Vercel mode** keeps server API routes for Stripe checkout, checkout confirmation, Google upload sync, uploads, and Dog Pack invite creation.
  - **GitHub Pages mode** uses `BUILD_STATIC_EXPORT=1` and deploys a static export through `.github/workflows/deploy-pages.yml`.
- Marketing/home page explaining the MyPetID product and linking customers to `/shop/`.
- `/shop/` and `/subscribe/` explain the purchase/subscription process and show the two physical tag products:
  - **Basic NFC Tag** — `$10.00`, blank NFC card plus QR-code sticker.
  - **ID NFC Tag Card** — `$15.00`, license-style ID card with NFC + QR-code camera fallback.
- Stripe products/prices are created and saved in Supabase `tag_products`; Vercel API checkout creates `tag_orders` and returns secure Stripe Checkout sessions.
- Stripe monthly memberships are created for Basic/Silver/Gold/Diamond and mirrored in Supabase `membership_tiers`.
- Stripe webhook endpoint reconciles Checkout, subscription, invoice, and refund events into Supabase orders/membership records.
- Payment success page confirms the Stripe Checkout session and marks matching Supabase orders paid when running on Vercel.
- Supabase Auth and dashboard workspace for signed-in account profile edits, pet create/update, physical tag claim, trusted browser records, owner scan logging, scan history, and admin tag/profile inventory.
- Saving a dog profile creates QR destination records for:
  - the public pet profile (`pet_qr_codes`), and
  - account/Dog Pack sharing (`account_qr_codes`).
- Public profile supports `/pet/?tag=<tag_code>` and `/pet/?pet=<pet_id>`.
- Customer upload controls send pet photos/documents to Supabase Storage; when Google is connected on Vercel, pet photos sync to Google Photos and documents sync to Google Drive.
- Dog Pack invite API creates shareable invite links.
- Demo public pet scan page at `/pet/?tag=demo-tag-001` and scan consent gate at `/scan/?tag=demo-tag-001`.
- Supabase migration for commerce/QR/uploads/provider credentials: `docs/migrations/2026-06-commerce-qr-uploads.sql`.

## Local setup

```bash
pnpm install
pnpm build                  # Vercel/server API mode
BUILD_STATIC_EXPORT=1 pnpm build  # GitHub Pages/static mode; app/api must be absent or moved for static export
```

Copy `.env.example` to `.env.local` and add only browser-safe public values locally. Private provider secrets belong in deployment/profile env stores, never in the repo.

## Deployment

- Vercel project `mypetid` is the functional app host for server routes and provider callbacks.
- GitHub Pages remains a static export fallback/marketing host.
- `.github/workflows/deploy-pages.yml` temporarily moves `app/api` during the GitHub Pages static build and restores it afterward.

## Provider status

- **Supabase:** live project `ryyaefxszkmibcnngnfg` is source of truth for auth/data/storage.
- **Stripe:** Basic NFC Tag and ID NFC Tag Card products/prices are configured; Basic/Silver/Gold/Diamond monthly subscription prices are configured; checkout/session confirmation/webhook APIs are implemented for Vercel.
- **Patreon:** OAuth link/callback is wired with private Patreon credentials; live campaign tier IDs are mirrored into Supabase. Webhook route exists and will verify signatures once `PATREON_WEBHOOK_SECRET` is added from the Patreon app dashboard.
- **Google:** upload-sync API and OAuth callback routes are in place, but CAK3D is still finishing Google OAuth/provider setup; do not treat Google login/sync as fully production verified until credentials/redirects are completed.
- **Email verification:** MyPetID will use email verification codes/links from the MyPetID admin/setup email system. Automated SMS/phone PIN verification is not planned.

## Security notes

- Never commit `.env`, service-role keys, PATs, Stripe keys, Patreon tokens, Google OAuth secrets, Mongo URLs, passwords, or Supabase access tokens.
- Supabase anon/publishable keys are public by design, but RLS must enforce access.
- Admin/CAK3D accounts should retain unrestricted app access for testing independent of future subscription limits.
