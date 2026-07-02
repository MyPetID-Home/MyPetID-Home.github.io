import { createHmac, timingSafeEqual } from 'node:crypto';
import { serverSupabase } from './server-integrations';

function ah(token: string) { return [String.fromCharCode(66, 101, 97, 114, 101, 114), token].join(' '); }

export function verifyPatreonState(state: string) {
  const secret = process.env.PATREON_CLIENT_SECRET;
  if (!secret) throw new Error('Patreon client secret is not configured.');
  const [encoded, sig] = state.split('.');
  if (!encoded || !sig) throw new Error('Invalid Patreon OAuth state.');
  const expected = createHmac('sha256', secret).update(encoded).digest('base64url');
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error('Patreon OAuth state verification failed.');
  const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  if (!parsed.profile_id || Date.now() - Number(parsed.created_at || 0) > 15 * 60 * 1000) throw new Error('Patreon OAuth state expired.');
  return parsed as { profile_id: string; nonce: string; created_at: number };
}

export async function patreonToken(body: Record<string, string>) {
  const clientId = process.env.PATREON_CLIENT_ID || process.env.MYPETID_PATREON_CLIENT_ID;
  const clientSecret = process.env.PATREON_CLIENT_SECRET || process.env.MYPETID_PATREON_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Patreon OAuth env is not configured.');
  const response = await fetch('https://www.patreon.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...body, client_id: clientId, client_secret: clientSecret }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error_description || data?.error || `Patreon token ${response.status}`);
  return data;
}

export async function patreonGet(path: string, accessToken: string) {
  const response = await fetch(`https://www.patreon.com/api/oauth2/v2${path}`, { headers: { Authorization: ah(accessToken) } });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.errors?.[0]?.detail || data?.error || `Patreon ${response.status}`);
  return data;
}

function patreonCreatorToken() {
  return process.env.PATREON_CREATOR_ACCESS_TOKEN || process.env.MYPETID_PATREON_CREATOR_ACCESS_TOKEN;
}

export async function patreonCreatorGet(path: string) {
  let token = patreonCreatorToken();
  if (!token) throw new Error('Patreon creator access token is not configured.');
  try {
    return await patreonGet(path, token);
  } catch (error) {
    const refreshToken = process.env.PATREON_CREATOR_REFRESH_TOKEN || process.env.MYPETID_PATREON_CREATOR_REFRESH_TOKEN;
    if (!refreshToken) throw error;
    const refreshed = await patreonToken({ grant_type: 'refresh_token', refresh_token: refreshToken });
    token = refreshed.access_token;
    if (!token) throw error;
    return patreonGet(path, token);
  }
}

export function tierSlugFromPatreon(tierIds: string[], amountCents?: number, title?: string) {
  const byId: Record<string, string> = { '26119941': 'basic', '26121496': 'silver', '26119955': 'gold', '26119961': 'diamond', '26119922': 'free' };
  for (const id of tierIds) if (byId[id]) return byId[id];
  const normalized = String(title || '').trim().toLowerCase();
  if (normalized.includes('diamond')) return 'diamond';
  if (normalized.includes('gold')) return 'gold';
  if (normalized.includes('silver')) return 'silver';
  if (normalized.includes('basic')) return 'basic';
  if (amountCents && amountCents >= 1000) return 'diamond';
  if (amountCents && amountCents >= 600) return 'gold';
  if (amountCents && amountCents >= 400) return 'silver';
  if (amountCents && amountCents >= 300) return 'basic';
  return 'free';
}

export async function applyPatreonMembership(profileId: string | null, providerSubject: string | null, tier: string, status: string, metadata: Record<string, unknown>) {
  const supabase = serverSupabase();
  const targetProfile = profileId || (providerSubject ? (await supabase.from('provider_credentials').select('profile_id').eq('provider', 'patreon').eq('provider_subject', providerSubject).maybeSingle()).data?.profile_id : null);
  await supabase.from('membership_events').insert({ profile_id: targetProfile || null, provider: 'patreon', provider_customer_id: providerSubject, tier, status, metadata });
  if (targetProfile) {
    await supabase.from('profiles').update({ tier: status === 'active' ? tier : 'free', patreon_linked: true, patreon_tier: tier }).eq('id', targetProfile).neq('tier', 'admin');
  }
  return { profileId: targetProfile, tier, status };
}
