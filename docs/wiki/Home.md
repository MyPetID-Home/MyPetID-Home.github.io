# MyPetID-Home app wiki

This folder is the source-of-truth fallback for the GitHub Wiki until the `.wiki.git` remote is initialized on GitHub.

## Current app direction

- Static Next.js app deployed through GitHub Pages now.
- Supabase handles Auth, profile/pet/tag data, and public scan reads/writes.
- NFC/QR tags should open `/scan/?tag=<tag_code>`.
- Read-only public pet profiles live at `/pet/?tag=<tag_code>`.
- Owner/admin work happens in `/dashboard/`.

## Important production boundary

GitHub Pages is static. Anything involving secrets or trusted server-side decisions belongs in Supabase Auth, Supabase Edge Functions, or a future Vercel/API backend:

- Patreon OAuth callbacks and webhooks
- Google OAuth client secret handling, if not delegated to Supabase Auth
- Stripe/payment checkout sessions or coupon sync
- admin-only tag minting and user invites
- final scan-event tier checks and anti-abuse filtering
