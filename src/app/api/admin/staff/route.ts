import { NextRequest, NextResponse } from 'next/server';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

// GET /api/admin/staff — list all staff users (super_admin only)
// POST /api/admin/staff — create a new staff user (super_admin only)

async function verifySuperAdmin(supabase: ReturnType<typeof createClient>) {
  const { data } = await supabase.rpc('has_role', { p_role_name: 'super_admin' });
  return !!data;
}

export async function GET(request: NextRequest) {
  const limited = applyRateLimit(request, "/api/admin/staff", RATE_LIMITS.ADMIN);
  if (limited) return limited;
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const isSuperAdmin = await verifySuperAdmin(supabase);
    if (!isSuperAdmin) return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('include_inactive') === 'true';

    const serviceClient = createServiceClient();
    let query = serviceClient
      .from('staff_users')
      .select('id, staff_number, full_name, email, phone, department, employment_status, is_active, created_at, last_login_at')
      .order('created_at', { ascending: false });

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data: staffList, error } = await query;
    if (error) return NextResponse.json({ error: `Failed to list staff: ${error.message}` }, { status: 500 });

    // Get role assignments for each staff member
    const staffIds = (staffList || []).map(s => s.id);
    let roleMap = new Map<string, string[]>();
    if (staffIds.length > 0) {
      const { data: assignments } = await serviceClient
        .from('staff_role_assignments')
        .select('staff_id, roles(name)')
        .in('staff_id', staffIds)
        .eq('status', 'active');

      for (const assignment of (assignments || []) as unknown[]) {
        const a = assignment as { staff_id: string; roles: { name: string } | { name: string }[] };
        const staffId = a.staff_id;
        const roleData = a.roles;
        const roleName = Array.isArray(roleData) ? roleData[0]?.name : (roleData as { name: string })?.name;
        if (!roleMap.has(staffId)) roleMap.set(staffId, []);
        if (roleName) roleMap.get(staffId)!.push(roleName);
      }
    }

    const result = (staffList || []).map(staff => ({
      ...staff,
      roles: roleMap.get(staff.id) || [],
    }));

    return NextResponse.json({ staff: result });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const isSuperAdmin = await verifySuperAdmin(supabase);
    if (!isSuperAdmin) return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });

    const body = await request.json();
    const { email, full_name, phone, department, role_name } = body;

    if (!email || !full_name || !role_name) {
      return NextResponse.json({ error: 'email, full_name, and role_name are required' }, { status: 400 });
    }

    const serviceClient = createServiceClient();
    const { data: adminStaff } = await supabase.from('staff_users').select('id').eq('auth_id', user.id).maybeSingle();

    // Step 1: Create auth user via Supabase Admin API
    const { data: authUser, error: authError2 } = await serviceClient.auth.admin.createUser({
      email,
      email_confirm: true, // Auto-confirm for staff
      user_metadata: { full_name, role: role_name },
    });

    if (authError2) {
      // User might already exist — try to find them
      if (authError2.message.includes('already')) {
        return NextResponse.json({ error: 'A user with this email already exists in auth' }, { status: 409 });
      }
      return NextResponse.json({ error: `Failed to create auth user: ${authError2.message}` }, { status: 500 });
    }

    // Step 2: Create staff_users record
    const staffNumber = `STF-${Date.now().toString().slice(-8)}`;
    const { data: staffRecord, error: staffError } = await serviceClient
      .from('staff_users')
      .insert({
        auth_id: authUser.user.id,
        staff_number: staffNumber,
        full_name,
        email,
        phone: phone || null,
        department: department || null,
        employment_status: 'active',
        is_active: true,
        created_by: adminStaff?.id || user.id,
      })
      .select()
      .single();

    if (staffError) {
      // Clean up auth user if staff record creation fails
      await serviceClient.auth.admin.deleteUser(authUser.user.id);
      return NextResponse.json({ error: `Failed to create staff record: ${staffError.message}` }, { status: 500 });
    }

    // Step 3: Assign role
    const { data: role } = await serviceClient
      .from('roles')
      .select('id')
      .eq('name', role_name)
      .maybeSingle();

    if (!role) {
      return NextResponse.json({ error: `Role '${role_name}' not found` }, { status: 400 });
    }

    const { error: assignError } = await serviceClient
      .from('staff_role_assignments')
      .insert({
        staff_id: staffRecord.id,
        role_id: role.id,
        status: 'active',
        assigned_by: adminStaff?.id || user.id,
      });

    if (assignError) {
      console.error('[API:admin-staff-create] Role assignment failed:', assignError.message);
    }

    // Step 4: Log admin action
    await serviceClient.from('admin_action_log').insert({
      admin_user_id: adminStaff?.id || user.id,
      admin_role: 'super_admin',
      action: 'create_staff_user',
      action_category: 'rbac_management',
      entity_type: 'staff_user',
      entity_id: staffRecord.id,
      after_state: { ...staffRecord, role: role_name },
      result: 'success',
      metadata: { email, role_name },
    });

    return NextResponse.json({ staff: { ...staffRecord, role: role_name } }, { status: 201 });
  } catch (error) {
    console.error('[API:admin-staff-create] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
