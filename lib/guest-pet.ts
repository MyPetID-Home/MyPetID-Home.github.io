import { supabase } from './supabase';

/**
 * Guest dog profiles: no account, just the dog's name + a 6-digit PIN
 * (docs/migrations/2026-10-pet-profiles-guest.sql). The server returns a token that
 * stays on this device; the PIN itself is never stored here.
 */
const KEY = 'mypetid.guestPet';

export type GuestPet = {
  id: string;
  name: string;
  species: string | null;
  breed: string | null;
  photo_url: string | null;
  cover_url: string | null;
  medical_public: string | null;
  behavior_public: string | null;
  contact_public: Record<string, string | null> | null;
  lost_mode: boolean;
  profile: Record<string, unknown>;
  public_fields: string[];
};

type Saved = { petId: string; token: string };

export function savedGuest(): Saved | null {
  try { const raw = localStorage.getItem(KEY); return raw ? (JSON.parse(raw) as Saved) : null; } catch { return null; }
}
function save(value: Saved | null) {
  try { if (value) localStorage.setItem(KEY, JSON.stringify(value)); else localStorage.removeItem(KEY); } catch { /* storage blocked */ }
  window.dispatchEvent(new Event('mypetid:guest'));
}
function friendly(message: string) {
  if (/could not find the function|schema cache/i.test(message)) return 'Guest dog profiles are being switched on. Please try again soon.';
  return message.replace(/^.*?:\s/, '');
}

export async function guestCreate(name: string, pin: string, breed?: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!supabase) return { ok: false, error: 'MyPetID is offline right now.' };
  const { data, error } = await supabase.rpc('guest_create_pet', { p_name: name, p_pin: pin, p_breed: breed || null, p_photo_url: null });
  if (error) return { ok: false, error: friendly(error.message) };
  const row = (Array.isArray(data) ? data[0] : data) as { pet_id: string; token: string };
  save({ petId: row.pet_id, token: row.token });
  return { ok: true };
}

export async function guestLogin(name: string, pin: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!supabase) return { ok: false, error: 'MyPetID is offline right now.' };
  const { data, error } = await supabase.rpc('guest_login', { p_name: name, p_pin: pin });
  if (error) return { ok: false, error: friendly(error.message) };
  const row = (Array.isArray(data) ? data[0] : data) as { pet_id: string; token: string };
  save({ petId: row.pet_id, token: row.token });
  return { ok: true };
}

export async function guestLoad(): Promise<GuestPet | null> {
  const saved = savedGuest();
  if (!supabase || !saved) return null;
  const { data, error } = await supabase.rpc('guest_pet', { p_token: saved.token });
  if (error) return null;
  const row = (Array.isArray(data) ? data[0] : data) as GuestPet | undefined;
  if (!row) { save(null); return null; }
  return row;
}

export async function guestUpdate(patch: Partial<Pick<GuestPet, 'name' | 'breed' | 'photo_url' | 'cover_url' | 'medical_public' | 'behavior_public' | 'contact_public' | 'lost_mode' | 'profile'>>): Promise<{ pet?: GuestPet; error?: string }> {
  const saved = savedGuest();
  if (!supabase || !saved) return { error: 'Please log in to your dog’s profile again.' };
  const { data, error } = await supabase.rpc('guest_update_pet', { p_token: saved.token, p_patch: patch });
  if (error) return { error: friendly(error.message) };
  return { pet: (Array.isArray(data) ? data[0] : data) as GuestPet };
}

export function guestLogout() { save(null); }
