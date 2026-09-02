import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

// GET /api/beneficiaries — list customer's saved beneficiaries
export async function GET() {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('auth_id', user.id)
      .maybeSingle();

    if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

    const { data: beneficiaries, error } = await supabase
      .from('beneficiaries')
      .select('id, nickname, account_name, account_number, bank_code, bank_name, is_verified, created_at')
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: 'Failed to load beneficiaries' }, { status: 500 });

    return NextResponse.json({ beneficiaries: beneficiaries || [] });
  } catch (error) {
    console.error('[API:beneficiaries] GET Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/beneficiaries — add a new beneficiary
export async function POST(request: NextRequest) {
  const limited = applyRateLimit(request, '/api/beneficiaries', RATE_LIMITS.WITHDRAW);
  if (limited) return limited;

  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { nickname, account_name, account_number, bank_code, bank_name, name_enquiry_session_id } = body;

    if (!account_number || !bank_code || !bank_name) {
      return NextResponse.json({ error: 'Missing required fields: account_number, bank_code, bank_name' }, { status: 400 });
    }

    if (account_number.length !== 10) {
      return NextResponse.json({ error: 'Account number must be 10 digits' }, { status: 400 });
    }

    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('auth_id', user.id)
      .maybeSingle();

    if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

    const { data: existing } = await supabase
      .from('beneficiaries')
      .select('id')
      .eq('customer_id', customer.id)
      .eq('account_number', account_number)
      .eq('bank_code', bank_code)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'This beneficiary already exists' }, { status: 409 });
    }

    const { data: beneficiary, error } = await supabase
      .from('beneficiaries')
      .insert({
        customer_id: customer.id,
        nickname: nickname || account_name,
        account_name,
        account_number,
        bank_code,
        bank_name,
        name_enquiry_session_id,
        is_verified: !!name_enquiry_session_id,
        verification_date: name_enquiry_session_id ? new Date().toISOString() : null,
      })
      .select('id, nickname, account_name, account_number, bank_code, bank_name, is_verified, created_at')
      .single();

    if (error) {
      console.error('[API:beneficiaries] POST Error:', error);
      return NextResponse.json({ error: 'Failed to save beneficiary' }, { status: 500 });
    }

    return NextResponse.json({ beneficiary }, { status: 201 });
  } catch (error) {
    console.error('[API:beneficiaries] POST Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
