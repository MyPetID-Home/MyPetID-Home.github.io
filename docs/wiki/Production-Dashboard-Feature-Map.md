# Production dashboard feature map

MyPetID is intended to be a full pet profile, activity, health, diet, distance, lost/found, and care tracker — not a static landing page.

## Current dashboard modules

- Overview: scan gate QR, public profile link, care stats, weekly distance progress, level/XP, live activity map.
- Account: username, display name, email, phone, avatar URL, emergency contact, address, password-reset action note.
- Pets: editable pet identity, tag ID, species, breed, birthday, sex, weight, color, microchip, vet, photo, behavior notes.
- Walks: start/end walk, moving route icon, live distance/time, saved walk history, weekly walk goal.
- Diet: feeding plan, favorite treats, editable meal/snack logs, completion toggles.
- Medical: allergies, medications, vaccine/ID/document records, public-safe flags.
- Lost/found: lost reports, sighting location/note/status, last-scan sharing action.
- Goals: weekly distance, meals/day, care tasks, XP, levels, task completion buttons.
- Settings: public-field toggles, alerts, units, privacy mode, theme.
- Admin: tag ID generation, invites, Patreon sync placeholder, demo data reset.

## Production backend needed

The static GitHub Pages app can host the responsive UI and browser-side Supabase calls. Before live customer use, the following should be server-side via Supabase Edge Functions or a future backend:

- Google/Patreon/Stripe secrets and callbacks.
- Final scan-event writes with tier, active-tag, owner/trusted-device, abuse, and rate-limit checks.
- Tag creation/minting and ownership transfer.
- Invite emails and admin-only profile changes.
- File upload signing for medical records/profile pictures.
- Push/email notification delivery.

## UI direction

The old floating emoji animations are being replaced with app-like, data-tied movement:

- route lines and map grid
- moving tracker icon during live walks
- progress bars tied to weekly goals and XP
- cards that update from editable state
- dashboard status feedback for every control
