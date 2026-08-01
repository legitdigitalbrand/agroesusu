import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

// POST /api/dev/bootstrap — promotes the authenticated user to Super Admin staff.
// DEV ONLY — this endpoint is for initial staff seeding in development/sandbox.
// In production, staff users should be created through proper admin onboarding.
//
// Prerequisites:
//   1. User must be authenticated (have a Supabase auth account)
//   2. User must NOT already be a staff member (idempotent check)
//
// After calling this endpoint, the user will have:
//   - A staff_users record (staff_number, full_name from auth metadata)
//   - A super_admin role assignment
//   - Access to /dev portal

export async function POST() {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if already staff
    const { data: existingStaff } = await supabase
      .from('staff_users')
      .select('id, staff_number')
      .eq('auth_id', user.id)
      .maybeSingle();

    if (existingStaff) {
      // Already staff — ensure they have super_admin role
      const serviceClient = createServiceClient();
      const { data: existingRole } = await serviceClient
        .from('staff_role_assignments')
        .select('id')
        .eq('staff_id', existingStaff.id)
        .eq('status', 'active')
        .maybeSingle();

      if (!existingRole) {
        // Assign super_admin role
        const { data: superAdminRole } = await serviceClient
          .from('roles')
          .select('id')
          .eq('name', 'super_admin')
          .maybeSingle();

        if (superAdminRole) {
          await serviceClient.from('staff_role_assignments').insert({
            staff_id: existingStaff.id,
            role_id: superAdminRole.id,
            status: 'active',
            assigned_by: existingStaff.id,
          });
        }
      }

      return NextResponse.json({
        message: 'Already a staff member',
        staff_id: existingStaff.id,
        staff_number: existingStaff.staff_number,
      });
    }

    const serviceClient = createServiceClient();

    // Generate staff number
    const staffNumber = `STF-${Date.now().toString().slice(-6)}`;

    // Create staff_users record
    const { data: staff, error: staffError } = await serviceClient
      .from('staff_users')
      .insert({
        auth_id: user.id,
        staff_number: staffNumber,
        full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Admin',
        email: user.email,
        phone: user.user_metadata?.phone || null,
        department: 'Administration',
        employment_status: 'active',
        is_active: true,
      })
      .select('id, staff_number')
      .single();

    if (staffError) {
      return NextResponse.json({ error: 'Failed to create staff record: ' + staffError.message }, { status: 500 });
    }

    // Get super_admin role
    const { data: superAdminRole } = await serviceClient
      .from('roles')
      .select('id')
      .eq('name', 'super_admin')
      .maybeSingle();

    if (!superAdminRole) {
      return NextResponse.json({ error: 'super_admin role not found. Run RBAC migrations first.' }, { status: 500 });
    }

    // Assign super_admin role
    await serviceClient.from('staff_role_assignments').insert({
      staff_id: staff.id,
      role_id: superAdminRole.id,
      status: 'active',
      assigned_by: staff.id,
      assigned_at: new Date().toISOString(),
    });

    return NextResponse.json({
      message: 'Super Admin created successfully',
      staff_id: staff.id,
      staff_number: staff.staff_number,
      instructions: 'Log out and log back in to access /dev portal.',
    });
  } catch (error) {
    console.error('[API:dev/bootstrap] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
