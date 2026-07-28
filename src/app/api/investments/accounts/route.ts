import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { subscribe, listCustomerAccounts } from '@/modules/investments';

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: customer } = await supabase.from('customers').select('id').eq('auth_id', user.id).maybeSingle();
    if (!customer) return NextResponse.json({ error: 'Customer profile not found' }, { status: 404 });

    const body = await request.json();
    const { product_id, wallet_id, amount, tenure_days, accept_risk_disclosure } = body;

    if (!product_id || !wallet_id || !amount) {
      return NextResponse.json({ error: 'product_id, wallet_id, and amount are required' }, { status: 400 });
    }
    if (!accept_risk_disclosure) {
      return NextResponse.json({ error: 'Risk disclosure acceptance is mandatory' }, { status: 400 });
    }

    const ip = request.headers.get('x-forwarded-for') || '';
    const ua = request.headers.get('user-agent') || '';

    const result = await subscribe({
      product_id, customer_id: customer.id, wallet_id, amount: Number(amount),
      tenure_days, accept_risk_disclosure: true, ip_address: ip, user_agent: ua,
    });

    if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ account: result.account, transaction_reference: result.transaction_reference }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: customer } = await supabase.from('customers').select('id').eq('auth_id', user.id).maybeSingle();
    if (!customer) return NextResponse.json({ error: 'Customer profile not found' }, { status: 404 });

    const accounts = await listCustomerAccounts(customer.id);
    return NextResponse.json({ accounts });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
