#!/usr/bin/env node
// Read-only check that the public (anon) Supabase key can no longer read private
// MyPetID data, and that the public pages' RPC still works.
//
// Usage (Node 18+):
//   SUPABASE_ANON_KEY=<publishable anon key> node scripts/verify-rls.mjs
//   (optional) SUPABASE_URL=https://<project>.supabase.co
//
// Uses only the public anon key that ships in the website. Never pass a
// service-role/secret key: with one, every check would "fail" because it bypasses RLS.
// The script only issues GET requests and one read-only RPC (get_public_pet). It
// prints counts and column names, never row values.

const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ryyaefxszkmibcnngnfg.supabase.co').replace(/\/+$/, '');
const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!key) {
  console.error('Set SUPABASE_ANON_KEY (the public anon/publishable key) and run again.');
  process.exit(2);
}
try {
  const payload = key.split('.')[1];
  const role = payload ? JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')).role : null;
  if (role && role !== 'anon') {
    console.error(`Refusing to run: this key has role "${role}". Use the public anon key only.`);
    process.exit(2);
  }
} catch { /* sb_publishable_ keys are not JWTs; fine */ }

const headers = { apikey: key, Authorization: `Bearer ${key}` };

// Tables/views the public must not be able to read any rows from.
const privateTables = [
  'profiles', 'pets', 'tags', 'scan_events', 'devices', 'tag_orders',
  'provider_credentials', 'access_coupons', 'membership_grants', 'email_verification_codes',
  'account_activity_log', 'admin_account_debug_view', 'dog_pack_invites', 'upload_events',
  'membership_events', 'pet_qr_codes', 'account_qr_codes', 'xp_events', 'pet_awards',
  'training_commands', 'verification_requests', 'calendar_events', 'profile_links',
];
// Tables the public shop needs to keep reading.
const publicTables = ['tag_products', 'membership_tiers'];
// Columns get_public_pet must never return.
const forbiddenPublicColumns = ['owner_id', 'care_notes', 'feeding_plan', 'documents', 'public_fields', 'claim_code_hash', 'created_by'];

let failures = 0;
let warnings = 0;
const pass = (msg) => console.log(`PASS  ${msg}`);
const fail = (msg) => { failures += 1; console.log(`FAIL  ${msg}`); };
const warn = (msg) => { warnings += 1; console.log(`WARN  ${msg}`); };

async function readRows(table) {
  const response = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, { headers: { ...headers, Prefer: 'count=exact' } });
  let body = null;
  try { body = await response.json(); } catch { /* ignore */ }
  const total = Number((response.headers.get('content-range') || '').split('/')[1]);
  return { status: response.status, rows: Array.isArray(body) ? body.length : 0, total: Number.isFinite(total) ? total : null, body };
}

for (const table of privateTables) {
  const result = await readRows(table);
  if ([401, 403].includes(result.status)) pass(`${table}: not readable by the public (HTTP ${result.status})`);
  else if (result.status === 404) warn(`${table}: not found (HTTP 404); table missing or not exposed`);
  else if (result.status >= 200 && result.status < 300 && result.rows === 0 && !result.total) pass(`${table}: public sees 0 rows`);
  else if (result.status >= 200 && result.status < 300) fail(`${table}: public can read ${result.total ?? result.rows} row(s)`);
  else warn(`${table}: unexpected HTTP ${result.status}`);
}

for (const table of publicTables) {
  const result = await readRows(table);
  if (result.status >= 200 && result.status < 300 && result.rows > 0) pass(`${table}: still publicly readable (${result.total ?? result.rows} row(s))`);
  else warn(`${table}: public read returned HTTP ${result.status} with ${result.rows} row(s); the shop page needs these`);
}

// Public pet profile RPC (read-only). Uses the demo tag; an empty result is fine.
{
  const tag = process.env.VERIFY_TAG_CODE || 'demo-tag-001';
  const response = await fetch(`${url}/rest/v1/rpc/get_public_pet`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_tag_code: tag }),
  });
  let body = null;
  try { body = await response.json(); } catch { /* ignore */ }
  if (response.status === 404) fail('get_public_pet RPC not found: run docs/migrations/2026-10-security-hardening.sql');
  else if (!response.ok) fail(`get_public_pet RPC returned HTTP ${response.status}`);
  else {
    const rows = Array.isArray(body) ? body : [];
    const leaked = rows.flatMap((row) => Object.keys(row)).filter((column) => forbiddenPublicColumns.includes(column));
    if (leaked.length) fail(`get_public_pet returns private column(s): ${[...new Set(leaked)].join(', ')}`);
    else pass(`get_public_pet works for tag "${tag}" (${rows.length} row; columns: ${rows[0] ? Object.keys(rows[0]).join(', ') : 'none'})`);
  }
}

console.log(`\n${failures ? 'FAILED' : 'OK'}: ${failures} failure(s), ${warnings} warning(s).`);
process.exit(failures ? 1 : 0);
