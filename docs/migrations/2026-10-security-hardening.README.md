# 2026-10 security hardening

`2026-10-security-hardening.sql` closes the database holes found in the October 2026 audit. It runs in one transaction and is safe to run more than once.

## How to apply

1. Open the Supabase dashboard for project `ryyaefxszkmibcnngnfg`, go to **SQL Editor**, paste the whole file, and click **Run**. It finishes with `COMMIT`. If any statement fails, nothing is applied.
2. Deploy the app code from the same branch to Vercel and GitHub Pages. The code works both before and after the SQL: it falls back to the old queries until the new functions exist. Apply the SQL soon, though, because the old queries are the ones that leak data.
3. Run the verification script (below).

## What it changes

| Area | Before | After |
| --- | --- | --- |
| `profiles` | A signed-in user could set their own `is_admin`, `tier`, `patreon_*`, `email_verified_at` and so on, which made them an admin. | A trigger rejects browser changes to `is_admin`, `tier`, `patreon_linked`, `patreon_tier`, `google_*_linked`, `email`, `email_verified_at` and `first_tag_coupon_code`. Profiles a user creates for themselves always start as `free` and non-admin. The Vercel server (service role) and the SQL editor can still change these columns. |
| `pets` | Every column, including `owner_id`, `care_notes` and `feeding_plan`, was readable by anyone. | Only the owner or an admin can read a pet row. Public pages call `get_public_pet(p_tag_code, p_pet_id)`. It returns only the public fields allowed by `pets.public_fields`, plus `is_owner`, and never `owner_id`, notes or feeding data. |
| `tags` | Anyone could read every tag, including `claim_code_hash`. A signed-in user could claim any unclaimed tag with a direct `UPDATE`, skipping the claim code and plan limits. | Only the tag's owner or an admin can read it, and only admins can write. Claims go through `/api/tags/activate`. That route checks the plan, then calls `claim_tag()`, which claims the tag in one step only if it is still unclaimed, the claim-code hash matches, and the pet belongs to the user. Only the service role can execute `claim_tag()`. |
| `scan_events` | Anyone could read every finder location, contact and note, and insert reports for any pet. | Only the pet's owner, the person who scanned, or an admin can read a report. Finders submit with `submit_finder_report()`, which: <ul><li>checks the tag is linked to a pet</li><li>validates the coordinates</li><li>trims notes to 500 characters, finder notes to 1,000 and contact details to 200</li><li>allows at most 10 reports per tag per 10 minutes and 100 per day</li><li>sets `pet_id`, `actor` and `scanner_profile_id` itself</li></ul> Only the pet owner or an admin can update follow-up fields. |
| `tag_orders` | Users could insert and update their own orders, including marking them `paid`. | Users can only read their orders. Only the server writes them. |
| `pet_documents` | A single `FOR ALL` policy let anyone delete or take over rows marked `public_visible`. | Separate policies per command. Public rows are readable only. |
| `dog_pack_invites`, `pet_awards` | Users could write these directly, bypassing helper limits or giving themselves points. | Only admins write directly. Invites are created by `/api/dog-pack/invites`. |
| Storage | The update and delete policies were not limited to MyPetID buckets. The public `tag-assets` bucket accepted SVG files. | Update and delete are limited to the 4 MyPetID buckets. SVG is removed from `tag-assets`. |
| `account_activity_log.source` | Stored the raw request headers, including the caller's login token. | Stores the headers without `authorization`, `apikey`, `cookie` and `x-supabase-auth`. Existing rows are redacted. |
| `provider_credentials` | One Patreon or Google account could be linked to several profiles. | Each provider account can be linked to only one profile. The index is skipped with a NOTICE if duplicates already exist; remove them and run the file again. |
| `membership_events` | The provider check rejected `coupon`, which `/api/coupons/redeem` logs. | `coupon` is allowed. |

### Admins after this change

A browser can no longer make anyone an admin, including the owner's account on first sign-in. Existing admin rows are unchanged. To make an account an admin, run this in the SQL editor:

```sql
update public.profiles set is_admin = true, tier = 'admin' where email = 'person@example.com';
```

### Known remaining items, not covered here

- `xp_events` can still be inserted by owners for their own pets. The dashboard writes XP directly from the browser; moving this to the server is a code change.
- `is_app_admin()` is still executable by `anon`, because policies call it on behalf of anonymous visitors.

## How to verify

### Automated, read-only, public key only

```bash
SUPABASE_ANON_KEY=<public anon key> node scripts/verify-rls.mjs
```

The anon key is the public one that already ships in the website (`NEXT_PUBLIC_SUPABASE_ANON_KEY`). The script refuses to run with a service-role key. It sends only GET requests and one read-only RPC call, and prints counts and column names, never data.

- **Expected after the migration:** every private table shows `PASS` (0 rows or 401/403), `tag_products` and `membership_tiers` are still readable, `get_public_pet` works without private columns, and the run ends with `OK`.
- **Before the migration:** `pets`, `tags` and `scan_events` fail, and so does `get_public_pet` (not found).

### Manual checks in the app

1. Open `/pet/?tag=<a real linked tag>` and `/scan/?tag=<same tag>`: the pet shows.
2. On `/scan/`, accept location sharing: you should see the success message, and the report should appear in the owner's dashboard.
3. Sign in as a normal user and save your profile (name or phone): it saves.
4. Check that a signed-in user can't promote themselves. Run this in the SQL editor; it changes nothing because it ends in `rollback`:
   ```sql
   begin;
   set local role authenticated;
   select set_config('request.jwt.claims', '{"sub":"<a normal user id>","role":"authenticated"}', true);
   update public.profiles set is_admin = true where id = '<same id>';
   rollback;
   ```
   Expected result: `ERROR: The profile field "is_admin" can only be changed by MyPetID staff.`
5. Activate a card with its claim code from the dashboard: it succeeds once, and the second attempt is refused.
6. In the SQL editor, check the policies:
   ```sql
   select tablename, policyname, cmd from pg_policies where schemaname = 'public' order by 1, 2;
   ```
   There should be no `pets public read`, `tags public read`, `scan read linked` or `scan insert public` left.
