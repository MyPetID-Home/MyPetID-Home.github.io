# MyPetID-Home product brief

## Core idea
A pet owner logs in, creates an account profile, creates one or more pet profiles, links a CAK3D-created NFC/QR tag ID to a pet, and controls the public page shown when the tag is scanned.

## Confirmed auth direction
- Supabase is the preferred backend.
- The old Supabase project was removed, so create a fresh Supabase project named `MyPetID-Home` if available.
- Login should support email/password and Google OAuth.
- The CAK3D admin email is stored in Clydius profile env and should not be committed publicly.
- The admin account is both an unrestricted admin/tester account and a normal real user account.
- Never commit passwords, Supabase access tokens, service-role keys, OAuth secrets, PATs, or database URLs.

## Confirmed business rules
- A free account can create one user profile and one pet profile.
- Physical Pet ID tags cost $10 and one tag is required per pet for scanning/tracking.
- Location scanning/tracking is subscription-gated. Accounts without a linked Patreon subscription can have profiles but location scanning remains disabled until activated.
- Patreon-linked users should show Patreon status on the user profile.
- Patreon members get updates/tutorials/support and a 15% coupon for the first Pet ID tag purchase.
- Admin accounts bypass all tier limits for active testing.

## Patreon tiers
| Tier | Price | NFC tag/pet allowance | User profile allowance | Notes |
| --- | ---: | --- | --- | --- |
| Free app account | $0 | 0 active scan-enabled tags | 1 user + 1 pet profile | Location scanning disabled until subscription/tag activation. |
| Basic Membership | $3/month | 1 NFC tag | 1 user account | 7-day free trial; support/tutorials. |
| Silver Membership | $4/month | 1 NFC tag | 2 user accounts | Support/tutorials. |
| Gold Membership | $6/month | 2 NFC tags | 1 user account | Support/tutorials. |
| Diamond Membership | $10/month | Either 2 NFC tags + 2 users, or 3 NFC tags + 1 user | See tag allowance | Support/tutorials. |
| Admin | internal | Unlimited | Unlimited | CAK3D testing/management bypass. |

## Key flows
1. Owner signs up with Supabase Auth via email/password or Google.
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
- Vercel later if server routes, Patreon callbacks, webhooks, private admin APIs, or secure coupon/tag fulfillment need server execution.

## Legacy material to mine
Existing repos contain useful pieces from earlier experiments:
- static JSON models for dogs/users/devices/locations/patreon
- NFC tag ID matching
- Google Maps iframe location display
- GitHub Actions location/update flows
- Mongo/Auth0 prototypes
- Patreon sync sketches

CAK3D also has local backup files on the NukeBox that may contain useful database/storage chunks:
- `C:\Users\CAK3D\Downloads\db_cluster-29-09-2025@05-13-44.backup.gz`
- `C:\Users\CAK3D\Downloads\bzfmluscikipkwaiophn.storage.zip`
