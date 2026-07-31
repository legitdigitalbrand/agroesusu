import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { voteOnResolution } from '@/modules/cooperative';

// POST /api/cooperatives/[coopId]/resolutions/[resolutionId]/vote
// Cast a vote on a cooperative resolution (yes/no/abstain)
export async function POST(
  request: NextRequest,
  context: { params: { coopId: string; resolutionId: string } }
) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { vote_type } = body;

    if (!['yes', 'no', 'abstain'].includes(vote_type)) {
      return NextResponse.json(
        { error: 'Invalid vote type. Must be yes, no, or abstain.' },
        { status: 400 }
      );
    }

    // Get customer record
    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('auth_id', user.id)
      .maybeSingle();

    if (!customer) {
      return NextResponse.json({ error: 'Customer profile not found' }, { status: 404 });
    }

    // Get active membership
    const { data: membership } = await supabase
      .from('cooperative_memberships')
      .select('id')
      .eq('cooperative_id', context.params.coopId)
      .eq('customer_id', customer.id)
      .eq('status', 'active')
      .maybeSingle();

    if (!membership) {
      return NextResponse.json(
        { error: 'Not an active member of this cooperative' },
        { status: 403 }
      );
    }

    await voteOnResolution(
      context.params.coopId,
      context.params.resolutionId,
      membership.id,
      vote_type,
    );

    return NextResponse.json({ success: true, message: 'Vote cast successfully' });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 400 }
    );
  }
}
