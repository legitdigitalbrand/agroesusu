import { NextRequest, NextResponse } from 'next/server';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { openAccount, deposit } from '@/modules/savings';

// POST /api/savings/pots — create a Flexible Savings account with goal tracking
// This is a backwards-compatible wrapper around /api/savings/accounts
// Body: {
//   pot_name: string,          — required, max 50 chars
//   target_amount: number,     — required, > 0
//   target_date?: string,      — optional ISO date
//   monthly_target?: number,   — optional, > 0
//   initial_deposit?: number,  — optional
// }
export async function POST(request: NextRequest) {
  const limited = applyRateLimit(request, "/api/savings/pots", RATE_LIMITS.SAVINGS);
  if (limited) return limited;
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      pot_name,
      target_amount,
      target_date,
      monthly_target,
      initial_deposit,
    } = body;

    // Validate pot_name
    if (!pot_name || pot_name.trim().length < 2) {
      return NextResponse.json(
        { error: 'Pot name must be at least 2 characters' },
        { status: 400 }
      );
    }
    if (pot_name.length > 50) {
      return NextResponse.json(
        { error: 'Pot name must be 50 characters or fewer' },
        { status: 400 }
      );
    }

    // Validate target_amount (required per spec)
    if (!target_amount || target_amount <= 0) {
      return NextResponse.json(
        { error: 'Target amount is required and must be greater than zero' },
        { status: 400 }
      );
    }

    // Validate target_date (optional, but if provided must be in the future)
    if (target_date) {
      const d = new Date(target_date);
      if (d.getTime() <= Date.now()) {
        return NextResponse.json(
          { error: 'Target date must be in the future' },
          { status: 400 }
        );
      }
    }

    // Validate monthly_target (optional)
    if (monthly_target !== undefined && monthly_target !== null && monthly_target <= 0) {
      return NextResponse.json(
        { error: 'Monthly target must be greater than zero' },
        { status: 400 }
      );
    }

    // Get customer and wallet
    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('auth_id', user.id)
      .maybeSingle();

    if (!customer) {
      return NextResponse.json({ error: 'Customer profile not found' }, { status: 404 });
    }

    const { data: wallet } = await supabase
      .from('wallets')
      .select('id')
      .eq('customer_id', customer.id)
      .eq('status', 'active')
      .maybeSingle();

    if (!wallet) {
      return NextResponse.json({ error: 'No active wallet found' }, { status: 400 });
    }

    // Find the FLEX product
    const serviceClient = createServiceClient();
    const { data: product } = await serviceClient
      .from('savings_products')
      .select('id')
      .eq('product_code', 'FLEX')
      .eq('is_active', true)
      .maybeSingle();

    if (!product) {
      return NextResponse.json(
        { error: 'Flexible Savings product is not configured.' },
        { status: 500 }
      );
    }

    // Check wallet balance for initial deposit
    if (initial_deposit && initial_deposit > 0) {
      const { data: walletData } = await serviceClient
        .from('wallets')
        .select('available_balance')
        .eq('id', wallet.id)
        .single();

      if (walletData && walletData.available_balance < initial_deposit) {
        return NextResponse.json(
          { error: `Insufficient wallet balance. Available: ₦${walletData.available_balance.toLocaleString()}` },
          { status: 400 }
        );
      }
    }

    // Create a Flexible Savings account with goal tracking enabled
    const account = await openAccount({
      customer_id: customer.id,
      wallet_id: wallet.id,
      product_id: product.id,
      goal_enabled: true,
      goal_amount: target_amount,
      goal_date: target_date || null,
      monthly_target: monthly_target || null,
      nickname: pot_name.trim(),
      initial_deposit: initial_deposit || undefined,
    });

    // Process initial deposit if provided
    if (initial_deposit && initial_deposit > 0) {
      try {
        const depositResult = await deposit({
          savings_account_id: account.id,
          wallet_id: wallet.id,
          amount: initial_deposit,
          description: `Initial deposit to ${pot_name}`,
        });
        if (!depositResult.success) {
          return NextResponse.json({
            account,
            warning: `Account created but initial deposit failed: ${depositResult.error}`,
          }, { status: 201 });
        }
      } catch (depErr) {
        console.error('[API:savings-pots] Initial deposit error:', depErr);
        return NextResponse.json({
          account,
          warning: 'Account created but initial deposit failed — please deposit manually',
        }, { status: 201 });
      }
    }

    return NextResponse.json({ account }, { status: 201 });

  } catch (error) {
    console.error('[API:savings-pots] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
