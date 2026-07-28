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

// PUT /api/admin/products/investments/[productId] — update an investment product
export async function PUT(
  request: NextRequest,
  context: { params: { productId: string } }
) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const authorized = await verifyRole(supabase, ['super_admin', 'operations']);
    if (!authorized) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

    const body = await request.json();
    const serviceClient = createServiceClient();
    const { data: staff } = await supabase.from('staff_users').select('id').eq('auth_id', user.id).maybeSingle();

    const { data: beforeState } = await serviceClient
      .from('investment_products')
      .select('*')
      .eq('id', context.params.productId)
      .maybeSingle();
    if (!beforeState) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

    const { data: product, error } = await serviceClient
      .from('investment_products')
      .update({
        ...body,
        updated_by: staff?.id || user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', context.params.productId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: `Failed to update product: ${error.message}` }, { status: 500 });

    await serviceClient.from('admin_action_log').insert({
      admin_user_id: staff?.id || user.id,
      admin_role: 'operations',
      action: 'update_investment_product',
      action_category: 'product_config',
      entity_type: 'investment_product',
      entity_id: context.params.productId,
      before_state: beforeState,
      after_state: product,
      result: 'success',
    });

    return NextResponse.json({ product });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
