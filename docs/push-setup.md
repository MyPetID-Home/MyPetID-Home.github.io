# Web push setup (alerts while the app is closed)

Every new row in `public.notifications` (tag scan alerts, lost-dog alerts, announcements,
health/care reminders) is pushed to each device the owner turned push alerts on for.

How it fits together:

1. The owner taps **Turn on push alerts** (App settings > Get the MyPetID app, or the bell panel).
   `components/push-optin.tsx` asks the browser for permission, subscribes with the public VAPID
   key and POSTs the subscription to `/api/push/subscribe/` (Vercel). It is stored in
   `public.push_subscriptions`.
2. A Supabase Database Webhook fires on `notifications` INSERT and POSTs the row to
   `https://mypetid.vercel.app/api/push/dispatch` with the header `x-push-secret`.
3. The dispatch route sends the message with the `web-push` package to all of that owner's
   devices. Devices the push service reports as gone (404/410) are deleted; other failures
   increase `failures`.
4. `public/sw.js` shows the notification and opens/focuses the app when it is tapped.

Nothing below is done automatically. Keys and secrets are created by you and never committed.

## 1. Run the database migration

Supabase dashboard > SQL editor > paste and run
`docs/migrations/2026-10-push-subscriptions.sql`. Check with:

```sql
select count(*) from public.push_subscriptions;
select policyname from pg_policies where tablename = 'push_subscriptions';
```

## 2. Generate VAPID keys (on your own computer)

```bash
npx web-push generate-vapid-keys
```

It prints a **Public Key** and a **Private Key**. Keep the private key secret (password manager);
do not paste it into chat, issues or commits.

Also make a random webhook secret, for example:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 3. Vercel environment variables (project `mypetid`)

Vercel > Project > Settings > Environment Variables, for Production (and Preview if you test there):

| Name | Value |
| --- | --- |
| `VAPID_PUBLIC_KEY` | the Public Key from step 2 |
| `VAPID_PRIVATE_KEY` | the Private Key from step 2 (mark as Sensitive) |
| `VAPID_SUBJECT` | `mailto:dev.mypetid-help@yahoo.com` |
| `PUSH_WEBHOOK_SECRET` | the random secret from step 2 (mark as Sensitive) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | the same Public Key (so the Vercel copy of the app can subscribe too) |

Redeploy the Vercel project after saving them.

## 4. GitHub repository variable (GitHub Pages build)

GitHub > repo > Settings > Secrets and variables > Actions > **Variables** tab > New repository variable:

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` = the Public Key from step 2

`.github/workflows/deploy-pages.yml` already passes it to the build. Re-run the Pages workflow
(or push to `main`) so the static site picks it up. Without it, the opt-in shows only a small
"push not configured yet" note to admins and nothing to everyone else.

## 5. Supabase Database Webhook

Supabase dashboard > Database > Webhooks (Integrations > Database Webhooks) > Create a new hook:

- Name: `push-dispatch`
- Table: `public.notifications`
- Events: **Insert** only
- Type: HTTP Request
- Method: `POST`
- URL: `https://mypetid.vercel.app/api/push/dispatch`
- HTTP headers: `Content-Type: application/json` and `x-push-secret: <PUSH_WEBHOOK_SECRET from step 3>`
- Timeout: 5000 ms

## 6. Test

1. Sign in as an admin on a phone or desktop browser, open App settings, tap **Turn on push alerts**
   and allow notifications.
2. Tap **Send a test push** (admins only; calls `POST /api/push/test/`). A "MyPetID test alert"
   should appear even with the tab in the background.
3. Close the app and send an announcement to "Admins only (test)". The announcement creates a
   notifications row, the webhook fires, and the push arrives.
4. Supabase > Database > Webhooks shows each delivery; Vercel > Logs shows `/api/push/dispatch`.

## iPhone and iPad

Safari supports web push only for a site added to the Home Screen (iOS/iPadOS 16.4 or later).
The opt-in tells iOS users to tap Share > Add to Home Screen and turn alerts on from the
installed app.

## Turning it off

Owners tap **Turn off on this device**. To stop all pushes, disable the Supabase webhook.
