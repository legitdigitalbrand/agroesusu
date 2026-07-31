import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { evaluateEligibility, getProduct } from '@/modules/loans';

// GET /api/loans/eligibility?product_id=xxx
// Returns the customer's actual loan eligibility for a specific product.
// The eligibility is calculated server-side using the approved business rules.
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('product_id');

    if (!productId) {
      return NextResponse.json({ error: 'product_id query parameter is required' }, { status: 400 });
    }

    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('auth_id', user.id)
      .maybeSingle();

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const { data: wallet } = await supabase
      .from('wallets')
      .select('id')
      .eq('customer_id', customer.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    if (!wallet) {
      return NextResponse.json({ error: 'No active wallet' }, { status: 400 });
    }

    // Get product to find max amount for eligibility check
    const product = await getProduct(productId);
    if (!product) {
      return NextResponse.json({ error: 'Loan product not found' }, { status: 404 });
    }

    // Evaluate eligibility with the product's max amount as the requested amount
    const result = await evaluateEligibility({
      customer_id: customer.id,
      wallet_id: wallet.id,
      product_id: productId,
      requested_amount: Number(product.max_amount) || 500000,
      term_months: Number(product.default_term_months) || 3,
    });

    return NextResponse.json(result);

  } catch (error) {
    console.error('[API:loan-eligibility] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
