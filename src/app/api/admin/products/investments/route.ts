import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

async function verifyRole(supabase: ReturnType<typeof createClient>, roleNames: string[]) {
  for (const role of roleNames) {
    const { data } = await supabase.rpc('has_role', { p_role_name: role });
    if (data) return true;
  }
  return false;
}

// POST /api/admin/products/investments — create a new investment product (admin only)
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const authorized = await verifyRole(supabase, ['super_admin', 'operations']);
    if (!authorized) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

    const body = await request.json();
    const { product_code, product_name, return_guarantee, interest_rate, interest_calc_method, term_days, min_amount, max_amount, management_fee_pct, early_exit_fee_pct, risk_level, requires_cooperative, description } = body;

    if (!product_code || !product_name || !return_guarantee) {
      return NextResponse.json({ error: 'product_code, product_name, and return_guarantee are required' }, { status: 400 });
    }

    const serviceClient = createServiceClient();
    const { data: staff } = await supabase.from('staff_users').select('id').eq('auth_id', user.id).maybeSingle();

    const { data: product, error } = await serviceClient
      .from('investment_products')
      .insert({
        product_code,
        product_name,
        return_guarantee,
        interest_rate: interest_rate || 0,
        interest_calc_method: interest_calc_method || 'simple',
        term_days: term_days || null,
        min_amount: min_amount || 0,
        max_amount: max_amount || null,
        management_fee_pct: management_fee_pct || 0,
        early_exit_fee_pct: early_exit_fee_pct || 0,
        risk_level: risk_level || 'low',
        requires_cooperative: requires_cooperative || false,
        description: description || '',
        is_active: true,
        created_by: staff?.id || user.id,
        updated_by: staff?.id || user.id,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: `Failed to create product: ${error.message}` }, { status: 500 });

    await serviceClient.from('admin_action_log').insert({
      admin_user_id: staff?.id || user.id,
      admin_role: 'super_admin',
      action: 'create_investment_product',
      action_category: 'product_config',
      entity_type: 'investment_product',
      entity_id: product.id,
      after_state: product,
      result: 'success',
      metadata: { product_code },
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
