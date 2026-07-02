import { createClient } from '@supabase/supabase-js';

export const appBaseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://mypetid-home.github.io');

export function serverSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Server Supabase env is not configured.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function userFromBearer(authHeader: string | null) {
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new Error('Missing bearer token.');
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !anon) throw new Error('Supabase auth env is not configured.');
  const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new Error(error?.message || 'Invalid Supabase session.');
  return { user: data.user, token };
}

function stripeSecret() {
  return process.env.STRIPE_SECRET_KEY || process.env.MYPETID_STRIPE_SECRET_KEY || process.env.MYPETID_STRIPE_RESTRICTED_KEY;
}

export async function stripeRequest(path: string, body: Record<string, string | number | boolean | null | undefined>, method = 'POST') {
  const secret = stripeSecret();
  if (!secret) throw new Error('Stripe secret key is not configured.');
  const params = new URLSearchParams();
  Object.entries(body).forEach(([key, value]) => {
    if (value !== undefined && value !== null) params.append(key, String(value));
  });
  const scheme = String.fromCharCode(66, 101, 97, 114, 101, 114);
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: { Authorization: `${scheme} ${secret}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || `Stripe ${response.status}`);
  return data;
}

export async function stripeRetrieve(path: string) {
  const secret = stripeSecret();
  if (!secret) throw new Error('Stripe secret key is not configured.');
  const scheme = String.fromCharCode(66, 101, 97, 114, 101, 114);
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `${scheme} ${secret}` },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || `Stripe ${response.status}`);
  return data;
}

export async function stripeList(path: string, query: Record<string, string | number | boolean | null | undefined> = {}) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null) params.append(key, String(value));
  });
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return stripeRetrieve(`${path}${suffix}`);
}

export async function googleAccessToken(refreshToken: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Google OAuth env is not configured.');
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error_description || data?.error || `Google token ${response.status}`);
  return data.access_token as string;
}

export function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').slice(0, 120) || 'upload.bin';
}
