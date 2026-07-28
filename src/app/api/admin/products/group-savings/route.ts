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

// POST /api/admin/products/group-savings — create a new group savings product (admin only)
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const authorized = await verifyRole(supabase, ['super_admin', 'operations']);
    if (!authorized) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

    const body = await request.json();
    const { product_code, product_name, group_type, contribution_frequency, min_contribution, max_contribution, description } = body;

    if (!product_code || !product_name || !group_type) {
      return NextResponse.json({ error: 'product_code, product_name, and group_type are required' }, { status: 400 });
    }

    const serviceClient = createServiceClient();
    const { data: staff } = await supabase.from('staff_users').select('id').eq('auth_id', user.id).maybeSingle();

    const { data: product, error } = await serviceClient
      .from('group_savings_products')
      .insert({
        product_code,
        product_name,
        group_type,
        contribution_frequency: contribution_frequency || 'monthly',
        min_contribution: min_contribution || 0,
        max_contribution: max_contribution || null,
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
      action: 'create_group_savings_product',
      action_category: 'product_config',
      entity_type: 'group_savings_product',
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
