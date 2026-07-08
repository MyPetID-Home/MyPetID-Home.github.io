import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase, userFromBearer } from '../../../../lib/server-integrations';
import { assertTagAllowance, getMembershipSummary } from '../../../../lib/membership';

export const dynamic = 'force-dynamic';

type ActivateBody = { tagCode?: string; petId?: string; claimCode?: string };

function normalizeCode(value: string) { return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, ''); }
function hashClaimCode(value: string) { return createHash('sha256').update(normalizeCode(value)).digest('hex'); }

export async function POST(request: NextRequest) {
  try {
    const { user } = await userFromBearer(request.headers.get('authorization'));
    const body = await request.json() as ActivateBody;
    const tagCode = String(body.tagCode || '').trim().toUpperCase();
    const claimCode = String(body.claimCode || '').trim().toUpperCase();
    if (!tagCode) throw new Error('Enter a Card ID to activate.');
    if (!claimCode) throw new Error('Enter the one-time claim code included with the card.');
    if (!body.petId) throw new Error('Save/select a pet before activating a tag.');
    const supabase = serverSupabase();
    const { data: pet, error: petError } = await supabase.from('pets').select('id,owner_id,name').eq('id', body.petId).single();
    if (petError) throw petError;
    if (pet.owner_id !== user.id) throw new Error('You can only activate tags for your own pet profile.');

    const { data: existing, error: findError } = await supabase.from('tags').select('*').eq('tag_code', tagCode).maybeSingle();
    if (findError) throw findError;
    if (!existing) throw new Error('That Card ID is not minted yet. Admin must create the physical card before activation.');
    if (existing.pet_id || existing.claimed_at) throw new Error('This card has already been claimed. Claim codes are one-time use and cannot be reused.');
    const claimHash = (existing as { claim_code_hash?: string | null }).claim_code_hash;
    if (claimHash && hashClaimCode(claimCode) !== claimHash) throw new Error('Claim code does not match this card. Check the private activation code included with the tag.');
    if (!claimHash) throw new Error('This card is missing claim-code protection. Ask admin to regenerate or migrate it before activation.');

    if (!existing.pet_id) {
      const summary = await getMembershipSummary(supabase, user.id);
      assertTagAllowance(summary);
    }

    const { data, error } = await supabase
      .from('tags')
      .update({ pet_id: body.petId, created_by: user.id, claimed_at: new Date().toISOString(), status: 'claimed' })
      .eq('tag_code', tagCode)
      .select('*')
      .single();
    if (error) throw error;
    const nextSummary = await getMembershipSummary(supabase, user.id);
    return NextResponse.json({ tag: data, membership: nextSummary, petName: pet.name, claimProtected: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Tag activation failed' }, { status: 400 });
  }
}
