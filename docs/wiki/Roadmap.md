# Roadmap

## Phase 1: App shell and Pages deployment
- Fresh Next static-export app.
- Logo/assets restored from the original repo.
- Full app-like dashboard with tabs for overview, walks, care, documents, appointments, data, and admin.

## Phase 2: Supabase wiring
- Supabase project `MyPetID-Home` created.
- Apply schema and RLS.
- Add email/password and Google login.
- Create/admin-mark CAK3D account from env-held credentials.

## Phase 3: Tag and scan flows
- Admin creates physical tag IDs.
- Customer claims tag and links it to a pet.
- Scans open the public pet profile.
- If Patreon scan access is active, location consent can save scan events.

## Phase 4: Patreon and commerce
- OAuth/link Patreon membership.
- Tier limits: Basic/Silver/Gold/Diamond.
- Generate 15% first-tag coupon for linked members.
- Track $10 pet ID tag purchases.
