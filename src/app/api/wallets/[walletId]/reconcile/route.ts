import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { reconcileWallet } from '@/modules/wallet';

// POST /api/wallets/[walletId]/reconcile
// Triggers an on-demand reconciliation for a specific wallet.
// Staff only — requires 'wallet.read' permission (reconciliation access).
export async function POST(
  request: NextRequest,
  context: { params: { walletId: string } }
) {
  try {
    const supabase = createClient();
    
    // 1. Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Staff only
    const { data: isStaff } = await supabase.rpc('is_staff');
    if (!isStaff) {
      return NextResponse.json({ error: 'Forbidden: staff access required' }, { status: 403 });
    }

    const { data: hasPermission } = await supabase.rpc('has_permission', {
      p_permission: 'wallet.read',
    });
    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden: wallet.read permission required' }, { status: 403 });
    }

    // 3. Run reconciliation
    const result = await reconcileWallet(context.params.walletId);

    return NextResponse.json(result);

  } catch (error) {
    console.error('[API:reconcile] Error:', error);
    return NextResponse.json(
      { 
        wallet_id: context.params.walletId,
        status: 'error',
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// GET — health check for monitoring
export async function GET() {
  return NextResponse.json({
    endpoint: 'reconcile',
    status: 'active',
    description: 'Trigger on-demand reconciliation for a specific wallet',
    timestamp: new Date().toISOString(),
  });
}
