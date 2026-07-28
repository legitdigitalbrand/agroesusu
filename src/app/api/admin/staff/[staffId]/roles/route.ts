import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

async function verifySuperAdmin(supabase: ReturnType<typeof createClient>) {
  const { data } = await supabase.rpc('has_role', { p_role_name: 'super_admin' });
  return !!data;
}

// GET /api/admin/staff/[staffId]/roles — list role assignments for a staff member
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
    const { data: assignments } = await serviceClient
      .from('staff_role_assignments')
      .select('id, status, assigned_at, expires_at, revoked_at, revoke_reason, roles(id, name)')
      .eq('staff_id', context.params.staffId)
      .order('assigned_at', { ascending: false });

    return NextResponse.json({ role_assignments: assignments || [] });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/admin/staff/[staffId]/roles — assign a role to a staff member
export async function POST(
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
    const { role_name, expires_at } = body;

    if (!role_name) return NextResponse.json({ error: 'role_name is required' }, { status: 400 });

    const serviceClient = createServiceClient();
    const { data: adminStaff } = await supabase.from('staff_users').select('id').eq('auth_id', user.id).maybeSingle();

    // Verify staff user exists
    const { data: staffExists } = await serviceClient
      .from('staff_users')
      .select('id, full_name')
      .eq('id', context.params.staffId)
      .maybeSingle();
    if (!staffExists) return NextResponse.json({ error: 'Staff user not found' }, { status: 404 });

    // Verify role exists
    const { data: role } = await serviceClient
      .from('roles')
      .select('id, name')
      .eq('name', role_name)
      .maybeSingle();
    if (!role) return NextResponse.json({ error: `Role '${role_name}' not found` }, { status: 400 });

    // Check if already has this role active
    const { data: existing } = await serviceClient
      .from('staff_role_assignments')
      .select('id')
      .eq('staff_id', context.params.staffId)
      .eq('role_id', role.id)
      .eq('status', 'active')
      .maybeSingle();
    if (existing) return NextResponse.json({ error: 'Staff already has this role' }, { status: 409 });

    const { data: assignment, error } = await serviceClient
      .from('staff_role_assignments')
      .insert({
        staff_id: context.params.staffId,
        role_id: role.id,
        status: 'active',
        assigned_by: adminStaff?.id || user.id,
        expires_at: expires_at || null,
      })
      .select('id, status, assigned_at, expires_at, roles(id, name)')
      .single();

    if (error) return NextResponse.json({ error: `Failed to assign role: ${error.message}` }, { status: 500 });

    await serviceClient.from('admin_action_log').insert({
      admin_user_id: adminStaff?.id || user.id,
      admin_role: 'super_admin',
      action: 'assign_role',
      action_category: 'rbac_management',
      entity_type: 'staff_role_assignment',
      entity_id: assignment.id,
      after_state: { staff_id: context.params.staffId, role_name, staff_name: staffExists.full_name },
      result: 'success',
      metadata: { role_name, staff_name: staffExists.full_name },
    });

    return NextResponse.json({ role_assignment: assignment }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/admin/staff/[staffId]/roles — revoke a role assignment
export async function DELETE(
  request: NextRequest,
  context: { params: { staffId: string } }
) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const isSuperAdmin = await verifySuperAdmin(supabase);
    if (!isSuperAdmin) return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const assignmentId = searchParams.get('assignment_id');
    const revokeReason = searchParams.get('reason') || 'Revoked by admin';

    if (!assignmentId) return NextResponse.json({ error: 'assignment_id query parameter is required' }, { status: 400 });

    const serviceClient = createServiceClient();
    const { data: adminStaff } = await supabase.from('staff_users').select('id').eq('auth_id', user.id).maybeSingle();

    const { data: beforeState } = await serviceClient
      .from('staff_role_assignments')
      .select('*')
      .eq('id', assignmentId)
      .eq('staff_id', context.params.staffId)
      .maybeSingle();
    if (!beforeState) return NextResponse.json({ error: 'Role assignment not found' }, { status: 404 });

    const { error } = await serviceClient
      .from('staff_role_assignments')
      .update({
        status: 'revoked',
        revoked_at: new Date().toISOString(),
        revoke_reason: revokeReason,
      })
      .eq('id', assignmentId);

    if (error) return NextResponse.json({ error: `Failed to revoke role: ${error.message}` }, { status: 500 });

    await serviceClient.from('admin_action_log').insert({
      admin_user_id: adminStaff?.id || user.id,
      admin_role: 'super_admin',
      action: 'revoke_role',
      action_category: 'rbac_management',
      entity_type: 'staff_role_assignment',
      entity_id: assignmentId,
      before_state: beforeState,
      result: 'success',
      metadata: { revoke_reason: revokeReason },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
