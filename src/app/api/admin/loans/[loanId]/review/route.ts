import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

// POST /api/admin/loans/[loanId]/review
// Loan officer or super_admin reviews a loan application.
// Can: approve, deny, or override an automated eligibility decision.
// MANDATORY: reason field — every action logs the reason to the audit trail.
// The UI must surface the reason field prominently (transparency to admin).

async function verifyLoanOfficer(supabase: ReturnType<typeof createClient>) {
  const { data: isOfficer } = await supabase.rpc('has_role', { p_role_name: 'loan_officer' });
  if (isOfficer) return true;
  const { data: isSuper } = await supabase.rpc('has_role', { p_role_name: 'super_admin' });
  return !!isSuper;
}

export async function POST(
  request: NextRequest,
  context: { params: { loanId: string } }
) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const authorized = await verifyLoanOfficer(supabase);
    if (!authorized) return NextResponse.json({ error: 'Loan officer or super admin access required' }, { status: 403 });

    const body = await request.json();
    const { action, reason, approved_amount } = body;

    // MANDATORY: reason is required for ALL review actions — no exceptions
    if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
      return NextResponse.json({
        error: 'A reason of at least 5 characters is required for every loan review action. This is permanently logged in the audit trail.',
      }, { status: 400 });
    }

    if (!action || !['approve', 'deny', 'override_approve', 'override_deny'].includes(action)) {
      return NextResponse.json({
        error: 'action must be one of: approve, deny, override_approve, override_deny',
      }, { status: 400 });
    }

    const serviceClient = createServiceClient();
    const { data: staff } = await supabase.from('staff_users').select('id, full_name').eq('auth_id', user.id).maybeSingle();

    // Get the loan
    const { data: loan } = await serviceClient
      .from('loans')
      .select('id, customer_id, product_id, requested_amount, approved_amount, status, eligibility_decision_id')
      .eq('id', context.params.loanId)
      .maybeSingle();

    if (!loan) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });

    // Can only review loans in 'pending' status
    if (loan.status !== 'pending') {
      return NextResponse.json({
        error: `Loan is in '${loan.status}' status. Only pending loans can be reviewed.`,
      }, { status: 400 });
    }

    // Get the original eligibility decision
    const { data: eligibilityDecision } = await serviceClient
      .from('loan_eligibility_decisions')
      .select('id, decision, factors, credit_score, savings_balance, max_eligible_amount')
      .eq('id', loan.eligibility_decision_id)
      .maybeSingle();

    const isOverride = action.startsWith('override_');
    const isApproval = action === 'approve' || action === 'override_approve';

    // Create a new eligibility decision record (correction record, not edit)
    const newDecisionRecord: Record<string, unknown> = {
      loan_id: loan.id,
      customer_id: loan.customer_id,
      product_id: loan.product_id,
      decision: isApproval ? 'approved' : 'denied',
      source: isOverride ? 'override' : 'manual_review',
      requested_amount: loan.requested_amount,
      approved_amount: isApproval ? (approved_amount || loan.requested_amount) : null,
      factors: eligibilityDecision?.factors || {},
      credit_score: eligibilityDecision?.credit_score || null,
      savings_balance: eligibilityDecision?.savings_balance || null,
      max_eligible_amount: eligibilityDecision?.max_eligible_amount || null,
      override_reason: reason,
      override_by: staff?.id || user.id,
      cooperative_status: (eligibilityDecision as { cooperative_status?: string })?.cooperative_status || null,
      decided_at: new Date().toISOString(),
      metadata: {
        original_decision: eligibilityDecision?.decision || null,
        review_action: action,
        reviewer_name: staff?.full_name || 'Unknown',
      },
    };

    const { data: newDecision, error: decisionError } = await serviceClient
      .from('loan_eligibility_decisions')
      .insert(newDecisionRecord)
      .select()
      .single();

    if (decisionError) {
      return NextResponse.json({ error: `Failed to create review decision: ${decisionError.message}` }, { status: 500 });
    }

    // Update the loan status
    const loanUpdate: Record<string, unknown> = {
      eligibility_decision_id: newDecision.id,
      updated_at: new Date().toISOString(),
      updated_by: staff?.id || user.id,
    };

    if (isApproval) {
      loanUpdate.status = 'approved';
      loanUpdate.approved_amount = approved_amount || loan.requested_amount;
      loanUpdate.approved_at = new Date().toISOString();
    } else {
      loanUpdate.status = 'denied';
      loanUpdate.denied_at = new Date().toISOString();
    }

    const { data: updatedLoan, error: loanError } = await serviceClient
      .from('loans')
      .update(loanUpdate)
      .eq('id', context.params.loanId)
      .select()
      .single();

    if (loanError) {
      return NextResponse.json({ error: `Failed to update loan: ${loanError.message}` }, { status: 500 });
    }

    // Log to audit_log (general audit trail)
    await serviceClient.from('audit_log').insert({
      actor_id: staff?.id || user.id,
      actor_name: staff?.full_name || 'Admin',
      action: `loan_review_${action}`,
      action_category: 'loan_review',
      entity_type: 'loan',
      entity_id: context.params.loanId,
      result: 'success',
      metadata: {
        reason,
        original_decision: eligibilityDecision?.decision,
        new_decision: isApproval ? 'approved' : 'denied',
        approved_amount: approved_amount || loan.requested_amount,
        is_override: isOverride,
        decision_id: newDecision.id,
      },
    });

    // Also log to admin_action_log (admin-specific audit)
    await serviceClient.from('admin_action_log').insert({
      admin_user_id: staff?.id || user.id,
      admin_role: 'loan_officer',
      action: `loan_review_${action}`,
      action_category: 'loan_review',
      entity_type: 'loan',
      entity_id: context.params.loanId,
      before_state: { status: 'pending', eligibility_decision: eligibilityDecision?.decision },
      after_state: { status: isApproval ? 'approved' : 'denied', new_decision: isApproval ? 'approved' : 'denied' },
      result: 'success',
      metadata: {
        reason,
        is_override: isOverride,
        approved_amount: approved_amount || loan.requested_amount,
      },
    });

    return NextResponse.json({
      loan: updatedLoan,
      decision: newDecision,
      audit_trail: {
        action: `loan_review_${action}`,
        reason,
        is_override: isOverride,
        original_decision: eligibilityDecision?.decision,
        new_decision: isApproval ? 'approved' : 'denied',
        logged_to: ['audit_log', 'admin_action_log'],
      },
    });
  } catch (error) {
    console.error('[API:admin-loan-review] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
