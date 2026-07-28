import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

// Helper: verify staff has a specific role
async function verifyRole(supabase: ReturnType<typeof createClient>, roleNames: string[]) {
  for (const role of roleNames) {
    const { data } = await supabase.rpc('has_role', { p_role_name: role });
    if (data) return true;
  }
  return false;
}

// POST /api/admin/products/savings — create a new savings product (admin only)
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const authorized = await verifyRole(supabase, ['super_admin', 'operations']);
    if (!authorized) return NextResponse.json({ error: 'Admin access required (super_admin or operations)' }, { status: 403 });

    const body = await request.json();
    const { product_code, product_name, product_type, interest_rate, interest_calc_method, lock_period_days, min_amount, max_amount, is_withdrawable, description, withdrawal_fee } = body;

    if (!product_code || !product_name || !product_type) {
      return NextResponse.json({ error: 'product_code, product_name, and product_type are required' }, { status: 400 });
    }

    const serviceClient = createServiceClient();

    // Get staff ID for audit
    const { data: staff } = await supabase.from('staff_users').select('id').eq('auth_id', user.id).maybeSingle();

    const { data: product, error } = await serviceClient
      .from('savings_products')
      .insert({
        product_code,
        product_name,
        product_type,
        interest_rate: interest_rate || 0,
        interest_calc_method: interest_calc_method || 'simple',
        lock_period_days: lock_period_days || 0,
        min_amount: min_amount || 0,
        max_amount: max_amount || null,
        is_withdrawable: is_withdrawable !== false,
        withdrawal_fee: withdrawal_fee || 0,
        description: description || '',
        is_active: true,
        created_by: staff?.id || user.id,
        updated_by: staff?.id || user.id,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: `Failed to create product: ${error.message}` }, { status: 500 });

    // Log admin action
    await serviceClient.from('admin_action_log').insert({
      admin_user_id: staff?.id || user.id,
      admin_role: 'super_admin',
      action: 'create_savings_product',
      action_category: 'product_config',
      entity_type: 'savings_product',
      entity_id: product.id,
      after_state: product,
      result: 'success',
      metadata: { product_code },
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    console.error('[API:admin-products-savings-create] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
