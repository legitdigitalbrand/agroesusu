import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

// GET /api/wallets/[walletId]/transactions
// Returns paginated transaction history for a wallet.
// Customer: can only see their own wallet (RLS enforced).
// Staff: needs 'wallet.read' permission.
// Query params: page, limit, status, direction, from, to
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
        const { data: walletExists } = await serviceClient
          .from('wallets')
          .select('customer_id')
          .eq('id', context.params.walletId)
          .maybeSingle();

        if (!walletExists) {
          return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
        }
        return NextResponse.json({ error: 'Forbidden: not your wallet' }, { status: 403 });
      }
    }

    // 3. Parse query params
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const status = searchParams.get('status'); // pending, confirmed, failed, reversed
    const direction = searchParams.get('direction'); // credit, debit
    const from = searchParams.get('from'); // ISO date
    const to = searchParams.get('to'); // ISO date

    // 4. Build query
    const client = isStaff ? serviceClient : supabase;
    const offset = (page - 1) * limit;

    let query = client
      .from('wallet_transactions')
      .select('*', { count: 'exact' })
      .eq('wallet_id', context.params.walletId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq('status', status);
    if (direction) query = query.eq('direction', direction);
    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to);

    const { data: transactions, error: txError, count } = await query;

    if (txError) {
      console.error('[API:wallet-transactions] Query error:', txError);
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }

    const total = count || 0;
    const total_pages = Math.ceil(total / limit);

    return NextResponse.json({
      transactions: transactions || [],
      pagination: {
        page,
        limit,
        total,
        total_pages,
      },
    });

  } catch (error) {
    console.error('[API:wallet-transactions] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
