import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { reconcileWithdrawal } from '@/modules/withdrawal';

export async function POST(
  _request: NextRequest,
  { params }: { params: { withdrawalId: string } }
) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Only staff can trigger manual reconciliation
    const { data: isStaff } = await supabase.rpc('is_staff');
    if (!isStaff) {
      return NextResponse.json({ error: 'Staff access required' }, { status: 403 });
    }

    const result = await reconcileWithdrawal(params.withdrawalId);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Reconcile withdrawal error:', error);
    return NextResponse.json({ error: 'Reconciliation failed' }, { status: 500 });
  }
}
