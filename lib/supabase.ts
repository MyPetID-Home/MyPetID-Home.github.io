import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

/** True when the cloud database answers. Network errors and 5xx count as down; anything else as up. */
export async function supabaseHealthCheck(timeoutMs = 8000): Promise<boolean> {
  if (!hasSupabaseConfig) return true;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/health`, { headers: { apikey: supabaseAnonKey! }, signal: controller.signal, cache: 'no-store' });
    return response.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export const primaryAdminEmail = 'real_cak3d@yahoo.com';
export const adminLoginAlias = 'CAK3D_ADMIN';

export function normalizeLoginEmail(value: string) {
  return value.trim().toUpperCase() === adminLoginAlias ? primaryAdminEmail : value.trim();
}

// Full admins: they see the admin/dev dashboard and can switch to a normal-user view to test.
// Database permissions come from profiles.is_admin (set for both in 2026-10-profiles-self-insert.sql).
export const adminEmails = [primaryAdminEmail, 'mypetid@yahoo.com'];

export function isAdminEmail(email?: string | null) {
  return Boolean(email && adminEmails.includes(email.trim().toLowerCase()));
}
