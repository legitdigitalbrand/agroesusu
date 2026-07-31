import { NextRequest, NextResponse } from 'next/server';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { applyForLoan, listCustomerLoans } from '@/modules/loans';

// POST /api/loans — apply for a loan
export async function POST(request: NextRequest) {
  const limited = applyRateLimit(request, "/api/loans", RATE_LIMITS.LOAN);
  if (limited) return limited;
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { product_id, requested_amount, term_months } = body;

    if (!product_id || !requested_amount) {
      return NextResponse.json({ error: 'product_id and requested_amount are required' }, { status: 400 });
    }

    const { data: isStaff } = await supabase.rpc('is_staff');
    let customerId: string;
    let walletId: string;

    if (isStaff && body.customer_id) {
      const serviceClient = createServiceClient();
      const { data: customer } = await serviceClient.from('customers').select('id').eq('id', body.customer_id).single();
      if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
      customerId = customer.id;
      const { data: wallet } = await serviceClient.from('wallets').select('id').eq('customer_id', customerId).eq('status', 'active').limit(1).single();
      if (!wallet) return NextResponse.json({ error: 'No active wallet' }, { status: 400 });
      walletId = wallet.id;
    } else {
      const { data: customer } = await supabase.from('customers').select('id').eq('auth_id', user.id).maybeSingle();
      if (!customer) return NextResponse.json({ error: 'Customer profile not found' }, { status: 404 });
      customerId = customer.id;
      const { data: wallet } = await supabase.from('wallets').select('id').eq('customer_id', customerId).eq('status', 'active').limit(1).maybeSingle();
      if (!wallet) return NextResponse.json({ error: 'No active wallet' }, { status: 400 });
      walletId = wallet.id;
    }

    const result = await applyForLoan({
      customer_id: customerId,
      wallet_id: walletId,
      product_id,
      requested_amount: Number(requested_amount),
      term_months: term_months ? Number(term_months) : undefined,
    });

    return NextResponse.json(result, { status: result.eligibility_decision === 'denied' ? 422 : 201 });
  } catch (error) {
    console.error('[API:loans-apply] Error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}

// GET /api/loans — list customer's loans
export async function GET() {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: customer } = await supabase.from('customers').select('id').eq('auth_id', user.id).maybeSingle();
    if (!customer) {
      const { data: isStaff } = await supabase.rpc('is_staff');
      if (!isStaff) return NextResponse.json({ error: 'Customer profile not found' }, { status: 404 });
      const serviceClient = createServiceClient();
      const { data: loans } = await serviceClient.from('loans').select('*').order('created_at', { ascending: false });
      return NextResponse.json({ loans: loans || [] });
    }

    const loans = await listCustomerLoans(customer.id);
    return NextResponse.json({ loans });
  } catch (error) {
    console.error('[API:loans-list] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
