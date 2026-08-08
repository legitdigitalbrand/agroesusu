import { NextRequest, NextResponse } from 'next/server';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { logAdminAction } from '@/modules/administration';

export async function PATCH(
  request: NextRequest,
  context: { params: { flagId: string } }
) {
  const limited = applyRateLimit(request, '/api/admin/fraud/action', RATE_LIMITS.ADMIN);
  if (limited) return limited;

  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: staff } = await supabase
      .from('staff_users')
      .select('id, role, full_name')
      .eq('auth_id', user.id)
      .eq('employment_status', 'active')
      .maybeSingle();
    if (!staff) return NextResponse.json({ error: 'Staff access required' }, { status: 403 });

    const body = await request.json();
    const { action, resolution_note, severity } = body;
    const flagId = context.params.flagId;

    if (!action) return NextResponse.json({ error: 'Action required' }, { status: 400 });

    const serviceClient = createServiceClient();
    const { data: before } = await serviceClient
      .from('fraud_flags')
      .select('*')
      .eq('id', flagId)
      .maybeSingle();
    if (!before) return NextResponse.json({ error: 'Flag not found' }, { status: 404 });

    let updateData: Record<string, unknown> = {};

    switch (action) {
      case 'assign':
        updateData = { assigned_to: user.id, assigned_name: staff.full_name, status: 'investigating' };
        break;
      case 'unassign':
        updateData = { assigned_to: null, assigned_name: null, status: 'open' };
        break;
      case 'confirm_fraud':
        updateData = {
          status: 'confirmed',
          resolved_by: user.id,
          resolved_name: staff.full_name,
          resolution_note: resolution_note || 'Confirmed as fraud',
          resolved_at: new Date().toISOString(),
        };
        break;
      case 'false_positive':
        updateData = {
          status: 'false_positive',
          resolved_by: user.id,
          resolved_name: staff.full_name,
          resolution_note: resolution_note || 'False positive',
          resolved_at: new Date().toISOString(),
        };
        break;
      case 'resolve':
        updateData = {
          status: 'resolved',
          resolved_by: user.id,
          resolved_name: staff.full_name,
          resolution_note: resolution_note || 'Resolved',
          resolved_at: new Date().toISOString(),
        };
        break;
      case 'update_severity':
        updateData = { severity: severity || before.severity };
        break;
      case 'reopen':
        updateData = {
          status: 'open',
          resolved_by: null,
          resolved_name: null,
          resolution_note: null,
          resolved_at: null,
        };
        break;
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    const { data: updated, error: updateError } = await serviceClient
      .from('fraud_flags')
      .update({ ...updateData, updated_at: new Date().toISOString() })
      .eq('id', flagId)
      .select('*')
      .single();

    if (updateError) throw new Error(updateError.message);

    await logAdminAction({
      admin_user_id: staff.id,
      admin_role: staff.role,
      action,
      action_category: 'fraud',
      entity_type: 'fraud_flag',
      entity_id: flagId,
      before_state: before,
      after_state: updateData,
      metadata: { resolution_note, severity },
    });

    return NextResponse.json({ success: true, flag: updated });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}
