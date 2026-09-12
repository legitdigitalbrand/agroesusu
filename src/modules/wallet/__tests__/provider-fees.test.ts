// ============================================================================
// Provider Fee Mirroring Tests
//
// Covers the fee drift fix (2026-09-12): Safe Haven charges fees+VAT
// against the customer's real DVA; those charges must be mirrored into
// the internal ledger (D Wallet, C Safe Haven) or the wallet balance
// overstates what the DVA can actually pay out.
// ============================================================================

import { getPostingTemplate } from '../../orchestrator/posting-templates';
import {
  extractProviderFee,
  extractProviderAccountId,
} from '../provider-fees';

describe('Provider Fee Mirroring — Financial Integrity', () => {

  describe('provider_fee posting template', () => {
    it('debits the wallet and credits the Safe Haven account', () => {
      const template = getPostingTemplate('provider_fee');
      expect(template).toBeDefined();

      const lines = template!.buildLines({
        amount: 10.75,
        walletAccountId: 'wallet-acc-1',
        safeHavenAccountId: 'sh-acc-1',
        description: 'Safe Haven fee on transfer of ₦100',
      });

      expect(lines).toHaveLength(2);
      // Customer's claim on us drops: wallet account is DEBITED
      expect(lines[0]).toMatchObject({
        account_id: 'wallet-acc-1',
        entry_type: 'debit',
        amount: 10.75,
      });
      // Real provider money drops: Safe Haven mirror is CREDITED
      expect(lines[1]).toMatchObject({
        account_id: 'sh-acc-1',
        entry_type: 'credit',
        amount: 10.75,
      });
      // Balanced entry — no phantom money
      const debits = lines.filter(l => l.entry_type === 'debit').reduce((s, l) => s + l.amount, 0);
      const credits = lines.filter(l => l.entry_type === 'credit').reduce((s, l) => s + l.amount, 0);
      expect(debits).toBe(credits);
    });
  });

  describe('extractProviderFee', () => {
    it('sums fees + vat + stampDuty from a real Safe Haven debit payload', () => {
      // Actual shape observed in production inbound_events (2026-09-11):
      const payload = {
        data: { _id: '6aa4085f1673cf0024cb3568', amount: 100, fees: 10, vat: 0.75, stampDuty: 0, type: 'Outwards' },
      };
      expect(extractProviderFee(payload)).toBe(10.75);
    });

    it('sums credit-event fees (fees 5 + vat 0.38)', () => {
      const payload = {
        data: { _id: '6aa13b190f99210024682aca', amount: 100, fees: 5, vat: 0.38, stampDuty: 0, type: 'Inwards' },
      };
      expect(extractProviderFee(payload)).toBe(5.38);
    });

    it('includes stamp duty when present', () => {
      const payload = { data: { fees: 10, vat: 0.75, stampDuty: 50 } };
      expect(extractProviderFee(payload)).toBe(60.75);
    });

    it('returns 0 for fee-free events', () => {
      expect(extractProviderFee({ data: { amount: 50, fees: 0, vat: 0 } })).toBe(0);
      expect(extractProviderFee({ data: { amount: 50 } })).toBe(0);
      expect(extractProviderFee({})).toBe(0);
    });

    it('never returns a negative amount', () => {
      expect(extractProviderFee({ data: { fees: -5, vat: -1 } })).toBe(0);
    });
  });

  describe('extractProviderAccountId', () => {
    it('reads the provider account id from debit payloads', () => {
      const payload = { data: { account: '6aa01f4390737600248a15d2', amount: 100 } };
      expect(extractProviderAccountId(payload)).toBe('6aa01f4390737600248a15d2');
    });

    it('tolerates top-level payloads without a data wrapper', () => {
      expect(extractProviderAccountId({ account: '6549388d043f1b00241d1523' })).toBe('6549388d043f1b00241d1523');
    });

    it('returns null when no account is present', () => {
      expect(extractProviderAccountId({ data: { amount: 100 } })).toBeNull();
      expect(extractProviderAccountId({})).toBeNull();
    });
  });

  describe('postProviderFee contract', () => {
    it('skips zero-fee postings — no free-floating ledger noise', async () => {
      // postProviderFee must never post an entry for a zero/negative fee.
      // We test the contract via dynamic import with the orchestrator mocked,
      // asserting the mock is NOT called for a zero fee.
      jest.mock('../../orchestrator', () => ({
        initiate: jest.fn().mockResolvedValue({
          id: 'ft-1', transaction_reference: 'FT-1', status: 'posted', amount: 0, description: '',
        }),
      }));
      const { postProviderFee } = await import('../provider-fees');
      const { initiate } = await import('../../orchestrator');

      const result = await postProviderFee({
        wallet_id: 'w1', amount: 0, description: 'no fee', idempotency_key: 'provider_fee:none',
      });

      expect(result.status).toBe('skipped');
      expect(result.posted).toBe(false);
      expect(initiate).not.toHaveBeenCalled();
    });
  });
});
