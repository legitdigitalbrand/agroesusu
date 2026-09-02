import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { castVote } from '@/modules/cooperative';

export async function POST(
  request: NextRequest,
  context: { params: { coopId: string; electionId: string } }
) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { candidate_membership_id, vote_type } = body;

    // Get customer's cooperative membership
    const { data: customer } = await supabase.from('customers').select('id').eq('auth_id', user.id).maybeSingle();
    if (!customer) return NextResponse.json({ error: 'Customer profile not found' }, { status: 404 });

    const { data: membership } = await supabase
      .from('cooperative_memberships')
      .select('id')
      .eq('cooperative_id', context.params.coopId)
      .eq('customer_id', customer.id)
      .eq('status', 'active')
      .maybeSingle();
    if (!membership) return NextResponse.json({ error: 'Not an active member of this cooperative' }, { status: 403 });

    const vote = await castVote(
      context.params.coopId,
      context.params.electionId,
      membership.id,
      vote_type || 'yes',
      candidate_membership_id,
    );
    return NextResponse.json({ vote }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'An error occurred. Please try again or contact support.' }, { status: 400 });
  }
}
