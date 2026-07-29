import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { joinGroupSavings } from '@/modules/cooperative';

export async function POST(
  _request: NextRequest,
  context: { params: { accountId: string } }
) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: customer } = await supabase.from('customers').select('id').eq('auth_id', user.id).maybeSingle();
    if (!customer) return NextResponse.json({ error: 'Customer profile not found' }, { status: 404 });

    // Check if customer has a cooperative membership (for cooperative-required products)
    const { data: coopMembership } = await supabase
      .from('cooperative_memberships')
      .select('id')
      .eq('customer_id', customer.id)
      .eq('status', 'active')
      .maybeSingle();

    const membership = await joinGroupSavings(context.params.accountId, customer.id, coopMembership?.id);
    return NextResponse.json({ membership }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 400 });
  }
}
