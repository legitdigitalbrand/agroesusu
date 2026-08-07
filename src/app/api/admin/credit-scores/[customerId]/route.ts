import { NextRequest, NextResponse } from 'next/server';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { logAdminAction } from '@/modules/administration';

export async function GET(
  request: NextRequest,
  context: { params: { customerId: string } }
) {
  const limited = applyRateLimit(request, '/api/admin/credit-scores/detail', RATE_LIMITS.ADMIN);
  if (limited) return limited;

  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: staff } = await supabase
      .from('staff_users')
      .select('id')
      .eq('auth_id', user.id)
      .eq('employment_status', 'active')
      .maybeSingle();
    if (!staff) return NextResponse.json({ error: 'Staff access required' }, { status: 403 });

    const serviceClient = createServiceClient();
    const customerId = context.params.customerId;

    const { data: profile, error } = await serviceClient
      .from('customer_risk_profiles')
      .select('*')
      .eq('customer_id', customerId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!profile) return NextResponse.json({ error: 'Risk profile not found' }, { status: 404 });

    // Fetch customer details
    const { data: customer } = await serviceClient
      .from('customers')
      .select('full_name, customer_number, email, phone, status')
      .eq('id', customerId)
      .maybeSingle();

    // Fetch loan history for context
    const { data: loans } = await serviceClient
      .from('loans')
      .select('id, principal_amount, outstanding_balance, status, monthly_repayment, created_at')
      .eq('user_id', (customer as Record<string, string>)?.auth_id || '')
      .order('created_at', { ascending: false })
      .limit(10);

    return NextResponse.json({
      profile,
      customer: customer || null,
      loans: loans || [],
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: { customerId: string } }
) {
  const limited = applyRateLimit(request, '/api/admin/credit-scores/update', RATE_LIMITS.ADMIN);
  if (limited) return limited;

  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: staff } = await supabase
      .from('staff_users')
      .select('id, role')
      .eq('auth_id', user.id)
      .eq('employment_status', 'active')
      .maybeSingle();
    if (!staff) return NextResponse.json({ error: 'Staff access required' }, { status: 403 });

    const body = await request.json();
    const { action, credit_score, risk_level, notes, reason } = body;
    const customerId = context.params.customerId;

    if (!action || !reason) return NextResponse.json({ error: 'Action and reason are required' }, { status: 400 });

    const serviceClient = createServiceClient();

    const { data: before } = await serviceClient
      .from('customer_risk_profiles')
      .select('*')
      .eq('customer_id', customerId)
      .maybeSingle();

    if (!before) return NextResponse.json({ error: 'Risk profile not found' }, { status: 404 });

    let updateData: Record<string, unknown> = {};

    switch (action) {
      case 'update_score':
        if (credit_score !== undefined) {
          const score = parseInt(credit_score);
          if (isNaN(score) || score < 300 || score > 850) {
            return NextResponse.json({ error: 'Credit score must be 300-850' }, { status: 400 });
          }
          updateData = { internal_credit_score: score };
        }
        break;
      case 'update_risk_level':
        if (risk_level) {
          updateData = { risk_level };
        }
        break;
      case 'add_note':
        updateData = { notes: notes || reason };
        break;
      case 'reset':
        updateData = {
          internal_credit_score: 500,
          risk_level: 'low',
          notes: null,
        };
        break;
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    const { data: updated, error: updateError } = await serviceClient
      .from('customer_risk_profiles')
      .update({ ...updateData, updated_at: new Date().toISOString() })
      .eq('customer_id', customerId)
      .select('*')
      .single();

    if (updateError) throw new Error(updateError.message);

    await logAdminAction({
      admin_user_id: staff.id,
      admin_role: staff.role,
      action,
      action_category: 'credit_scoring',
      entity_type: 'customer_risk_profile',
      entity_id: customerId,
      before_state: before,
      after_state: updateData,
      metadata: { reason, credit_score, risk_level, notes },
    });

    return NextResponse.json({ success: true, profile: updated });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}
