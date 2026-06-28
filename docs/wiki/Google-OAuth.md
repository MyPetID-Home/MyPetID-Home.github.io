# Google OAuth configuration

## Current status

Supabase project:

- `ryyaefxszkmibcnngnfg`

Current Supabase Auth status from management API:

- Google provider enabled: `false`
- Google client ID present in Supabase: `false`
- Site URL: `https://mypetid-home.github.io`

Clydius does not currently have a Google OAuth **client secret** in the private profile env, so the agent cannot safely enable Google login yet. A browser API key or GitHub secret named `GOOGLE_API_KEY` is not enough for Supabase Auth Google login.

## Google Cloud OAuth Client ID

Client ID supplied by CAK3D:

- `126805153488-mgmkt24vqgtuoc2f7191o6o0sm4ido7b.apps.googleusercontent.com`

To enable Supabase Google login, also copy the matching Google OAuth client secret from:

Google Cloud Console → APIs & Services → Credentials → Web OAuth client details.

Store the secret only in a secure env/secret store. Do not commit it.

## Google Cloud Authorized JavaScript origins

Add these to the Google OAuth web client:

- `https://mypetid-home.github.io`
- `https://mypetid-b0t2wjpx4-my-pet-id.vercel.app` if the Vercel deployment becomes public/active
- `http://localhost:3000`
- `http://127.0.0.1:3000`

## Authorized redirect URIs

For Supabase Auth Google login, use the Supabase callback URI:

- `https://ryyaefxszkmibcnngnfg.supabase.co/auth/v1/callback`

The app may redirect users after login to:

- `https://mypetid-home.github.io/dashboard/`
- `https://mypetid-b0t2wjpx4-my-pet-id.vercel.app/dashboard/` if Vercel is public/active
- `http://localhost:3000/dashboard/`

Those dashboard URLs are app redirect destinations / allow-list values, not places to store a Google client secret.

## Supabase Auth settings to apply once secret is available

Enable Google provider in Supabase Auth with:

- client ID: supplied Google OAuth web client ID
- client secret: matching Google OAuth web client secret
- callback URL: `https://ryyaefxszkmibcnngnfg.supabase.co/auth/v1/callback`

Also keep Site URL and redirect allow-list aligned with the active frontend host.

## Notes

- Supabase Auth should own the Google OAuth provider callback while the app is static on GitHub Pages.
- Do not commit Google client secrets.
- When Google is enabled in Supabase, verify from the live Pages `/dashboard/` Google button.
