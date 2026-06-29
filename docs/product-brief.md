# MyPetID-Home product brief

## Core idea
A pet owner logs in, creates an account profile, creates one or more pet profiles, links a CAK3D-created NFC/QR tag ID to a pet, and controls the public page shown when the tag is scanned.

## Confirmed auth direction
- Supabase is the preferred backend.
- The old Supabase project was inactive for more than 90 days and could not be restored through the Management API.
- A fresh Supabase project named `MyPetID-Home` has been created in the existing `MyPetID-Home` organization.
- The starter schema and app extension schema have been applied to the new project.
- Login supports email/password now.
- Google OAuth is planned but still needs Google Cloud OAuth client credentials; Patreon API credentials are not Google OAuth credentials.
- The CAK3D admin email is stored in Clydius profile env and should not be committed publicly.
- The admin account is both an unrestricted admin/tester account and a normal real user account.
- Never commit passwords, Supabase access tokens, service-role/secret keys, OAuth secrets, PATs, or database URLs.

## Confirmed business rules
- A free account can create one user profile and one pet profile.
- Physical Pet ID tags cost $10 and one tag is required per pet for scanning/tracking.
- Location scanning/tracking is subscription-gated. Accounts can subscribe through Stripe monthly memberships or, later, link Patreon membership once Patreon credentials/webhooks are finished.
- Patreon-linked users should show Patreon status on the user profile when Patreon sync is finished.
- Stripe subscription users should show Stripe membership status on the user profile and receive the same tier limits as the matching Patreon tier.
- Patreon members get updates/tutorials/support and a 15% coupon for the first Pet ID tag purchase.
- Admin accounts bypass all tier limits for active testing.

## Patreon API
- Patreon app name: `MyPetID`.
- API version: `2`.
- Client ID/secret and creator access/refresh tokens are stored in Clydius profile env only.
- Patreon linking should be handled by a server-side function later; never expose Patreon client secret or creator tokens in the static Pages app.

## Patreon tiers
| Tier | Price | NFC tag/pet allowance | User profile allowance | Notes |
| --- | ---: | --- | --- | --- |
| Free app account | $0 | 0 active scan-enabled tags | 1 user + 1 pet profile | Location scanning disabled until subscription/tag activation. |
| Basic Membership | $3/month | 1 NFC tag | 1 user account | Stripe monthly subscription now; Patreon equivalent later. |
| Silver Membership | $4/month | 1 NFC tag | 2 user accounts | Stripe monthly subscription now; Patreon equivalent later. |
| Gold Membership | $6/month | 2 NFC tags | 1 user account | Stripe monthly subscription now; Patreon equivalent later. |
| Diamond Membership | $10/month | Either 2 NFC tags + 2 users, or 3 NFC tags + 1 user | See tag allowance | Stripe monthly subscription now; Patreon equivalent later. |
| Admin | internal | Unlimited | Unlimited | CAK3D testing/management bypass. |

## Key flows
1. Owner signs up with Supabase Auth via email/password now, Google later.
2. Owner creates profile/contact preferences.
3. Owner creates pet profile with public-safe medical, behavior, and return-home info.
4. Admin/CAK3D creates physical tag IDs and enters tag codes into the admin dashboard/database.
5. Owner claims a tag code and assigns it to a pet.
6. Stranger scans NFC/QR, is prompted to open the app/public scan page, and can view the owner-selected public fields.
7. Each scan should request consent for app/location use. If allowed and subscription/tag activation permits it, save the scan location.
8. Owner or trusted device scans tag and should be routed/offered dashboard controls for that pet.
9. Users link profiles by QR handshake; both sides accept before scan/walk visibility is shared.
10. Linked users can see useful scan/walk/lost-pet events for pets they are connected with.

## Public scan display rules
The owner should choose which fields are visible on a scanned pet page. Candidate public fields:
- pet name, photo, breed/species
- friendly/behavior notes
- medical/emergency notes selected by owner
- owner-approved contact methods
- lost-mode status
- last eligible scan location/map

## Device detection direction
Use multiple practical browser-safe options:
- authenticated owner session first
- trusted device record after consent/login
- browser-generated device fingerprint/installation ID saved to Supabase
- later: passkeys/WebAuthn or PWA install registration for stronger trust

## Current technical direction
- Next.js static export deployed by GitHub Pages now.
- Supabase Auth/database/storage next.
- Vercel or Supabase Edge Functions later for Patreon callbacks/webhooks, Google OAuth secrets, coupon generation, and private admin APIs.

## NFC scan routing decision
The NFC/QR tag should point to `/scan/?tag=<tag_code>`, not directly to `/pet/?tag=<tag_code>`.

- `/scan/` is the consent gate. It mimics the public profile visually, but does not save location on page load. It only attempts GPS after the finder taps an explicit consent button and the browser grants permission.
- `/pet/` is the read-only public profile. It can show the previous eligible scan/map and owner-approved public details, but must not write scan GPS.
- Owner dashboard preview links should expose both routes: scan-gate URL for tags and read-only public URL for checking public content.
- Production hardening should move scan writes into a Supabase Edge Function so Patreon tier checks, tag activation, bot/rate limits, trusted-device owner detection, and abuse filtering happen server-side.

## Google Cloud OAuth settings
Use the production GitHub Pages origin plus local dev origins while the app is still static-exported.

Google OAuth Client ID supplied by CAK3D:
- `126805153488-mgmkt24vqgtuoc2f7191o6o0sm4ido7b.apps.googleusercontent.com`

Still needed before Supabase Google login can be fully enabled:
- Google OAuth client secret. The JSON download is convenient but not required; Google Cloud Console can show/copy the client secret from the OAuth client details page.

Authorized JavaScript origins:
- `https://mypetid-home.github.io`
- `http://localhost:3000`
- `http://127.0.0.1:3000`

Authorized redirect URIs for Supabase Auth Google provider:
- `https://ryyaefxszkmibcnngnfg.supabase.co/auth/v1/callback`
- Keep app post-login redirects in Supabase URL settings / client calls:
  - `https://mypetid-home.github.io/dashboard/`
  - `http://localhost:3000/dashboard/`

Do not use the static GitHub Pages app as the Google OAuth secret callback; Google client secret handling belongs in Supabase Auth or a future server/Edge Function.

## Production feature direction
The dashboard is evolving into a full pet profile + activity + health tracker, not a brochure/demo. Core production modules:
- editable account identity: username, display name, email, phone, avatar, emergency contact, password reset via Supabase Auth
- editable pet profiles: tag ID, species, breed, birthday, weight, markings, microchip, vet, photo, behavior, public fields
- live walk tracker: start/end walk, moving map tracker, distance timer, weekly distance goal, saved walk history
- diet tracker: feeding plan, meal/snack logs, calories/amounts, completion toggles
- medical record keeper: vaccines, microchip, allergies, medications, public-safe flags, dates, notes
- lost/found center: lost reports, sighting notes, last scan sharing, public return-home info
- goals/levels: XP, levels, weekly distance goals, meals-per-day goals, care-task streaks
- settings/privacy: public field toggles, alert toggles, units, privacy mode, theme

Static GitHub Pages can provide the interactive UI and browser-side Supabase calls. Final production trust boundaries still need Supabase Edge Functions or a server backend for scan validation, Patreon sync, trusted-device decisions, and admin-only actions.

## Legacy material to mine
Existing repos contain useful pieces from earlier experiments:
- static JSON models for dogs/users/devices/locations/patreon
- NFC tag ID matching
- Google Maps iframe location display
- GitHub Actions location/update flows
- Mongo/Auth0 prototypes
- Patreon sync sketches

Imported backup files on the VM:
- `/home/ubuntu/workspaces/mypetid/imports/db_cluster-29-09-2025.backup.gz`
- `/home/ubuntu/workspaces/mypetid/imports/bzfmluscikipkwaiophn.storage.zip`
