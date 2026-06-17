# NFC scan gate and public profile split

## Problem

If the NFC/QR destination writes scan location automatically on page open, accidental scans, browser previews, refreshes, owner testing, or repeated opens can overwrite the useful last-location trail.

## Decision

Use two routes:

1. `/scan/?tag=<tag_code>` — NFC/QR destination and write-capable consent gate.
2. `/pet/?tag=<tag_code>` — read-only public pet profile.

## Behavior

- `/scan/` visually mimics the public pet profile so a finder sees the pet immediately.
- `/scan/` never saves GPS on initial load.
- GPS is attempted only after the finder taps `Share my scan location` and grants browser permission.
- The finder can view the public profile without sharing location.
- Lost sightings are explicit: the finder can mark the scan as a lost-pet sighting before consenting.
- `/pet/` can show owner-approved info and the previous eligible scan map, but cannot write GPS.
- Dashboard QR/NFC preview should generate the `/scan/` URL, while also offering a `/pet/` public preview link.

## Production hardening backlog

- Move the final scan write behind a Supabase Edge Function.
- Validate active tag and subscription/tier before accepting location events.
- Detect logged-in owner / trusted device before classifying actor.
- Rate-limit repeated scans by tag/device/IP-ish signal.
- Store browser install ID or trusted-device ID outside the public note field.
- Build owner-facing scan history with filters for stranger, linked user, owner, and lost report events.
