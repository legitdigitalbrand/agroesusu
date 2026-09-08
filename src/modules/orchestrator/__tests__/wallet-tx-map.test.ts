import { mapWalletTxType } from '../orchestrator';

/**
 * The wallet_transactions.transaction_type column is a DB enum (wallet_tx_type).
 * Every internal FT type the orchestrator writes MUST map to a valid enum value,
 * or the read-model insert fails and the customer never sees the transaction
 * in History. This test locks in that guarantee.
 */

const VALID_WALLET_TX_TYPES = [
  'deposit', 'transfer_in', 'transfer_out', 'withdrawal', 'fee',
  'interest', 'penalty', 'loan_disbursement', 'loan_repayment',
  'reversal', 'adjustment', 'unknown',
];

const INTERNAL_TYPES = [
  'wallet_deposit', 'incoming_deposit', 'savings_withdrawal', 'group_payout',
  'investment_redemption', 'investment_returns', 'wallet_withdrawal',
  'savings_contribution', 'group_contribution', 'investment_subscription',
  'investment_reinvest', 'loan_disbursement', 'loan_repayment',
  'loan_interest', 'loan_penalty', 'savings_interest', 'fee_charge', 'reversal',
];

describe('mapWalletTxType', () => {
  it.each(INTERNAL_TYPES)('maps "%s" to a valid wallet_tx_type enum value', (t) => {
    expect(VALID_WALLET_TX_TYPES).toContain(mapWalletTxType(t));
  });

  it('maps known internal types to their canonical enum values', () => {
    expect(mapWalletTxType('incoming_deposit')).toBe('deposit');
    expect(mapWalletTxType('savings_contribution')).toBe('transfer_out');
    expect(mapWalletTxType('wallet_withdrawal')).toBe('withdrawal');
    expect(mapWalletTxType('savings_interest')).toBe('interest');
    expect(mapWalletTxType('reversal')).toBe('reversal');
  });

  it('falls back to "unknown" for unmapped types instead of violating the enum', () => {
    expect(mapWalletTxType('some_new_future_type')).toBe('unknown');
  });
});
