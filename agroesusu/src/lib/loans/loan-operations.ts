/**
 * AgroEsusu — Loan Operations
 *
 * Handles: application creation, disbursement, repayment, and missed
 * payment escalation. Reuses existing Paystack transfer infrastructure.
 */

import { createAdminClient } from '@/lib/supabase/server';
import { getPaymentService, generatePaymentReference } from '../payment-provider';
import { LOANS_LIVE_MODE, TIER_CONFIGS, LOAN_REF, GRACE_PERIOD_DAYS, MAX_AUTO_RETRY_ATTEMPTS } from './config';
import { updateCreditScore } from './credit-score';

// ─── Types ───
export interface LoanApplicationInput {
  userId: string;
  amount: number;
  numInstallments: number;
  linkedPotId: string;        // pot for auto-deduction source
  esusuPayoutOptIn: boolean;  // user explicitly opted into esusu payout interception
  linkedGroupId?: string;     // group for esusu payout interception
  disbursementAccountId: string; // pot to disburse into (or bank account for transfer)
  disbursementBankCode?: string;  // for paystack_transfer
  disbursementAccountNumber?: string;
  disbursementAccountName?: string;
}

export interface LoanApplicationResult {
  success: boolean;
  loanId?: string;
  error?: string;
  loan?: any;
}

// ─── Application ───
export async function createLoanApplication(input: LoanApplicationInput): Promise<LoanApplicationResult> {
  const admin = createAdminClient();

  // Fetch eligibility data
  const { data: profile } = await admin.from('profiles').select('*').eq('id', input.userId).single();
  if (!profile) return { success: false, error: 'Profile not found' };

  if (profile.kyc_status !== 'verified') {
    return { success: false, error: 'BVN verification is required before applying for a loan.' };
  }

  // Check no active loans
  const { data: activeLoans } = await admin
    .from('loans')
    .select('id')
    .eq('user_id', input.userId)
    .in('status', ['active', 'overdue', 'pending_review', 'approved']);

  if (activeLoans && activeLoans.length > 0) {
    return { success: false, error: 'You already have an active loan or pending application.' };
  }

  // Determine tier (reuse eligibility logic inline for speed)
  const { checkEligibility } = await import('./eligibility');
  const eligibility = await checkEligibility(input.userId);

  if (!eligibility.eligible || !eligibility.tier) {
    return { success: false, error: eligibility.blockingIssues[0] || 'You are not eligible for a loan at this time.' };
  }

  const tier = eligibility.tier;

  // Validate amount within tier range
  if (input.amount < tier.minAmount || input.amount > tier.maxAmount) {
    return {
      success: false,
      error: `Loan amount must be between ₦${tier.minAmount.toLocaleString()} and ₦${tier.maxAmount.toLocaleString()} for your ${tier.label} tier.`,
    };
  }

  // Validate installments
  if (![4, 8, 12].includes(input.numInstallments)) {
    return { success: false, error: 'Repayment schedule must be 4, 8, or 12 weekly installments.' };
  }

  // Validate linked pot exists and belongs to user
  const { data: linkedPot } = await admin
    .from('savings_accounts')
    .select('id, user_id, status')
    .eq('id', input.linkedPotId)
    .eq('user_id', input.userId)
    .single();

  if (!linkedPot) {
    return { success: false, error: 'Linked savings pot not found.' };
  }

  // Calculate loan terms
  const principal = input.amount;
  const interestRate = tier.flatInterestRate;
  const interestAmount = Math.round((principal * interestRate / 100) * 100) / 100;
  const totalRepayable = principal + interestAmount;
  const installmentAmount = Math.round((totalRepayable / input.numInstallments) * 100) / 100;

  // Calculate first due date (7 days from now for weekly)
  const firstDueDate = new Date();
  firstDueDate.setDate(firstDueDate.getDate() + 7);

  // Create loan record
  const { data: loan, error } = await admin.from('loans').insert({
    user_id: input.userId,
    principal,
    interest_rate: interestRate,
    interest_amount: interestAmount,
    total_repayable: totalRepayable,
    outstanding_balance: totalRepayable,
    installment_amount: installmentAmount,
    num_installments: input.numInstallments,
    installment_frequency: 'weekly',
    tier: tier.tier,
    first_due_date: firstDueDate.toISOString(),
    next_due_date: firstDueDate.toISOString(),
    disbursement_method: LOANS_LIVE_MODE ? 'bank_transfer' : 'pot_credit',
    disbursement_account_id: input.disbursementAccountId,
    repayment_source: 'auto_deduction',
    linked_pot_id: input.linkedPotId,
    esusu_payout_opt_in: input.esusuPayoutOptIn,
    linked_group_id: input.linkedGroupId || null,
    late_fee_amount: tier.lateFeeFlat,
    late_fee_disclosed: true, // UI shows terms before acceptance
    status: 'pending_review',
  }).select().single();

  if (error || !loan) {
    console.error('Loan creation error:', error);
    return { success: false, error: 'Failed to create loan application.' };
  }

  // Generate installment schedule
  const installments = [];
  for (let i = 1; i <= input.numInstallments; i++) {
    const dueDate = new Date(firstDueDate);
    dueDate.setDate(dueDate.getDate() + (i - 1) * 7);
    installments.push({
      loan_id: loan.id,
      installment_number: i,
      due_date: dueDate.toISOString(),
      amount_due: installmentAmount,
      status: 'pending',
    });
  }

  const { error: installmentsError } = await admin.from('loan_installments').insert(installments);
  if (installmentsError) {
    console.error('Installment creation error:', installmentsError);
  }

  // Notify user
  await admin.from('notifications').insert({
    user_id: input.userId,
    type: 'loan',
    channel: 'in_app',
    title: 'Loan Application Submitted',
    content: `Your loan application for ₦${principal.toLocaleString()} is under review. You'll be notified when it's approved.`,
    status: 'unread',
    metadata: { loan_id: loan.id, amount: principal },
  });

  return { success: true, loanId: loan.id, loan };
}

// ─── Disbursement ───
export async function disburseLoan(loanId: string, reviewedBy: string): Promise<{ success: boolean; error?: string }> {
  const admin = createAdminClient();

  const { data: loan } = await admin.from('loans').select('*').eq('id', loanId).single();
  if (!loan) return { success: false, error: 'Loan not found' };

  if (loan.status !== 'pending_review' && loan.status !== 'approved') {
    return { success: false, error: `Loan cannot be disbursed (status: ${loan.status})` };
  }

  // Mark as approved + active
  await admin.from('loans').update({
    status: 'active',
    reviewed_by: reviewedBy,
    reviewed_date: new Date().toISOString(),
    disbursed_date: new Date().toISOString(),
  }).eq('id', loanId);

  if (LOANS_LIVE_MODE && loan.disbursement_method === 'bank_transfer') {
    // Real disbursement via Paystack transfer
    const { data: profile } = await admin.from('profiles').select('email, full_name').eq('id', loan.user_id).single();
    if (!profile) return { success: false, error: 'User profile not found' };

    // Need bank details — for now, credit to the disbursement pot
    // (In production, this would use the user's verified bank account)
    const reference = generatePaymentReference(LOAN_REF.disbursement);

    try {
      // For sandbox: we credit the user's pot instead of doing a real transfer
      // For live: we would create a transfer recipient and initiate transfer here
      await admin.from('savings_accounts')
        .update({ current_amount: loan.principal })
        .eq('id', loan.disbursement_account_id);

      await admin.from('loan_transactions').insert({
        loan_id: loanId,
        user_id: loan.user_id,
        type: 'disbursement',
        amount: loan.principal,
        reference,
        status: 'completed',
        description: `Loan disbursement to savings pot`,
      });

      await admin.from('transactions').insert({
        user_id: loan.user_id,
        account_id: loan.disbursement_account_id,
        type: 'deposit',
        amount: loan.principal,
        payment_reference: reference,
        status: 'completed',
        description: `Loan disbursement — ₦${loan.principal.toLocaleString()} loan credited to your pot`,
      });
    } catch (err: any) {
      console.error('Disbursement error:', err);
      // Refund status
      await admin.from('loans').update({ status: 'pending_review' }).eq('id', loanId);
      return { success: false, error: 'Disbursement failed. Loan returned to pending review.' };
    }
  } else {
    // SANDBOX MODE: credit to pot (no real money moves)
    await admin.from('savings_accounts')
      .update({ current_amount: loan.principal })
      .eq('id', loan.disbursement_account_id);

    const reference = generatePaymentReference(LOAN_REF.disbursement);

    await admin.from('loan_transactions').insert({
      loan_id: loanId,
      user_id: loan.user_id,
      type: 'disbursement',
      amount: loan.principal,
      reference,
      status: 'completed',
      description: LOANS_LIVE_MODE ? 'Loan disbursement (live)' : 'Loan disbursement (SANDBOX — no real money transferred)',
    });

    await admin.from('transactions').insert({
      user_id: loan.user_id,
      account_id: loan.disbursement_account_id,
      type: 'deposit',
      amount: loan.principal,
      payment_reference: reference,
      status: 'completed',
      description: `Loan disbursement — ₦${loan.principal.toLocaleString()} ${LOANS_LIVE_MODE ? '' : '[SANDBOX]'} credited to your pot`,
    });
  }

  // Notify user
  await admin.from('notifications').insert({
    user_id: loan.user_id,
    type: 'loan',
    channel: 'in_app',
    title: 'Loan Approved & Disbursed',
    content: `Your loan of ₦${Number(loan.principal).toLocaleString()} has been ${LOANS_LIVE_MODE ? 'disbursed' : 'credited to your pot (SANDBOX MODE)'}. First payment of ₦${Number(loan.installment_amount).toLocaleString()} is due on ${new Date(loan.first_due_date).toLocaleDateString()}.`,
    status: 'unread',
    metadata: { loan_id: loanId, amount: loan.principal },
  });

  return { success: true };
}

// ─── Repayment ───
export async function processRepayment(
  loanId: string,
  amount: number,
  method: 'auto_deduction' | 'manual' | 'esusu_intercept',
  reference?: string
): Promise<{ success: boolean; error?: string; completed?: boolean }> {
  const admin = createAdminClient();

  const { data: loan } = await admin.from('loans').select('*').eq('id', loanId).single();
  if (!loan) return { success: false, error: 'Loan not found' };

  if (loan.status !== 'active' && loan.status !== 'overdue') {
    return { success: false, error: `Loan is not active (status: ${loan.status})` };
  }

  // Find the next due installment
  const { data: installments } = await admin
    .from('loan_installments')
    .select('*')
    .eq('loan_id', loanId)
    .in('status', ['pending', 'partial', 'overdue'])
    .order('installment_number', { ascending: true });

  if (!installments || installments.length === 0) {
    return { success: false, error: 'No pending installments found.' };
  }

  const currentInstallment = installments[0];
  const remainingOnInstallment = Number(currentInstallment.amount_due) - Number(currentInstallment.amount_paid || 0);

  if (amount < remainingOnInstallment && method !== 'auto_deduction') {
    return { success: false, error: `Payment of ₦${amount.toLocaleString()} is less than the required ₦${remainingOnInstallment.toLocaleString()}.` };
  }

  const paymentAmount = Math.min(amount, remainingOnInstallment);
  const newAmountPaid = Number(currentInstallment.amount_paid || 0) + paymentAmount;
  const isInstallmentComplete = newAmountPaid >= Number(currentInstallment.amount_due);

  // Update installment
  await admin.from('loan_installments').update({
    amount_paid: newAmountPaid,
    status: isInstallmentComplete ? 'paid' : 'partial',
    paid_date: isInstallmentComplete ? new Date().toISOString() : null,
    payment_reference: reference,
    payment_method: method,
    attempts: (currentInstallment.attempts || 0) + 1,
    last_attempt_date: new Date().toISOString(),
  }).eq('id', currentInstallment.id);

  // Update loan balance
  const newOutstanding = Number(loan.outstanding_balance) - paymentAmount;
  const isLoanComplete = newOutstanding <= 0;

  // Find next due installment
  const nextInstallment = installments[1];
  const nextDueDate = isInstallmentComplete && nextInstallment ? nextInstallment.due_date : null;

  await admin.from('loans').update({
    outstanding_balance: Math.max(0, newOutstanding),
    status: isLoanComplete ? 'completed' : (loan.status === 'overdue' ? 'active' : loan.status),
    next_due_date: nextDueDate,
    completed_date: isLoanComplete ? new Date().toISOString() : null,
    overdue_days: 0, // reset on successful payment
    escalation_level: 0,
  }).eq('id', loanId);

  // Log the repayment
  await admin.from('loan_transactions').insert({
    loan_id: loanId,
    user_id: loan.user_id,
    type: 'repayment',
    amount: paymentAmount,
    reference: reference || generatePaymentReference(LOAN_REF.repayment),
    status: 'completed',
    description: `Repayment — ${method} (installment #${currentInstallment.installment_number})`,
  });

  // If auto-deduction, deduct from linked pot
  if (method === 'auto_deduction' && loan.linked_pot_id) {
    const { data: pot } = await admin.from('savings_accounts').select('current_amount').eq('id', loan.linked_pot_id).single();
    if (pot) {
      await admin.from('savings_accounts')
        .update({ current_amount: Math.max(0, Number(pot.current_amount) - paymentAmount) })
        .eq('id', loan.linked_pot_id);
    }
  }

  // Notify user
  await admin.from('notifications').insert({
    user_id: loan.user_id,
    type: 'loan',
    channel: 'in_app',
    title: isLoanComplete ? 'Loan Fully Repaid! 🎉' : 'Payment Received',
    content: isLoanComplete
      ? `Congratulations! Your loan of ₦${Number(loan.principal).toLocaleString()} has been fully repaid. Your credit score has improved.`
      : `Payment of ₦${paymentAmount.toLocaleString()} received for your loan. Outstanding balance: ₦${Math.max(0, newOutstanding).toLocaleString()}.`,
    status: 'unread',
    metadata: { loan_id: loanId, amount: paymentAmount },
  });

  // Update credit score
  if (isInstallmentComplete) {
    await updateCreditScore(loan.user_id);
  }

  return { success: true, completed: isLoanComplete };
}

// ─── Auto-Deduction (called by cron) ───
export async function attemptAutoDeduction(loanId: string): Promise<{ success: boolean; reason?: string }> {
  const admin = createAdminClient();

  const { data: loan } = await admin.from('loans').select('*').eq('id', loanId).single();
  if (!loan) return { success: false, reason: 'Loan not found' };

  if (loan.status !== 'active' && loan.status !== 'overdue') {
    return { success: false, reason: `Loan not active (status: ${loan.status})` };
  }

  // Check if there's a due installment
  const { data: installment } = await admin
    .from('loan_installments')
    .select('*')
    .eq('loan_id', loanId)
    .in('status', ['pending', 'partial', 'overdue'])
    .order('installment_number', { ascending: true })
    .limit(1)
    .single();

  if (!installment) return { success: false, reason: 'No pending installments' };

  // Check if due date has passed
  if (new Date(installment.due_date) > new Date()) {
    return { success: false, reason: 'Installment not yet due' };
  }

  // Check attempts
  if ((installment.attempts || 0) >= MAX_AUTO_RETRY_ATTEMPTS + 1) {
    return { success: false, reason: 'Max retry attempts reached' };
  }

  // Check linked pot balance
  const { data: pot } = await admin.from('savings_accounts').select('current_amount').eq('id', loan.linked_pot_id).single();

  if (!pot) return { success: false, reason: 'Linked pot not found' };

  const amountNeeded = Number(installment.amount_due) - Number(installment.amount_paid || 0);

  if (Number(pot.current_amount) >= amountNeeded) {
    // Sufficient balance — process auto-deduction
    const reference = generatePaymentReference(LOAN_REF.autoDeduct);
    return processRepayment(loanId, amountNeeded, 'auto_deduction', reference);
  }

  // Insufficient balance — try esusu payout interception if opted in
  if (loan.esusu_payout_opt_in && loan.linked_group_id) {
    // Check if there's a pending group payout for this user
    const { data: groupMember } = await admin
      .from('group_members')
      .select('group_id, has_received_payout')
      .eq('group_id', loan.linked_group_id)
      .eq('user_id', loan.user_id)
      .single();

    if (groupMember && !groupMember.has_received_payout) {
      // The user's esusu payout would go to them next cycle — intercept it
      // For now, log that interception was attempted but payout isn't available yet
      await admin.from('loan_transactions').insert({
        loan_id: loanId,
        user_id: loan.user_id,
        type: 'retry',
        amount: 0,
        reference: generatePaymentReference(LOAN_REF.autoDeduct),
        status: 'failed',
        description: 'Auto-deduction failed (insufficient pot balance). Esusu payout interception pending — will be applied when payout becomes available.',
      });
      return { success: false, reason: 'Insufficient pot balance. Esusu payout interception pending.' };
    }
  }

  // Insufficient balance — notify user for manual payment
  await admin.from('notifications').insert({
    user_id: loan.user_id,
    type: 'loan',
    channel: 'in_app',
    title: 'Payment Didn\'t Go Through',
    content: `Your automatic loan payment of ₦${amountNeeded.toLocaleString()} couldn\'t be processed — insufficient balance in your linked pot. Please top up your pot or make a manual payment from the Loans section.`,
    status: 'unread',
    metadata: { loan_id: loanId, amount: amountNeeded },
  });

  // Update attempt count
  await admin.from('loan_installments').update({
    attempts: (installment.attempts || 0) + 1,
    last_attempt_date: new Date().toISOString(),
  }).eq('id', installment.id);

  return { success: false, reason: 'Insufficient pot balance — user notified' };
}

// ─── Missed Payment Escalation (called by cron) ───
export async function processOverdueLoans(): Promise<{ processed: number }> {
  const admin = createAdminClient();
  let processed = 0;

  // Find all active loans with past due dates
  const { data: loans } = await admin
    .from('loans')
    .select('*')
    .in('status', ['active', 'overdue']);

  if (!loans) return { processed: 0 };

  for (const loan of loans) {
    // Find overdue installments
    const { data: overdueInstallments } = await admin
      .from('loan_installments')
      .select('*')
      .eq('loan_id', loan.id)
      .in('status', ['pending', 'partial'])
      .lt('due_date', new Date().toISOString())
      .order('installment_number', { ascending: true });

    if (!overdueInstallments || overdueInstallments.length === 0) continue;

    const firstOverdue = overdueInstallments[0];
    const daysOverdue = Math.floor((Date.now() - new Date(firstOverdue.due_date).getTime()) / (1000 * 60 * 60 * 24));

    if (daysOverdue <= 0) continue;

    // Mark installment as overdue
    await admin.from('loan_installments').update({ status: 'overdue' }).eq('id', firstOverdue.id);

    // Mark loan as overdue if not already
    if (loan.status === 'active') {
      await admin.from('loans').update({ status: 'overdue', overdue_days: daysOverdue }).eq('id', loan.id);
    }

    // ─── Graduated escalation ───
    if (daysOverdue <= GRACE_PERIOD_DAYS) {
      // Days 1-3: Grace period — reminder + auto-deduction retry
      await attemptAutoDeduction(loan.id);

      await admin.from('notifications').insert({
        user_id: loan.user_id,
        type: 'loan',
        channel: 'in_app',
        title: 'Payment Reminder',
        content: `Your loan payment of ₦${Number(firstOverdue.amount_due).toLocaleString()} is ${daysOverdue} day(s) overdue. You have ${GRACE_PERIOD_DAYS - daysOverdue} day(s) left in the grace period before a late fee applies. Please make a payment or top up your linked pot.`,
        status: 'unread',
        metadata: { loan_id: loan.id, amount: firstOverdue.amount_due, days_overdue: daysOverdue },
      });
    } else if (daysOverdue > GRACE_PERIOD_DAYS && daysOverdue < 14) {
      // Days 4-14: Apply late fee + restrict new loans/pots
      if (loan.escalation_level < 2) {
        await admin.from('loans').update({
          escalation_level: 2,
          late_fee_amount: Number(loan.late_fee_amount) || 0,
          overdue_days: daysOverdue,
        }).eq('id', loan.id);

        // Add late fee to outstanding balance
        const newBalance = Number(loan.outstanding_balance) + Number(loan.late_fee_amount || 0);
        await admin.from('loans').update({ outstanding_balance: newBalance }).eq('id', loan.id);

        await admin.from('loan_transactions').insert({
          loan_id: loan.id,
          user_id: loan.user_id,
          type: 'late_fee',
          amount: Number(loan.late_fee_amount) || 0,
          status: 'completed',
          description: `Late fee applied (₦${Number(loan.late_fee_amount).toLocaleString()}) — disclosed in original loan terms.`,
        });

        await admin.from('notifications').insert({
          user_id: loan.user_id,
          type: 'loan',
          channel: 'in_app',
          title: 'Late Fee Applied',
          content: `A late fee of ₦${Number(loan.late_fee_amount).toLocaleString()} has been applied to your loan, as disclosed in your loan terms. Your outstanding balance is now ₦${newBalance.toLocaleString()}. Please make a payment to resolve this — you won't be able to open new pots or apply for new loans until it's resolved.`,
          status: 'unread',
          metadata: { loan_id: loan.id, late_fee: loan.late_fee_amount },
        });
      }
    } else if (daysOverdue >= 14) {
      // Beyond 14 days: Flag for manual review
      if (loan.escalation_level < 3) {
        await admin.from('loans').update({
          escalation_level: 3,
          overdue_days: daysOverdue,
        }).eq('id', loan.id);

        await admin.from('notifications').insert({
          user_id: loan.user_id,
          type: 'loan',
          channel: 'in_app',
          title: 'Action Needed — Please Contact Us',
          content: `Your loan is significantly overdue (${daysOverdue} days). Our team would like to help you resolve this. Please contact us so we can work out a repayment plan. We're here to help, not to pressure you.`,
          status: 'unread',
          metadata: { loan_id: loan.id, days_overdue: daysOverdue },
        });
      }
    }

    processed++;
  }

  return { processed };
}
