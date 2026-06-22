# MyPetID-Home

Fresh Clydius rebuild for the MyPetID NFC/QR pet profile and tracker app.

## What works now
- Static-export Next.js app suitable for GitHub Pages.
- Marketing/home page explaining the product.
- Demo owner dashboard with pet/tag form and QR generation.
- Real Supabase dashboard workspace for signed-in account profile edits, pet create/update, physical tag claim, trusted browser records, owner scan logging, scan history, and admin tag/profile inventory.
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
1. Fresh Supabase project `MyPetID-Home` has been created and the starter schema has been applied.
2. Enable/configure Google OAuth after Google Cloud OAuth credentials are available.
3. Admin user has been created and seeded as unrestricted admin.
4. Build real account, pet, tag, scan, trusted-device, and admin-dashboard flows. First browser-side Supabase slice is in place for account profile edits, pet create/update, physical tag claiming, trusted device registration, owner scan logging, scan history, and admin tag/profile inventory.
5. Restore useful chunks from the imported old database backup.
6. Integrate Patreon membership linking and tier limits.

## Deployment
`next.config.mjs` uses `output: 'export'`, producing the static `out/` directory. GitHub Pages builds and deploys the export through `.github/workflows/deploy-pages.yml`.

## Security notes
- Never commit `.env`, service-role keys, PATs, Mongo URLs, OAuth secrets, passwords, or Supabase access tokens.
- Supabase anon keys are public by design, but RLS must enforce access.
- Patreon webhooks and private admin tasks should move to Vercel/Supabase Edge Functions later.
