"use client";

import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

/**
 * The signed-in owner's cloud pets, shared by the health, poster and sitter panels.
 * When `petId` is given only that pet is loaded (RLS still limits it to the owner).
 */
export type OwnerPet = {
  id: string;
  name: string;
  breed: string | null;
  photo_url: string | null;
  medical_public: string | null;
  behavior_public: string | null;
  contact_public: Record<string, string | null> | null;
  lost_mode: boolean;
  feeding_plan: string | null;
  care_notes: string | null;
  profile: Record<string, any>;
};

const COLUMNS = 'id,name,breed,photo_url,medical_public,behavior_public,contact_public,lost_mode,feeding_plan,care_notes,profile';

export type OwnerPetsState = 'loading' | 'ready' | 'signedOut' | 'noPets' | 'error';

export function useOwnerPets(petId?: string) {
  const [state, setState] = useState<OwnerPetsState>('loading');
  const [me, setMe] = useState('');
  const [pets, setPets] = useState<OwnerPet[]>([]);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setState('signedOut'); setPets([]); return; }
    setMe(session.user.id);
    let query = supabase.from('pets').select(COLUMNS).order('created_at');
    query = petId ? query.eq('id', petId) : query.eq('owner_id', session.user.id);
    const { data, error: loadError } = await query;
    if (loadError) { setState('error'); setError(loadError.message); return; }
    const list = ((data || []) as unknown as OwnerPet[]).map((p) => ({ ...p, profile: p.profile && typeof p.profile === 'object' ? p.profile : {} }));
    setPets(list);
    setSelected((current) => (current && list.some((p) => p.id === current) ? current : list[0]?.id || ''));
    setState(list.length ? 'ready' : 'noPets');
  }, [petId]);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    const timer = window.setTimeout(() => { if (alive) void load(); }, 0);
    const { data } = supabase.auth.onAuthStateChange((event) => { if (alive && (event === 'SIGNED_IN' || event === 'SIGNED_OUT')) void load(); });
    return () => { alive = false; window.clearTimeout(timer); data.subscription.unsubscribe(); };
  }, [load]);

  const pet = pets.find((p) => p.id === selected) || null;
  return { state, me, pets, pet, selected, setSelected, error, reload: load };
}

/** True when PostgREST says the table/function is missing (migration not applied yet). */
export function isMissingRelation(error: { code?: string; message?: string } | null | undefined) {
  return Boolean(error && (error.code === '42P01' || error.code === 'PGRST205' || error.code === 'PGRST202' || /schema cache|does not exist|could not find/i.test(error.message || '')));
}

/** Local 'YYYY-MM-DD' for today (the owner's device day). */
export function todayIso(now = new Date()) {
  const y = now.getFullYear(); const m = String(now.getMonth() + 1).padStart(2, '0'); const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Whole days from today until a 'YYYY-MM-DD' date (negative = past). */
export function daysUntil(isoDate: string, now = new Date()) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const target = Date.UTC(y, (m || 1) - 1, d || 1);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86_400_000);
}

export function formatDay(isoDate: string | null | undefined, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  if (!y) return isoDate;
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString(undefined, options);
}

/** A small pet picker for panels when the owner has more than one dog. */
export function petOptions(pets: OwnerPet[]) {
  return pets.map((p) => ({ value: p.id, label: p.name || 'Unnamed dog' }));
}
