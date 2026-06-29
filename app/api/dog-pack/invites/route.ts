import { NextRequest, NextResponse } from 'next/server';
import { appBaseUrl, serverSupabase, userFromBearer } from '../../../../lib/server-integrations';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { user } = await userFromBearer(request.headers.get('authorization'));
    const body = await request.json() as { petId?: string; maxUses?: number };
    const supabase = serverSupabase();
    const { data, error } = await supabase.from('dog_pack_invites').insert({
      inviter_profile_id: user.id,
      inviter_pet_id: body.petId || null,
      max_uses: body.maxUses || 1,
      metadata: { created_from: 'dashboard' },
    }).select('*').single();
    if (error) throw error;
    const inviteUrl = `${appBaseUrl}/dashboard/pack/?invite=${data.invite_code}`;
    await supabase.from('dog_pack_invites').update({ invite_url: inviteUrl }).eq('id', data.id);
    return NextResponse.json({ inviteCode: data.invite_code, inviteUrl });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Invite failed' }, { status: 400 });
  }
}
