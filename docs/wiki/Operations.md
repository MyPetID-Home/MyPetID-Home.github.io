# Operations

## Secrets

Secrets live in `/home/ubuntu/.hermes/profiles/clydius/.env` and deployment provider env stores; do not commit them. Rotate any token/password pasted into chat after setup.

Never commit:

- GitHub PATs
- Vercel tokens
- Supabase service/secret keys
- Stripe secret/restricted keys
- Patreon access/refresh/client secrets
- Google OAuth client secrets
- passwords or raw access tokens

## Build verification

Vercel/API mode:

```bash
pnpm install
pnpm build
```

GitHub Pages/static mode:

```bash
# API routes cannot be included in Next static export.
# The GitHub Actions workflow temporarily moves app/api away and restores it.
BUILD_STATIC_EXPORT=1 pnpm build
```

If verifying static export manually, copy to a temporary directory and remove `app/api` only in the copy.

## Deployment lanes

- **Vercel**: functional app host for API routes (`/api/checkout`, `/api/uploads`, `/api/account/membership`, `/api/tags/activate`, `/api/subscriptions/portal`, `/api/google/oauth/*`, Dog Pack invite creation) and webhooks/jobs.
- **GitHub Pages**: static export host for public/static fallback pages.

`next.config.mjs` only sets `output: 'export'` when `BUILD_STATIC_EXPORT=1`.

## Provider operations

- Stripe product/price IDs are stored privately in env and mirrored in Supabase `tag_products` / `membership_tiers`.
- Stripe webhook secret and endpoint ID are stored privately in env/Vercel; webhook route verifies Stripe signatures before updating Supabase. Patreon webhook secret is also stored privately and live signed webhook verification has passed.
- Patreon credentials are stored privately; OAuth link/callback and signed webhook verification are wired through Vercel API routes.
- Google OAuth/upload sync routes are implemented but require Google-side OAuth/redirect completion before production verification.
- Supabase Storage is authoritative for uploaded pet photos and documents; Google sync is a secondary copy.

## Wiki use

Keep architecture, schema notes, recovery steps, and product decisions here so the repo remains clean and the app README stays user-facing.
