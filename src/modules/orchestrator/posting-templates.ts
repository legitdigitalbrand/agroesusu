// ============================================================================
// Posting Templates — Transaction Type → Journal Lines
// 
// EXTENDED IN PHASE 7: Added group savings posting templates.
// ============================================================================

import type { JournalLineInput } from '@/modules/ledger';

interface PostingTemplateParams {
  amount: number;
  walletAccountId: string;
  safeHavenAccountId: string;
  productAccountId?: string;
  interestExpenseAccountId?: string;
  interestRevenueAccountId?: string;
  feeRevenueAccountId?: string;
  description: string;
}

interface PostingTemplate {
  buildLines: (params: PostingTemplateParams) => JournalLineInput[];
}

const TEMPLATES: Record<string, PostingTemplate> = {
  // Phase 4: Wallet operations
  wallet_deposit: {
    buildLines: ({ amount, walletAccountId, safeHavenAccountId, description }) => [
      { account_id: safeHavenAccountId, entry_type: 'debit', amount, description },
      { account_id: walletAccountId, entry_type: 'credit', amount, description },
    ],
  },
  wallet_withdrawal: {
    buildLines: ({ amount, walletAccountId, safeHavenAccountId, description }) => [
      { account_id: walletAccountId, entry_type: 'debit', amount, description },
      { account_id: safeHavenAccountId, entry_type: 'credit', amount, description },
    ],
  },

  // Phase 5: Savings operations
  savings_contribution: {
    buildLines: ({ amount, walletAccountId, productAccountId, description }) => {
      if (!productAccountId) throw new Error('savings_contribution requires productAccountId');
      return [
        { account_id: walletAccountId, entry_type: 'debit', amount, description: `Wallet → Savings: ${description}` },
        { account_id: productAccountId, entry_type: 'credit', amount, description: `Savings deposit: ${description}` },
      ];
    },
  },
  savings_withdrawal: {
    buildLines: ({ amount, walletAccountId, productAccountId, description }) => {
      if (!productAccountId) throw new Error('savings_withdrawal requires productAccountId');
      return [
        { account_id: productAccountId, entry_type: 'debit', amount, description: `Savings withdrawal: ${description}` },
        { account_id: walletAccountId, entry_type: 'credit', amount, description: `Savings → Wallet: ${description}` },
      ];
    },
  },
  savings_interest: {
    buildLines: ({ amount, productAccountId, interestExpenseAccountId, description }) => {
      if (!productAccountId) throw new Error('savings_interest requires productAccountId');
      if (!interestExpenseAccountId) throw new Error('savings_interest requires interestExpenseAccountId');
      return [
        { account_id: interestExpenseAccountId, entry_type: 'debit', amount, description: `Interest expense: ${description}` },
        { account_id: productAccountId, entry_type: 'credit', amount, description: `Interest earned: ${description}` },
      ];
    },
  },

  // Phase 6: Loan operations
  loan_disbursement: {
    buildLines: ({ amount, walletAccountId, productAccountId, description }) => {
      if (!productAccountId) throw new Error('loan_disbursement requires productAccountId');
      return [
        { account_id: productAccountId, entry_type: 'debit', amount, description: `Loan disbursement: ${description}` },
        { account_id: walletAccountId, entry_type: 'credit', amount, description: `Loan to wallet: ${description}` },
      ];
    },
  },
  loan_repayment: {
    buildLines: ({ amount, walletAccountId, productAccountId, description }) => {
      if (!productAccountId) throw new Error('loan_repayment requires productAccountId');
      return [
        { account_id: walletAccountId, entry_type: 'debit', amount, description: `Loan repayment (principal): ${description}` },
        { account_id: productAccountId, entry_type: 'credit', amount, description: `Principal repaid: ${description}` },
      ];
    },
  },
  loan_interest: {
    buildLines: ({ amount, walletAccountId, interestRevenueAccountId, description }) => {
      if (!interestRevenueAccountId) throw new Error('loan_interest requires interestRevenueAccountId');
      return [
        { account_id: walletAccountId, entry_type: 'debit', amount, description: `Loan interest payment: ${description}` },
        { account_id: interestRevenueAccountId, entry_type: 'credit', amount, description: `Interest income: ${description}` },
      ];
    },
  },
  loan_penalty: {
    buildLines: ({ amount, productAccountId, feeRevenueAccountId, description }) => {
      if (!productAccountId) throw new Error('loan_penalty requires productAccountId');
      if (!feeRevenueAccountId) throw new Error('loan_penalty requires feeRevenueAccountId');
      return [
        { account_id: productAccountId, entry_type: 'debit', amount, description: `Late payment penalty: ${description}` },
        { account_id: feeRevenueAccountId, entry_type: 'credit', amount, description: `Penalty income: ${description}` },
      ];
    },
  },

  // Phase 7: Group Savings operations
  // Contribution: member's wallet → group pool
  // Debit Wallet (2000.{wallet}), Credit Group Pool (2005.{group})
  group_contribution: {
    buildLines: ({ amount, walletAccountId, productAccountId, description }) => {
      if (!productAccountId) throw new Error('group_contribution requires productAccountId');
      return [
        { account_id: walletAccountId, entry_type: 'debit', amount, description: `Group contribution: ${description}` },
        { account_id: productAccountId, entry_type: 'credit', amount, description: `Pool deposit: ${description}` },
      ];
    },
  },
  // Payout: group pool → member's wallet (Esusu rotation, distribution, etc.)
  // Debit Group Pool (2005.{group}), Credit Wallet (2000.{wallet})
  group_payout: {
    buildLines: ({ amount, walletAccountId, productAccountId, description }) => {
      if (!productAccountId) throw new Error('group_payout requires productAccountId');
      return [
        { account_id: productAccountId, entry_type: 'debit', amount, description: `Pool payout: ${description}` },
        { account_id: walletAccountId, entry_type: 'credit', amount, description: `Group payout to wallet: ${description}` },
      ];
    },
  },
};

export function getPostingTemplate(type: string): PostingTemplate | null {
  return TEMPLATES[type] || null;
}

export function hasPostingTemplate(type: string): boolean {
  return type in TEMPLATES;
}

export function requiresProductAccount(type: string): boolean {
  return ['savings_contribution', 'savings_withdrawal', 'savings_interest',
          'loan_disbursement', 'loan_repayment', 'loan_penalty',
          'group_contribution', 'group_payout'].includes(type);
}

export function requiresInterestRevenueAccount(type: string): boolean {
  return ['loan_interest'].includes(type);
}

export function requiresFeeRevenueAccount(type: string): boolean {
  return ['loan_penalty'].includes(type);
}
