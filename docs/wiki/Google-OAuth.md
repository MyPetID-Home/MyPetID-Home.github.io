# Google OAuth configuration

## Google Cloud Authorized JavaScript origins

Add these to the Google OAuth web client:

- `https://mypetid-home.github.io`
- `http://localhost:3000`
- `http://127.0.0.1:3000`

## Authorized redirect URIs

For Supabase Auth Google login, use the Supabase callback URI:

- `https://ryyaefxszkmibcnngnfg.supabase.co/auth/v1/callback`

The app may redirect users after login to:

- `https://mypetid-home.github.io/dashboard/`
- `http://localhost:3000/dashboard/`

Those dashboard URLs are app redirect destinations / allow-list values, not places to store a Google client secret.

## Notes

- Supabase Auth should own the Google OAuth provider callback while the app is static on GitHub Pages.
- Do not commit Google client secrets.
- When Google is enabled in Supabase, verify from the live Pages `/dashboard/` Google button.
