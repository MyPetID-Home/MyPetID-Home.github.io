import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase, userFromBearer } from '../../../../lib/server-integrations';
import { assertTagAllowance, getMembershipSummary } from '../../../../lib/membership';

export const dynamic = 'force-dynamic';

type ActivateBody = { tagCode?: string; petId?: string };

export async function POST(request: NextRequest) {
  try {
    const { user } = await userFromBearer(request.headers.get('authorization'));
    const body = await request.json() as ActivateBody;
    const tagCode = String(body.tagCode || '').trim();
    if (!tagCode) throw new Error('Enter a tag code to activate.');
    if (!body.petId) throw new Error('Save/select a pet before activating a tag.');
    const supabase = serverSupabase();
    const { data: pet, error: petError } = await supabase.from('pets').select('id,owner_id,name').eq('id', body.petId).single();
    if (petError) throw petError;
    if (pet.owner_id !== user.id) throw new Error('You can only activate tags for your own pet profile.');

    const { data: existing, error: findError } = await supabase.from('tags').select('*').eq('tag_code', tagCode).maybeSingle();
    if (findError) throw findError;
    if (!existing) throw new Error('That tag code is not minted yet. Admin must create the physical tag code before activation.');
    if (existing.pet_id && existing.pet_id !== body.petId) throw new Error('That tag code is already linked to another pet.');

    if (!existing.pet_id) {
      const summary = await getMembershipSummary(supabase, user.id);
      assertTagAllowance(summary);
    }

    const { data, error } = await supabase
      .from('tags')
      .update({ pet_id: body.petId, created_by: user.id, claimed_at: new Date().toISOString() })
      .eq('tag_code', tagCode)
      .select('*')
      .single();
    if (error) throw error;
    const nextSummary = await getMembershipSummary(supabase, user.id);
    return NextResponse.json({ tag: data, membership: nextSummary, petName: pet.name });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Tag activation failed' }, { status: 400 });
  }
}
