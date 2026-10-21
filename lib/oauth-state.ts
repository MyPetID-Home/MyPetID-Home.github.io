import { createHmac, timingSafeEqual } from 'node:crypto';

// Signed, expiring OAuth `state` values so a callback can trust which MyPetID
// profile started the flow. An unsigned state lets an attacker forge another
// user's profile id and attach their own provider account to it.

const MAX_AGE_MS = 15 * 60 * 1000;

export function signOAuthState(secret: string, profileId: string) {
  const payload = { profile_id: profileId, nonce: crypto.randomUUID(), created_at: Date.now() };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifyOAuthState(secret: string, state: string) {
  const [encoded, sig] = state.split('.');
  if (!encoded || !sig) throw new Error('Invalid OAuth state.');
  const expected = Buffer.from(createHmac('sha256', secret).update(encoded).digest('base64url'));
  const actual = Buffer.from(sig);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new Error('OAuth state verification failed.');
  const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as { profile_id?: string; created_at?: number };
  if (!parsed.profile_id || Date.now() - Number(parsed.created_at || 0) > MAX_AGE_MS) throw new Error('OAuth state expired. Start the connection again.');
  return parsed as { profile_id: string; created_at: number };
}
