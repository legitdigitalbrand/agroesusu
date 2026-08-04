import { NextRequest, NextResponse } from 'next/server';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { openCustomPot, deposit } from '@/modules/savings';

// POST /api/savings/pots — create a custom savings pot
// Body: {
//   pot_name: string,
//   pot_icon?: string,
//   pot_color?: string,
//   lock_type: 'flexible' | 'locked',
//   lock_until_date?: string | null,
//   target_amount?: number,
//   initial_deposit?: number,
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
      pot_icon,
      pot_color,
      lock_type,
      lock_until_date,
      target_amount,
      initial_deposit,
    } = body;

    // Validate
    if (!pot_name || pot_name.trim().length < 2) {
      return NextResponse.json(
        { error: 'Pot name must be at least 2 characters' },
        { status: 400 }
      );
    }

    if (lock_type === 'locked' && !lock_until_date) {
      return NextResponse.json(
        { error: 'Locked pots require a lock-until date' },
        { status: 400 }
      );
    }

    if (lock_until_date) {
      const lockDate = new Date(lock_until_date);
      if (lockDate.getTime() <= Date.now()) {
        return NextResponse.json(
          { error: 'Lock date must be in the future' },
          { status: 400 }
        );
      }
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

    // Find the Custom Pot product
    const serviceClient = createServiceClient();
    const { data: product } = await serviceClient
      .from('savings_products')
      .select('id')
      .eq('product_code', 'CUSTOM-POT')
      .eq('is_active', true)
      .maybeSingle();

    if (!product) {
      return NextResponse.json(
        { error: 'Custom Pot product is not configured. Run migration 00042.' },
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

    // Create the pot
    const account = await openCustomPot({
      customer_id: customer.id,
      wallet_id: wallet.id,
      product_id: product.id,
      pot_name: pot_name.trim(),
      pot_icon: pot_icon || 'piggybank',
      pot_color: pot_color || 'indigo',
      lock_type: lock_type || 'flexible',
      lock_until_date: lock_until_date || null,
      target_amount: target_amount || undefined,
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
            warning: `Pot created but initial deposit failed: ${depositResult.error}`,
          }, { status: 201 });
        }
      } catch (depErr) {
        console.error('[API:savings-pots] Initial deposit error:', depErr);
        return NextResponse.json({
          account,
          warning: 'Pot created but initial deposit failed — please deposit manually',
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
