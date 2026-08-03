import { NextResponse } from 'next/server';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

// POST /api/dev/bootstrap — promotes the authenticated user to Super Admin staff.
//
// SECURITY: This is a ONE-TIME bootstrap for standing up the very first admin
// account. It only succeeds if:
//   1. Zero rows exist in `staff_users` (i.e. no admin has ever been created), AND
//   2. The caller is authenticated, AND
//   3. The caller supplies the `ADMIN_BOOTSTRAP_SECRET` env value as a header
//      (`x-bootstrap-secret`) — this must be set in production and rotated/removed
//      after first use.
//
// Once ANY staff_users row exists, this endpoint permanently refuses to run —
// it CANNOT be used to add a second admin or re-promote anyone. Further staff
// must be added via /dev/staff (which requires an existing super_admin).

export async function POST(request: Request) {
  const limited = applyRateLimit(request, '/api/dev/bootstrap', RATE_LIMITS.AUTH);
  if (limited) return limited;
  try {
    const bootstrapSecret = process.env.ADMIN_BOOTSTRAP_SECRET;
    if (!bootstrapSecret) {
      return NextResponse.json(
        { error: 'Bootstrap is disabled: ADMIN_BOOTSTRAP_SECRET is not configured.' },
        { status: 403 }
      );
    }

    const providedSecret = request.headers.get('x-bootstrap-secret');
    if (!providedSecret || providedSecret !== bootstrapSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serviceClient = createServiceClient();

    // Hard gate: refuse if ANY staff already exists — this is a one-time bootstrap,
    // never a way to add or re-promote staff after the first admin is set up.
    const { count: existingStaffCount, error: countError } = await serviceClient
      .from('staff_users')
      .select('id', { count: 'exact', head: true });

    if (countError) {
      console.error('[dev/bootstrap] Count error:', countError.message);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    if ((existingStaffCount || 0) > 0) {
      return NextResponse.json(
        { error: 'Bootstrap already completed. An admin already exists — use /dev/staff to add more staff.' },
        { status: 403 }
      );
    }

    const staffNumber = `STF-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

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

    const { data: superAdminRole } = await serviceClient
      .from('roles')
      .select('id')
      .eq('name', 'super_admin')
      .maybeSingle();

    if (!superAdminRole) {
      return NextResponse.json({ error: 'super_admin role not found. Run RBAC migrations first.' }, { status: 500 });
    }

    await serviceClient.from('staff_role_assignments').insert({
      staff_id: staff.id,
      role_id: superAdminRole.id,
      status: 'active',
      assigned_by: staff.id,
      assigned_at: new Date().toISOString(),
    });

    return NextResponse.json({
      message: 'Super Admin created successfully. This bootstrap endpoint is now permanently locked.',
      staff_id: staff.id,
      staff_number: staff.staff_number,
      instructions: 'Log out and log back in, then visit /dev to access the admin portal.',
    });
  } catch (error) {
    console.error('[API:dev/bootstrap] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
