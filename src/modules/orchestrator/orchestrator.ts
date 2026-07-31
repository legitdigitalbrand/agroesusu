// ============================================================================
// Financial Transaction Orchestrator (FTO)
// 
// EXTENDED IN PHASE 6: Now supports loan transactions (disbursement,
// repayment, interest, penalty). Looks up interest revenue (4001) and
// fee revenue (4000) accounts when needed.
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import {
  createJournalEntry,
  addJournalLines,
  postJournalEntry,
  reverseJournalEntry,
  getWalletAccountId,
  getAccountByCode,
  refreshWalletBalanceCache,
} from '@/modules/ledger';
import { getPostingTemplate, requiresProductAccount, requiresInterestRevenueAccount, requiresFeeRevenueAccount } from './posting-templates';
import type {
  FinancialTransactionRequest,
  FinancialTransactionResult,
  ReversalRequest,
} from './types';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function initiate(
  request: FinancialTransactionRequest
): Promise<FinancialTransactionResult> {
  const supabase = getServiceClient();

  try {
    // 1. IDEMPOTENCY CHECK
    const { data: existing } = await supabase
      .from('financial_transactions')
      .select('id, transaction_reference, status, journal_entry_id, amount, description')
      .eq('idempotency_key', request.idempotency_key)
      .maybeSingle();

    if (existing) {
      if (existing.status === 'completed' || existing.status === 'posted') {
        return {
          id: existing.id,
          transaction_reference: existing.transaction_reference,
          status: existing.status,
          journal_entry_id: existing.journal_entry_id,
          amount: Number(existing.amount),
          description: existing.description,
        };
      }
      if (['initiated', 'validated', 'posting'].includes(existing.status)) {
        return {
          id: existing.id,
          transaction_reference: existing.transaction_reference,
          status: existing.status as FinancialTransactionResult['status'],
          amount: Number(existing.amount),
          description: existing.description,
          error: 'Transaction already in progress',
        };
      }
      if (existing.status === 'failed') {
        await supabase.from('financial_transactions').delete().eq('id', existing.id);
      }
    }

    // 2. CREATE FINANCIAL TRANSACTION
    const { data: ft, error: ftError } = await supabase
      .from('financial_transactions')
      .insert({
        transaction_type: request.transaction_type,
        source_module: request.source_module,
        source_reference: request.source_reference,
        status: 'initiated',
        amount: request.amount,
        currency: request.currency || 'NGN',
        description: request.description,
        idempotency_key: request.idempotency_key,
        wallet_id: request.wallet_id || null,
        metadata: request.metadata || {},
      })
      .select('id, transaction_reference')
      .single();

    if (ftError || !ft) throw new Error(`Failed to create financial transaction: ${ftError?.message}`);

    const ftId = ft.id;
    const ftRef = ft.transaction_reference;

    // 3. VALIDATE
    const validationErrors: string[] = [];

    if (request.amount <= 0) validationErrors.push('Amount must be greater than 0');

    const template = getPostingTemplate(request.transaction_type);
    if (!template) validationErrors.push(`No posting template for: ${request.transaction_type}`);

    const needsWallet = !['savings_interest', 'investment_reinvest', 'adjustment'].includes(request.transaction_type);
    if (needsWallet && !request.wallet_id) validationErrors.push('wallet_id is required');

    if (requiresProductAccount(request.transaction_type) && !request.product_account_id) {
      validationErrors.push(`product_account_id is required for ${request.transaction_type}`);
    }

    let walletAccountId: string | null = null;
    if (request.wallet_id) {
      walletAccountId = await getWalletAccountId(request.wallet_id);
      if (!walletAccountId) validationErrors.push(`No ledger account for wallet ${request.wallet_id}`);
    }

    const safeHavenAccount = await getAccountByCode('1000');
    if (!safeHavenAccount) validationErrors.push('Safe Haven account (1000) not found');

    // Look up escrow account (2004) for withdrawal reservations
    let escrowAccount: { id: string } | null = null;
    if (['wallet_withdrawal_reservation', 'wallet_withdrawal_settlement'].includes(request.transaction_type)) {
      escrowAccount = await getAccountByCode('2004');
      if (!escrowAccount) validationErrors.push('Escrow account (2004) not found');
    }

    // Look up interest expense account (5000) for savings interest
    let interestExpenseAccount: { id: string } | null = null;
    if (['savings_interest', 'investment_returns', 'investment_reinvest'].includes(request.transaction_type)) {
      interestExpenseAccount = await getAccountByCode('5000');
      if (!interestExpenseAccount) validationErrors.push('Interest expense account (5000) not found');
    }

    // Look up interest revenue account (4001) for loan interest
    let interestRevenueAccount: { id: string } | null = null;
    if (requiresInterestRevenueAccount(request.transaction_type)) {
      interestRevenueAccount = await getAccountByCode('4001');
      if (!interestRevenueAccount) validationErrors.push('Interest revenue account (4001) not found');
    }

    // Look up fee revenue account (4000) for penalties
    let feeRevenueAccount: { id: string } | null = null;
    if (requiresFeeRevenueAccount(request.transaction_type)) {
      feeRevenueAccount = await getAccountByCode('4000');
      if (!feeRevenueAccount) validationErrors.push('Fee revenue account (4000) not found');
    }

    if (validationErrors.length > 0) {
      await supabase.from('financial_transactions').update({
        status: 'failed', validation_errors: validationErrors, failed_at: new Date().toISOString(),
      }).eq('id', ftId);
      return { id: ftId, transaction_reference: ftRef, status: 'failed', amount: request.amount, description: request.description, error: validationErrors.join('; ') };
    }

    // 4. TRANSITION: initiated → validated
    await supabase.from('financial_transactions').update({
      status: 'validated', validated_at: new Date().toISOString(),
    }).eq('id', ftId);

    // 5. BUILD JOURNAL LINES
    await supabase.from('financial_transactions').update({ status: 'posting' }).eq('id', ftId);

    const lines = template!.buildLines({
      amount: request.amount,
      walletAccountId: walletAccountId || '',
      safeHavenAccountId: safeHavenAccount!.id,
      escrowAccountId: escrowAccount?.id,
      productAccountId: request.product_account_id,
      interestExpenseAccountId: interestExpenseAccount?.id,
      interestRevenueAccountId: interestRevenueAccount?.id,
      feeRevenueAccountId: feeRevenueAccount?.id,
      description: request.description,
    });

    const jeId = await createJournalEntry(request.description, request.source_module, ftId, request.metadata);
    await addJournalLines(jeId, lines);

    // 6. POST JOURNAL ENTRY
    try {
      await postJournalEntry(jeId);
    } catch (postError) {
      await supabase.from('financial_transactions').update({
        status: 'failed',
        validation_errors: { posting_error: postError instanceof Error ? postError.message : String(postError) },
        failed_at: new Date().toISOString(),
      }).eq('id', ftId);
      return { id: ftId, transaction_reference: ftRef, status: 'failed', amount: request.amount, description: request.description, error: `Posting failed: ${postError instanceof Error ? postError.message : String(postError)}` };
    }

    // 7. LINK & TRANSITION: posting → posted
    await supabase.from('financial_transactions').update({
      status: 'posted', journal_entry_id: jeId, posted_at: new Date().toISOString(),
    }).eq('id', ftId);

    // 8. CREATE WALLET_TRANSACTIONS READ MODEL ENTRY
    if (request.wallet_id && walletAccountId && request.transaction_type !== 'savings_interest') {
      const walletCreditTypes = ['wallet_deposit', 'incoming_deposit', 'savings_withdrawal', 'loan_disbursement', 'group_payout', 'investment_redemption', 'investment_returns'];
      const direction = walletCreditTypes.includes(request.transaction_type) ? 'credit' : 'debit';

      await supabase.from('wallet_transactions').insert({
        wallet_id: request.wallet_id,
        transaction_reference: `WTX-${ftRef}`,
        direction,
        amount: request.amount,
        currency: request.currency || 'NGN',
        transaction_type: request.transaction_type.replace('wallet_', ''),
        narration: request.description,
        source: 'internal_operation',
        internal_reference: ftId,
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        metadata: { ...request.metadata, ft_id: ftId, je_id: jeId },
      });
    }

    // 9. REFRESH BALANCE CACHE
    if (request.wallet_id) {
      await refreshWalletBalanceCache(request.wallet_id);
    }

    // 10. TRANSITION: posted → completed
    await supabase.from('financial_transactions').update({
      status: 'completed', completed_at: new Date().toISOString(),
    }).eq('id', ftId);

    return { id: ftId, transaction_reference: ftRef, status: 'completed', journal_entry_id: jeId, amount: request.amount, description: request.description };

  } catch (error) {
    console.error('[Orchestrator] Initiate failed:', error);
    return { id: '', transaction_reference: '', status: 'failed', amount: request.amount, description: request.description, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function reverse(request: ReversalRequest): Promise<FinancialTransactionResult> {
  const supabase = getServiceClient();

  try {
    const { data: existingReversal } = await supabase
      .from('financial_transactions')
      .select('id, transaction_reference, status')
      .eq('idempotency_key', request.idempotency_key)
      .maybeSingle();

    if (existingReversal && existingReversal.status === 'completed') {
      return { id: existingReversal.id, transaction_reference: existingReversal.transaction_reference, status: 'completed', amount: 0, description: 'Reversal already completed' };
    }

    const { data: original, error: origError } = await supabase
      .from('financial_transactions')
      .select('id, transaction_reference, status, amount, description, wallet_id, journal_entry_id')
      .eq('id', request.original_transaction_id)
      .single();

    if (origError || !original) throw new Error(`Original transaction not found: ${request.original_transaction_id}`);
    if (original.status !== 'completed') throw new Error(`Can only reverse completed transactions. Current: ${original.status}`);

    const { data: revFt, error: revFtError } = await supabase
      .from('financial_transactions')
      .insert({
        transaction_type: 'reversal', source_module: 'orchestrator',
        source_reference: request.original_transaction_id, status: 'initiated',
        amount: original.amount, description: `REVERSAL of ${original.transaction_reference}: ${request.reason}`,
        idempotency_key: request.idempotency_key, wallet_id: original.wallet_id,
        reverses: request.original_transaction_id, reversal_reason: request.reason,
      })
      .select('id, transaction_reference')
      .single();

    if (revFtError || !revFt) throw new Error(`Failed to create reversal: ${revFtError?.message}`);

    const reversalJeId = await reverseJournalEntry(original.journal_entry_id, request.reason);

    await supabase.from('financial_transactions').update({
      status: 'completed', journal_entry_id: reversalJeId,
      posted_at: new Date().toISOString(), completed_at: new Date().toISOString(),
    }).eq('id', revFt.id);

    await supabase.from('financial_transactions').update({
      status: 'reversed', reversed_by: revFt.id, reversed_at: new Date().toISOString(),
    }).eq('id', request.original_transaction_id);

    if (original.wallet_id) {
      const { data: originalWtx } = await supabase
        .from('wallet_transactions').select('direction')
        .eq('internal_reference', request.original_transaction_id).maybeSingle();

      const reversalDirection = originalWtx?.direction === 'credit' ? 'debit' : 'credit';

      await supabase.from('wallet_transactions').insert({
        wallet_id: original.wallet_id, transaction_reference: `WTX-${revFt.transaction_reference}`,
        direction: reversalDirection, amount: Number(original.amount), currency: 'NGN',
        transaction_type: 'reversal', narration: `Reversal: ${request.reason}`,
        source: 'internal_operation', internal_reference: revFt.id, status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        metadata: { original_ft_id: request.original_transaction_id, reversal_je_id: reversalJeId },
      });

      await refreshWalletBalanceCache(original.wallet_id);
    }

    return { id: revFt.id, transaction_reference: revFt.transaction_reference, status: 'completed', journal_entry_id: reversalJeId, amount: Number(original.amount), description: `Reversal: ${request.reason}` };

  } catch (error) {
    console.error('[Orchestrator] Reverse failed:', error);
    return { id: '', transaction_reference: '', status: 'failed', amount: 0, description: 'Reversal', error: error instanceof Error ? error.message : String(error) };
  }
}
