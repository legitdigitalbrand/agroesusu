import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { joinCooperative } from '@/modules/cooperative';

export async function POST(
  _request: NextRequest,
  context: { params: { coopId: string } }
) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: customer } = await supabase.from('customers').select('id').eq('auth_id', user.id).maybeSingle();
    if (!customer) return NextResponse.json({ error: 'Customer profile not found' }, { status: 404 });
    const membership = await joinCooperative(context.params.coopId, customer.id);
    return NextResponse.json({ membership }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 400 });
  }
}
