import { supabase } from './supabase';

// Public pet profile + finder report access.
//
// After docs/migrations/2026-10-security-hardening.sql, pets/tags/scan_events are
// not publicly readable/insertable and the app uses the get_public_pet and
// submit_finder_report RPCs. Until that SQL has been applied the RPCs do not exist
// (PostgREST error PGRST202), so these helpers fall back to the old direct queries.
// The fallback can be deleted once the migration is live.

export type PublicPet = {
  id: string;
  name: string;
  species?: string | null;
  breed: string | null;
  photo_url: string | null;
  medical_public: string | null;
  behavior_public: string | null;
  contact_public?: Record<string, unknown> | null;
  lost_mode: boolean;
  tag_id: string | null;
  tag_code: string | null;
  is_owner: boolean;
  // Added by 2026-10-pet-profiles-guest.sql
  cover_url?: string | null;
  public_extra?: { details?: Record<string, string>; vet?: Record<string, string>; care?: Record<string, string> } | null;
  last_seen_at?: string | null;
  last_seen_lat?: number | null;
  last_seen_lng?: number | null;
};

export type FinderReport = {
  p_tag_code: string;
  p_latitude: number;
  p_longitude: number;
  p_accuracy_meters: number | null;
  p_reported_lost: boolean;
  p_note: string | null;
  p_finder_note: string | null;
  p_finder_contact: string | null;
};

const PUBLIC_COLUMNS = 'id,name,breed,photo_url,medical_public,behavior_public,contact_public,lost_mode';

function rpcMissing(error: { code?: string; message?: string } | null) {
  return Boolean(error && (error.code === 'PGRST202' || /could not find the function/i.test(error.message || '')));
}

async function currentUserId() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

async function legacyFetch(tagCode: string, petId: string): Promise<PublicPet | null> {
  if (!supabase) return null;
  type LegacyPet = Omit<PublicPet, 'tag_id' | 'tag_code' | 'is_owner'> & { owner_id?: string | null };
  let pet: LegacyPet | null = null;
  let tagId: string | null = null;
  if (petId) {
    const { data } = await supabase.from('pets').select(`${PUBLIC_COLUMNS},owner_id`).eq('id', petId).maybeSingle();
    pet = (data as LegacyPet | null) ?? null;
  } else if (tagCode) {
    const { data } = await supabase.from('tags').select(`id,pet:pets(${PUBLIC_COLUMNS},owner_id)`).eq('tag_code', tagCode).maybeSingle();
    const record = data as { id: string; pet: LegacyPet | LegacyPet[] | null } | null;
    const loaded = record?.pet;
    pet = (Array.isArray(loaded) ? loaded[0] : loaded) ?? null;
    tagId = record?.id ?? null;
  }
  if (!pet) return null;
  const userId = await currentUserId();
  const { owner_id: ownerId, ...publicFields } = pet;
  return { ...publicFields, tag_id: tagId, tag_code: tagId ? tagCode : null, is_owner: Boolean(userId && ownerId === userId) };
}

export async function fetchPublicPet(options: { tagCode?: string; petId?: string }): Promise<PublicPet | null> {
  if (!supabase) return null;
  const tagCode = options.tagCode || '';
  const petId = options.petId || '';
  const { data, error } = await supabase.rpc('get_public_pet', petId ? { p_pet_id: petId } : { p_tag_code: tagCode });
  if (rpcMissing(error)) return legacyFetch(tagCode, petId);
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return (row as PublicPet | undefined) ?? null;
}

// Returns an error message, or null on success.
export async function submitFinderReport(report: FinderReport, legacy: { tagId: string | null; petId: string | null }): Promise<string | null> {
  if (!supabase) return 'Cloud services are not configured.';
  const { error } = await supabase.rpc('submit_finder_report', report);
  if (!rpcMissing(error)) return error ? error.message : null;
  const { error: insertError } = await supabase.from('scan_events').insert({
    tag_id: legacy.tagId,
    pet_id: legacy.petId,
    actor: 'stranger',
    latitude: report.p_latitude,
    longitude: report.p_longitude,
    accuracy_meters: report.p_accuracy_meters,
    reported_lost: report.p_reported_lost,
    note: report.p_note,
    finder_note: report.p_finder_note,
    finder_contact: report.p_finder_contact,
    found_status: report.p_reported_lost ? 'Found report received' : 'scan_only',
    owner_follow_up: report.p_reported_lost ? 'Needs owner review' : 'not_required',
  });
  return insertError ? insertError.message : null;
}
