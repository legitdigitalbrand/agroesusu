import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { openAccount, listCustomerAccounts } from '@/modules/savings';

// POST /api/savings/accounts — open a new savings account
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { product_id, target_amount, initial_deposit } = body;

    if (!product_id) {
      return NextResponse.json({ error: 'product_id is required' }, { status: 400 });
    }

    // Get customer's wallet
    const { data: isStaff } = await supabase.rpc('is_staff');
    let customerId: string;
    let walletId: string;

    if (isStaff) {
      // Staff can open accounts for customers — requires customer_id in body
      if (!body.customer_id) {
        return NextResponse.json({ error: 'customer_id is required for staff' }, { status: 400 });
      }
      customerId = body.customer_id;
      const serviceClient = createServiceClient();
      const { data: wallet } = await serviceClient
        .from('wallets')
        .select('id')
        .eq('customer_id', customerId)
        .eq('status', 'active')
        .limit(1)
        .single();
      if (!wallet) return NextResponse.json({ error: 'No active wallet found for customer' }, { status: 400 });
      walletId = wallet.id;
    } else {
      // Customer opening for themselves
      const { data: customer } = await supabase
        .from('customers')
        .select('id')
        .eq('auth_id', user.id)
        .single();
      if (!customer) return NextResponse.json({ error: 'Customer profile not found' }, { status: 404 });
      customerId = customer.id;

      const { data: wallet } = await supabase
        .from('wallets')
        .select('id')
        .eq('customer_id', customerId)
        .eq('status', 'active')
        .limit(1)
        .single();
      if (!wallet) return NextResponse.json({ error: 'No active wallet found' }, { status: 400 });
      walletId = wallet.id;
    }

    const account = await openAccount({
      customer_id: customerId,
      wallet_id: walletId,
      product_id,
      target_amount,
      initial_deposit,
    });

    return NextResponse.json({ account }, { status: 201 });

  } catch (error) {
    console.error('[API:savings-accounts] Error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}

// GET /api/savings/accounts — list customer's savings accounts
export async function GET(_request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('auth_id', user.id)
      .maybeSingle();

    if (!customer) {
      // Staff can list all or filter
      const { data: isStaff } = await supabase.rpc('is_staff');
      if (!isStaff) return NextResponse.json({ error: 'Customer profile not found' }, { status: 404 });
      
      const serviceClient = createServiceClient();
      const { data: accounts } = await serviceClient
        .from('savings_accounts')
        .select('*')
        .order('created_at', { ascending: false });
      return NextResponse.json({ accounts: accounts || [] });
    }

    const accounts = await listCustomerAccounts(customer.id);
    return NextResponse.json({ accounts });

  } catch (error) {
    console.error('[API:savings-accounts] GET Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
