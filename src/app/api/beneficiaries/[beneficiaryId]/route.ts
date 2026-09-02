import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// DELETE /api/beneficiaries/[beneficiaryId] — remove a saved beneficiary
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { beneficiaryId: string } }
) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('auth_id', user.id)
      .maybeSingle();

    if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

    const { error } = await supabase
      .from('beneficiaries')
      .delete()
      .eq('id', params.beneficiaryId)
      .eq('customer_id', customer.id);

    if (error) {
      return NextResponse.json({ error: 'Failed to delete beneficiary' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API:beneficiaries] DELETE Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
