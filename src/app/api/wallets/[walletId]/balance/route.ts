import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

// GET /api/wallets/[walletId]/balance
// Returns the current cached balance for a wallet.
// Customer: can only see their own wallet (RLS enforced).
// Staff: needs 'wallet.read' permission.
export async function GET(
  request: NextRequest,
  context: { params: { walletId: string } }
) {
  try {
    const supabase = createClient();
    const serviceClient = createServiceClient();
    
    // 1. Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Check if staff
    const { data: isStaff } = await supabase.rpc('is_staff');

    if (isStaff) {
      // Staff: check wallet.read permission
      const { data: hasPermission } = await supabase.rpc('has_permission', {
        p_permission: 'wallet.read',
      });
      if (!hasPermission) {
        return NextResponse.json({ error: 'Forbidden: wallet.read permission required' }, { status: 403 });
      }
    } else {
      // Customer: verify wallet belongs to them
      const { data: wallet } = await supabase
        .from('wallets')
        .select('id')
        .eq('id', context.params.walletId)
        .maybeSingle();

      if (!wallet) {
        // Check via service client if it exists at all
        const { data: walletExists } = await serviceClient
          .from('wallets')
          .select('customer_id')
          .eq('id', context.params.walletId)
          .maybeSingle();

        if (!walletExists) {
          return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
        }

        // RLS blocked — wallet exists but doesn't belong to customer
        return NextResponse.json({ error: 'Forbidden: not your wallet' }, { status: 403 });
      }
    }

    // 3. Fetch wallet balance (use service client for staff to bypass RLS)
    const client = isStaff ? serviceClient : supabase;
    const { data: wallet, error } = await client
      .from('wallets')
      .select(`
        id, wallet_number, cached_balance, cached_available_balance,
        cached_ledger_balance, reserved_balance, cached_balance_updated_at,
        status, currency
      `)
      .eq('id', context.params.walletId)
      .single();

    if (error || !wallet) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }

    return NextResponse.json({
      wallet_id: wallet.id,
      wallet_number: wallet.wallet_number,
      cached_balance: Number(wallet.cached_balance),
      cached_available_balance: Number(wallet.cached_available_balance),
      cached_ledger_balance: Number(wallet.cached_ledger_balance),
      reserved_balance: Number(wallet.reserved_balance),
      currency: 'NGN',
      last_updated: wallet.cached_balance_updated_at,
      status: wallet.status,
    });

  } catch (error) {
    console.error('[API:wallet-balance] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
