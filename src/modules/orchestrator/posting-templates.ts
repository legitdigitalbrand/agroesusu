// ============================================================================
// Posting Templates — Transaction Type → Journal Lines
// 
// EXTENDED IN PHASE 15: Added incoming_deposit template.
// ============================================================================

import type { JournalLineInput } from '@/modules/ledger';

interface PostingTemplateParams {
  amount: number;
  walletAccountId: string;
  safeHavenAccountId: string;
  escrowAccountId?: string;
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

  // Phase 15: Incoming deposit (external bank transfer to DVA)
  incoming_deposit: {
    buildLines: ({ amount, walletAccountId, safeHavenAccountId, description }) => [
      { account_id: safeHavenAccountId, entry_type: 'debit', amount, description: `Incoming: ${description}` },
      { account_id: walletAccountId, entry_type: 'credit', amount, description: `Wallet funding: ${description}` },
    ],
  },

  wallet_withdrawal: {
    buildLines: ({ amount, walletAccountId, safeHavenAccountId, description }) => [
      { account_id: walletAccountId, entry_type: 'debit', amount, description },
      { account_id: safeHavenAccountId, entry_type: 'credit', amount, description },
    ],
  },

  // Phase 14: External bank withdrawal — two-phase
  wallet_withdrawal_reservation: {
    buildLines: ({ amount, walletAccountId, escrowAccountId, description }) => {
      if (!escrowAccountId) throw new Error('wallet_withdrawal_reservation requires escrowAccountId');
      return [
        { account_id: walletAccountId, entry_type: 'debit', amount, description },
        { account_id: escrowAccountId, entry_type: 'credit', amount, description },
      ];
    },
  },
  wallet_withdrawal_settlement: {
    buildLines: ({ amount, escrowAccountId, safeHavenAccountId, description }) => {
      if (!escrowAccountId) throw new Error('wallet_withdrawal_settlement requires escrowAccountId');
      return [
        { account_id: escrowAccountId, entry_type: 'debit', amount, description },
        { account_id: safeHavenAccountId, entry_type: 'credit', amount, description },
      ];
    },
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
        { account_id: walletAccountId, entry_type: 'debit', amount, description: `Loan repayment: ${description}` },
        { account_id: productAccountId, entry_type: 'credit', amount, description: `Loan repaid: ${description}` },
      ];
    },
  },
  loan_interest: {
    buildLines: ({ amount, walletAccountId, productAccountId, interestRevenueAccountId, description }) => {
      if (!productAccountId) throw new Error('loan_interest requires productAccountId');
      if (!interestRevenueAccountId) throw new Error('loan_interest requires interestRevenueAccountId');
      return [
        { account_id: walletAccountId, entry_type: 'debit', amount, description: `Interest: ${description}` },
        { account_id: interestRevenueAccountId, entry_type: 'credit', amount, description: `Interest revenue: ${description}` },
      ];
    },
  },
  loan_penalty: {
    buildLines: ({ amount, walletAccountId, feeRevenueAccountId, description }) => {
      if (!feeRevenueAccountId) throw new Error('loan_penalty requires feeRevenueAccountId');
      return [
        { account_id: walletAccountId, entry_type: 'debit', amount, description: `Penalty: ${description}` },
        { account_id: feeRevenueAccountId, entry_type: 'credit', amount, description: `Penalty revenue: ${description}` },
      ];
    },
  },

  // Phase 7: Group savings operations
  group_contribution: {
    buildLines: ({ amount, walletAccountId, productAccountId, description }) => {
      if (!productAccountId) throw new Error('group_contribution requires productAccountId');
      return [
        { account_id: walletAccountId, entry_type: 'debit', amount, description: `Group contribution: ${description}` },
        { account_id: productAccountId, entry_type: 'credit', amount, description: `Group savings: ${description}` },
      ];
    },
  },
  group_payout: {
    buildLines: ({ amount, walletAccountId, productAccountId, description }) => {
      if (!productAccountId) throw new Error('group_payout requires productAccountId');
      return [
        { account_id: productAccountId, entry_type: 'debit', amount, description: `Group payout: ${description}` },
        { account_id: walletAccountId, entry_type: 'credit', amount, description: `Payout to wallet: ${description}` },
      ];
    },
  },

  // Phase 8: Investment operations
  investment_subscription: {
    buildLines: ({ amount, walletAccountId, productAccountId, description }) => {
      if (!productAccountId) throw new Error('investment_subscription requires productAccountId');
      return [
        { account_id: walletAccountId, entry_type: 'debit', amount, description: `Investment subscription: ${description}` },
        { account_id: productAccountId, entry_type: 'credit', amount, description: `Investment funded: ${description}` },
      ];
    },
  },
  investment_redemption: {
    buildLines: ({ amount, walletAccountId, productAccountId, description }) => {
      if (!productAccountId) throw new Error('investment_redemption requires productAccountId');
      return [
        { account_id: productAccountId, entry_type: 'debit', amount, description: `Investment redemption: ${description}` },
        { account_id: walletAccountId, entry_type: 'credit', amount, description: `Redemption to wallet: ${description}` },
      ];
    },
  },
  investment_returns: {
    buildLines: ({ amount, walletAccountId, interestExpenseAccountId, description }) => {
      if (!interestExpenseAccountId) throw new Error('investment_returns requires interestExpenseAccountId');
      return [
        { account_id: interestExpenseAccountId, entry_type: 'debit', amount, description: `Returns payout: ${description}` },
        { account_id: walletAccountId, entry_type: 'credit', amount, description: `Returns to wallet: ${description}` },
      ];
    },
  },
  investment_reinvest: {
    buildLines: ({ amount, productAccountId, interestExpenseAccountId, description }) => {
      if (!productAccountId) throw new Error('investment_reinvest requires productAccountId');
      if (!interestExpenseAccountId) throw new Error('investment_reinvest requires interestExpenseAccountId');
      return [
        { account_id: interestExpenseAccountId, entry_type: 'debit', amount, description: `Returns reinvested: ${description}` },
        { account_id: productAccountId, entry_type: 'credit', amount, description: `Reinvestment: ${description}` },
      ];
    },
  },

  // Misc
  fee_charge: {
    buildLines: ({ amount, walletAccountId, feeRevenueAccountId, description }) => {
      if (!feeRevenueAccountId) throw new Error('fee_charge requires feeRevenueAccountId');
      return [
        { account_id: walletAccountId, entry_type: 'debit', amount, description: `Fee: ${description}` },
        { account_id: feeRevenueAccountId, entry_type: 'credit', amount, description: `Fee revenue: ${description}` },
      ];
    },
  },
  adjustment: {
    buildLines: ({ amount, walletAccountId, safeHavenAccountId, description }) => [
      { account_id: walletAccountId, entry_type: 'debit', amount, description: `Adjustment: ${description}` },
      { account_id: safeHavenAccountId, entry_type: 'credit', amount, description: `Adjustment offset: ${description}` },
    ],
  },
};

export function getPostingTemplate(type: string): PostingTemplate | null {
  return TEMPLATES[type] || null;
}

export function requiresProductAccount(type: string): boolean {
  return ['savings_contribution', 'savings_withdrawal', 'savings_interest',
          'loan_disbursement', 'loan_repayment', 'loan_penalty',
          'group_contribution', 'group_payout',
          'investment_subscription', 'investment_redemption', 'investment_reinvest'].includes(type);
}

export function requiresInterestRevenueAccount(type: string): boolean {
  return ['loan_interest'].includes(type);
}

export function requiresFeeRevenueAccount(type: string): boolean {
  return ['loan_penalty'].includes(type);
}

export function requiresInterestExpenseAccount(type: string): boolean {
  return ['savings_interest', 'investment_returns', 'investment_reinvest'].includes(type);
}
