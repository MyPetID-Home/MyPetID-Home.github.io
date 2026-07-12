# Local-first fallback mode

MyPetID should remain usable when Supabase, Google, Stripe, Patreon, or another provider is unavailable.

## Current fallback layer

Implemented first-pass client fallback:

- Local device account/session in `localStorage` via `lib/fallback-local.ts`.
- The normal Account email/password form attempts Supabase first; if Supabase is unavailable/restricted, it falls back to a local device session.
- Local fallback sign-up stores only a browser-local password hash. This is not cloud auth and is not a substitute for Supabase Auth once service returns.
- Dashboard state already persists locally in `mypetid.dashboard`.
- Pet saves can queue a `pet_save` item when cloud save is unavailable/restricted.
- Finder scan consent can queue a `scan_event` item when cloud save is unavailable/restricted.
- Auth panel shows local fallback mode and pending queue count.

## Queue storage

Local queue key:

```txt
mypetid.fallback.syncQueue
```

Queue item shape:

```ts
{
  id: string;
  type: 'profile_save' | 'pet_save' | 'scan_event' | 'upload_metadata' | 'generic';
  status: 'pending' | 'synced' | 'failed';
  createdAt: string;
  updatedAt: string;
  summary: string;
  payload: unknown;
  lastError?: string;
}
```

## Important limits

This first pass keeps the app usable on the same browser/device. It does not yet sync between devices while Supabase is down.

Do not market local fallback as secure multi-device auth. It is a resilience layer for outages:

- Same device can keep working.
- Data stays in the browser.
- Pending changes are retained for later replay.
- Cloud identity and cross-device sync resume when Supabase/auth comes back.

## Next sync worker

When Supabase is restored, add a replay worker that:

1. Reads `mypetid.fallback.syncQueue`.
2. Requires a real Supabase session.
3. Replays pending items by type:
   - `pet_save` -> upsert `pets`/metadata.
   - `scan_event` -> insert `scan_events`.
   - `profile_save` -> upsert profile/account fields.
   - `upload_metadata` -> create provider-reference metadata rows after Google upload.
4. Marks each item `synced` or `failed` with `lastError`.
5. Lets user review/retry failed items before deletion.

## Future provider outage strategy

- Supabase down: local auth/session + queue + local dashboard state.
- Google down: queue upload metadata and keep file previews local if possible; retry Google upload later.
- Stripe down: show product/pricing UI but hold checkout attempts; do not fake paid status.
- Email down: queue verification/send attempts; do not mark email verified.
- Patreon down: keep prior mirrored entitlement; queue refresh/reconnect.
- Cloudflare/R2 down later: fall back to Google-derived or local thumbnails, then retry derivative upload.

## Security rule

Never store provider secrets in this fallback queue. Payloads may contain user-entered pet/scan/account data, but not service-role keys, OAuth refresh tokens, Stripe secrets, Patreon tokens, SMTP passwords, or private credentials.
