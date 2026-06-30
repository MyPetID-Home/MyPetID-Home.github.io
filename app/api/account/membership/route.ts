import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase, userFromBearer } from '../../../../lib/server-integrations';
import { getMembershipSummary } from '../../../../lib/membership';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { user } = await userFromBearer(request.headers.get('authorization'));
    const summary = await getMembershipSummary(serverSupabase(), user.id);
    return NextResponse.json({ membership: summary });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Membership lookup failed' }, { status: 400 });
  }
}
