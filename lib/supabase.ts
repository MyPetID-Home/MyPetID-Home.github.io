import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

export const primaryAdminEmail = 'real_cak3d@yahoo.com';
export const adminLoginAlias = 'CAK3D_ADMIN';

export function normalizeLoginEmail(value: string) {
  return value.trim().toUpperCase() === adminLoginAlias ? primaryAdminEmail : value.trim();
}

export function isAdminEmail(email?: string | null) {
  return Boolean(email && email.toLowerCase() === primaryAdminEmail);
}
