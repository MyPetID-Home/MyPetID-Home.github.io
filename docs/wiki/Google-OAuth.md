# Google OAuth configuration

## Current status

Supabase project:

- `ryyaefxszkmibcnngnfg`

Current app implementation status:

- Supabase email/password auth is wired.
- Google login button exists in the auth panel.
- Vercel API routes now exist for app-level Google connection and upload sync:
  - `/api/google/oauth/start`
  - `/api/google/oauth/callback`
  - `/api/uploads` uses Google Photos for pet photos and Google Drive for documents after Google is connected.
- CAK3D is still finishing Google OAuth/provider setup, so do not mark Google login/upload sync fully production verified until Google credentials, redirect URIs, and Supabase Auth provider settings are confirmed live.

## Google Cloud OAuth Client ID

Client ID supplied by CAK3D:

- `126805153488-mgmkt24vqgtuoc2f7191o6o0sm4ido7b.apps.googleusercontent.com`

Store the matching OAuth client secret only in secure env/secret stores. Do not commit it.

## Google Cloud Authorized JavaScript origins

Add active frontend origins:

- `https://mypetid-home.github.io`
- `https://mypetid.vercel.app`
- Vercel preview URL(s), only while testing previews
- `http://localhost:3000`
- `http://127.0.0.1:3000`

## Authorized redirect URIs

For Supabase Auth Google login, use the Supabase callback URI:

- `https://ryyaefxszkmibcnngnfg.supabase.co/auth/v1/callback`

For MyPetID app-level Google upload sync on Vercel, allow:

- `https://mypetid.vercel.app/api/google/oauth/callback`
- active Vercel preview callback URLs only while testing previews
- `http://localhost:3000/api/google/oauth/callback` for local development

The app redirects users after login/connect back to dashboard/settings routes.

## Supabase Auth settings to apply once secret is available

Enable Google provider in Supabase Auth with:

- client ID: supplied Google OAuth web client ID
- client secret: matching Google OAuth web client secret
- callback URL: `https://ryyaefxszkmibcnngnfg.supabase.co/auth/v1/callback`

Also keep Site URL and redirect allow-list aligned with the active frontend host.

## Notes

- Supabase Auth should own the Google login provider flow.
- Vercel API owns the app-level Google Photos/Drive connection used for upload sync.
- Do not commit Google client secrets.
- When Google is enabled, verify both login and upload sync from the live Vercel app.
