import { NextRequest, NextResponse } from 'next/server';
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { logAdminAction } from '@/modules/administration';

export async function GET(
  request: NextRequest,
  context: { params: { id: string } }
) {
  const limited = applyRateLimit(request, '/api/admin/verification/detail', RATE_LIMITS.ADMIN);
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
    const docId = context.params.id;

    const { data: doc, error } = await serviceClient
      .from('kyc_documents')
      .select('*')
      .eq('id', docId)
      .maybeSingle();

    if (error || !doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

    // Fetch customer
    const { data: customer } = await serviceClient
      .from('customers')
      .select('*')
      .eq('auth_id', doc.user_id)
      .maybeSingle();

    // Fetch Safe Haven verifications
    let shVerifications: Record<string, unknown>[] = [];
    if (customer) {
      const { data: shData } = await serviceClient
        .from('safe_haven_identity_verifications')
        .select('*')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false });
      shVerifications = shData || [];
    }

    // Mask BVN/NIN
    if (customer) {
      customer.bvn = customer.bvn ? `****${customer.bvn.slice(-4)}` : null;
      customer.nin = customer.nin ? `****${customer.nin.slice(-4)}` : null;
    }

    return NextResponse.json({
      verification: doc,
      customer: customer || null,
      safe_haven: shVerifications,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: { id: string } }
) {
  const limited = applyRateLimit(request, '/api/admin/verification/action', RATE_LIMITS.ADMIN);
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
    const { action, reason, notes } = body;
    const docId = context.params.id;

    if (!action || !reason) {
      return NextResponse.json({ error: 'Action and reason are required' }, { status: 400 });
    }

    const serviceClient = createServiceClient();

    const { data: before } = await serviceClient
      .from('kyc_documents')
      .select('*')
      .eq('id', docId)
      .maybeSingle();

    if (!before) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

    let updateData: Record<string, unknown> = {};

    switch (action) {
      case 'approve':
        updateData = { status: 'approved', verified_by: staff.id, updated_at: new Date().toISOString() };
        break;
      case 'reject':
        updateData = { status: 'rejected', updated_at: new Date().toISOString() };
        break;
      case 'request_resubmission':
        updateData = { status: 'needs_review', updated_at: new Date().toISOString() };
        break;
      case 'escalate':
        updateData = { status: 'needs_review', metadata: { escalated: true, escalated_at: new Date().toISOString() } };
        break;
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    const { data: updated, error: updateError } = await serviceClient
      .from('kyc_documents')
      .update(updateData)
      .eq('id', docId)
      .select('*')
      .single();

    if (updateError) throw new Error(updateError.message);

    await logAdminAction({
      admin_user_id: staff.id,
      admin_role: staff.role,
      action,
      action_category: 'verification',
      entity_type: 'kyc_document',
      entity_id: docId,
      before_state: before,
      after_state: updateData,
      metadata: { reason, notes },
    });

    // If approved, update customer KYC tier
    if (action === 'approve' && before.user_id) {
      const { data: customer } = await serviceClient
        .from('customers')
        .select('id, auth_id')
        .eq('auth_id', before.user_id)
        .maybeSingle();

      if (customer) {
        await serviceClient
          .from('customers')
          .update({ status: 'identity_verified' })
          .eq('id', customer.id);
      }

      // Also update profiles table if exists
      await serviceClient
        .from('profiles')
        .update({ kyc_tier: 'tier_1', kyc_verified_at: new Date().toISOString() })
        .eq('id', before.user_id);
    }

    return NextResponse.json({ success: true, verification: updated });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}
