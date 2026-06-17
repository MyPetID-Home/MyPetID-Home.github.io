# MyPetID-Home

Fresh Clydius rebuild for the MyPetID NFC/QR pet profile and tracker app.

## What works now
- Static-export Next.js app suitable for GitHub Pages.
- Marketing/home page explaining the product.
- Demo owner dashboard with pet/tag form and QR generation.
- Demo public pet scan page at `/pet/?tag=demo-tag-001`.
- Geolocation permission flow stub for scan reporting.
- Supabase schema draft in `docs/supabase-schema.sql`.
- Product rules and Patreon tier notes in `docs/product-brief.md`.

## Local setup
```bash
pnpm install
pnpm build
```

Copy `.env.example` to `.env.local` and add browser-safe Supabase values when ready.

## Confirmed roadmap
1. Create a new Supabase project named `MyPetID-Home`.
2. Enable Supabase email/password auth and Google OAuth.
3. Create the CAK3D admin/user account with unrestricted access.
4. Apply the starter schema and tighten Row Level Security.
5. Build real account, pet, tag, scan, trusted-device, and admin-dashboard flows.
6. Restore any useful chunks from old database/storage backups.
7. Integrate Patreon membership linking and tier limits.

## Deployment
`next.config.mjs` uses `output: 'export'`, producing the static `out/` directory. GitHub Pages builds and deploys the export through `.github/workflows/deploy-pages.yml`.

## Security notes
- Never commit `.env`, service-role keys, PATs, Mongo URLs, OAuth secrets, passwords, or Supabase access tokens.
- Supabase anon keys are public by design, but RLS must enforce access.
- Patreon webhooks and private admin tasks should move to Vercel/Supabase Edge Functions later.
