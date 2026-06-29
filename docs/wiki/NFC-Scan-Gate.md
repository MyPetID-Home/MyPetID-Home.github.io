# NFC scan gate and public profile split

## Problem

If the NFC/QR destination writes scan location automatically on page open, accidental scans, browser previews, refreshes, owner testing, or repeated opens can overwrite the useful last-location trail.

## Decision

Use two route classes:

1. `/scan/?tag=<tag_code>` — NFC/QR destination and write-capable consent gate.
2. `/pet/?tag=<tag_code>` or `/pet/?pet=<pet_id>` — read-only public pet profile.

## Behavior

- `/scan/` visually mimics the public pet profile so a finder sees the pet immediately.
- `/scan/` never saves GPS on initial load.
- GPS is attempted only after the finder taps `Share my scan location` and grants browser permission.
- The finder can view the public profile without sharing location.
- Lost sightings are explicit: the finder can mark the scan as a lost-pet sighting before consenting.
- `/pet/` can show owner-approved info and the previous eligible scan map, but cannot write GPS.
- Dashboard QR/NFC preview should generate the `/scan/` URL for physical tags, while offering a `/pet/` public preview link.
- When a dog profile is saved, the app creates a `pet_qr_codes` row for the public pet URL and an `account_qr_codes` row for Dog Pack/account sharing.

## Physical tag fulfillment

- Basic NFC Tag: blank NFC card with QR-code sticker, `$10.00`.
- ID NFC Tag Card: license-style ID NFC/QR card, `$15.00`.
- CAK3D should program/print the NFC/QR tag with the saved public pet profile or scan-gate URL before shipping.
- The QR code acts as a camera fallback if a finder cannot tap NFC.

## Production hardening backlog

- Move the final scan write behind a Vercel API route or Supabase Edge Function.
- Validate active tag and subscription/tier before accepting location events.
- Detect logged-in owner / trusted device before classifying actor.
- Rate-limit repeated scans by tag/device/IP-ish signal.
- Store browser install ID or trusted-device ID outside the public note field.
- Build owner-facing scan history with filters for stranger, linked user, owner, and lost report events.
