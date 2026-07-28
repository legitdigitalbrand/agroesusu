import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

async function verifySuperAdmin(supabase: ReturnType<typeof createClient>) {
  const { data } = await supabase.rpc('has_role', { p_role_name: 'super_admin' });
  return !!data;
}

// GET /api/admin/staff/[staffId] — get staff user details
export async function GET(
  _request: NextRequest,
  context: { params: { staffId: string } }
) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const isSuperAdmin = await verifySuperAdmin(supabase);
    if (!isSuperAdmin) return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });

    const serviceClient = createServiceClient();
    const { data: staff } = await serviceClient
      .from('staff_users')
      .select('*')
      .eq('id', context.params.staffId)
      .maybeSingle();
    if (!staff) return NextResponse.json({ error: 'Staff user not found' }, { status: 404 });

    const { data: roles } = await serviceClient
      .from('staff_role_assignments')
      .select('id, status, assigned_at, expires_at, roles(id, name)')
      .eq('staff_id', context.params.staffId)
      .order('assigned_at', { ascending: false });

    return NextResponse.json({ staff, role_assignments: roles || [] });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/admin/staff/[staffId] — update staff user (deactivate, update info)
export async function PUT(
  request: NextRequest,
  context: { params: { staffId: string } }
) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const isSuperAdmin = await verifySuperAdmin(supabase);
    if (!isSuperAdmin) return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });

    const body = await request.json();
    const serviceClient = createServiceClient();
    const { data: adminStaff } = await supabase.from('staff_users').select('id').eq('auth_id', user.id).maybeSingle();

    const { data: beforeState } = await serviceClient
      .from('staff_users')
      .select('*')
      .eq('id', context.params.staffId)
      .maybeSingle();
    if (!beforeState) return NextResponse.json({ error: 'Staff user not found' }, { status: 404 });

    // Only allow updating safe fields
    const updates: Record<string, unknown> = {};
    if (body.full_name !== undefined) updates.full_name = body.full_name;
    if (body.phone !== undefined) updates.phone = body.phone;
    if (body.department !== undefined) updates.department = body.department;
    if (body.is_active !== undefined) updates.is_active = body.is_active;
    if (body.employment_status !== undefined) updates.employment_status = body.employment_status;
    updates.updated_at = new Date().toISOString();

    const { data: updatedStaff, error } = await serviceClient
      .from('staff_users')
      .update(updates)
      .eq('id', context.params.staffId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: `Failed to update staff: ${error.message}` }, { status: 500 });

    await serviceClient.from('admin_action_log').insert({
      admin_user_id: adminStaff?.id || user.id,
      admin_role: 'super_admin',
      action: 'update_staff_user',
      action_category: 'rbac_management',
      entity_type: 'staff_user',
      entity_id: context.params.staffId,
      before_state: beforeState,
      after_state: updatedStaff,
      result: 'success',
    });

    return NextResponse.json({ staff: updatedStaff });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/admin/staff/[staffId] — deactivate a staff user (soft delete)
export async function DELETE(
  _request: NextRequest,
  context: { params: { staffId: string } }
) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const isSuperAdmin = await verifySuperAdmin(supabase);
    if (!isSuperAdmin) return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });

    const serviceClient = createServiceClient();
    const { data: adminStaff } = await supabase.from('staff_users').select('id').eq('auth_id', user.id).maybeSingle();

    // Don't allow self-deactivation
    if (context.params.staffId === adminStaff?.id) {
      return NextResponse.json({ error: 'Cannot deactivate your own account' }, { status: 400 });
    }

    const { data: beforeState } = await serviceClient
      .from('staff_users')
      .select('*')
      .eq('id', context.params.staffId)
      .maybeSingle();
    if (!beforeState) return NextResponse.json({ error: 'Staff user not found' }, { status: 404 });

    // Soft delete: set is_active = false, employment_status = 'terminated'
    const { data: updatedStaff, error } = await serviceClient
      .from('staff_users')
      .update({
        is_active: false,
        employment_status: 'terminated',
        updated_at: new Date().toISOString(),
      })
      .eq('id', context.params.staffId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: `Failed to deactivate staff: ${error.message}` }, { status: 500 });

    // Also revoke all active role assignments
    await serviceClient
      .from('staff_role_assignments')
      .update({
        status: 'revoked',
        revoked_at: new Date().toISOString(),
        revoke_reason: 'Staff account deactivated',
      })
      .eq('staff_id', context.params.staffId)
      .eq('status', 'active');

    await serviceClient.from('admin_action_log').insert({
      admin_user_id: adminStaff?.id || user.id,
      admin_role: 'super_admin',
      action: 'deactivate_staff_user',
      action_category: 'rbac_management',
      entity_type: 'staff_user',
      entity_id: context.params.staffId,
      before_state: beforeState,
      after_state: updatedStaff,
      result: 'success',
    });

    return NextResponse.json({ success: true, staff: updatedStaff });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
