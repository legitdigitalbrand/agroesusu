// ============================================================================
// Unit tests — deterministic idempotency keys (Gate 4, P0 item 1)
//
// A retried money-movement request (double-click, network retry, browser
// refresh) MUST resolve to the same idempotency key as the original, so the
// financial_transactions UNIQUE(idempotency_key) constraint collapses it into
// one financial effect. These tests pin that contract.
// ============================================================================

import {
  DEDUP_WINDOW_MS,
  candidateKeysFor,
  deriveIdempotencyKey,
  deriveReference,
  IdempotencyParams,
} from '@/lib/financial-idempotency';

describe('financial-idempotency', () => {
  const baseParams: IdempotencyParams = {
    customer_id: 'c1-uuid',
    wallet_id: 'w1-uuid',
    amount: 5000,
    destination: '0123456789',
  };

  describe('deriveIdempotencyKey — param-derived (no client reference)', () => {
    it('produces identical keys for identical parameters in the same time bucket', () => {
      const now = 1_700_000_000_000;
      const k1 = deriveIdempotencyKey('bank_transfer', { ...baseParams }, now);
      const k2 = deriveIdempotencyKey('bank_transfer', { ...baseParams }, now + 5_000);
      expect(k1).toBe(k2);
    });

    it('produces the same key across the whole dedup window (retry after 59s)', () => {
      const bucketStart = Math.floor(1_700_000_000_000 / DEDUP_WINDOW_MS) * DEDUP_WINDOW_MS;
      const k1 = deriveIdempotencyKey('bank_transfer', { ...baseParams }, bucketStart);
      const k2 = deriveIdempotencyKey('bank_transfer', { ...baseParams }, bucketStart + DEDUP_WINDOW_MS - 1);
      expect(k1).toBe(k2);
    });

    it('never uses timestamp/random entropy — key is stable and reproducible', () => {
      const k1 = deriveIdempotencyKey('withdrawal', { ...baseParams }, 1_700_000_000_000);
      const k2 = deriveIdempotencyKey('withdrawal', { ...baseParams }, 1_700_000_000_000);
      expect(k1).toBe(k2);
      expect(k1).toMatch(/^withdrawal:bk:[0-9a-f]{32}:\d+$/);
    });

    it('differentiates different amounts (1 kobo precision)', () => {
      const now = 1_700_000_000_000;
      const k1 = deriveIdempotencyKey('bank_transfer', { ...baseParams, amount: 5000.01 }, now);
      const k2 = deriveIdempotencyKey('bank_transfer', { ...baseParams, amount: 5000.02 }, now);
      expect(k1).not.toBe(k2);
    });

    it('differentiates different destinations and customers', () => {
      const now = 1_700_000_000_000;
      const k1 = deriveIdempotencyKey('bank_transfer', { ...baseParams }, now);
      const k2 = deriveIdempotencyKey('bank_transfer', { ...baseParams, destination: '9876543210' }, now);
      const k3 = deriveIdempotencyKey('bank_transfer', { ...baseParams, customer_id: 'c2-uuid' }, now);
      expect(k1).not.toBe(k2);
      expect(k1).not.toBe(k3);
    });

    it('normalizes float noise (5000 vs 5000.0)', () => {
      const now = 1_700_000_000_000;
      const k1 = deriveIdempotencyKey('bank_transfer', { ...baseParams, amount: 5000 }, now);
      const k2 = deriveIdempotencyKey('bank_transfer', { ...baseParams, amount: 5000.0 }, now);
      expect(k1).toBe(k2);
    });
  });

  describe('deriveIdempotencyKey — client-supplied reference', () => {
    it('is stable forever (immune to time buckets)', () => {
      const k1 = deriveIdempotencyKey('bank_transfer', { ...baseParams, client_reference: 'ref-abc' }, 1_700_000_000_000);
      const k2 = deriveIdempotencyKey('bank_transfer', { ...baseParams, client_reference: 'ref-abc' }, 1_800_000_000_000);
      expect(k1).toBe(k2);
    });

    it('differentiates different client references from the same customer', () => {
      const k1 = deriveIdempotencyKey('bank_transfer', { ...baseParams, client_reference: 'ref-abc' }, 1);
      const k2 = deriveIdempotencyKey('bank_transfer', { ...baseParams, client_reference: 'ref-xyz' }, 1);
      expect(k1).not.toBe(k2);
    });

    it('differentiates the same client reference across customers', () => {
      const k1 = deriveIdempotencyKey('bank_transfer', { ...baseParams, client_reference: 'ref-abc' }, 1);
      const k2 = deriveIdempotencyKey('bank_transfer', { ...baseParams, customer_id: 'c2-uuid', client_reference: 'ref-abc' }, 1);
      expect(k1).not.toBe(k2);
    });
  });

  describe('candidateKeysFor — bucket-boundary retry handling', () => {
    it('includes the previous bucket so a boundary-crossing retry still finds the original', () => {
      const bucketBoundary = Math.floor(1_700_000_000_000 / DEDUP_WINDOW_MS) * DEDUP_WINDOW_MS;
      // Original request in the last millisecond of bucket N
      const originalKeys = candidateKeysFor('bank_transfer', baseParams, bucketBoundary + DEDUP_WINDOW_MS - 1);
      // Retry in the first millisecond of bucket N+1
      const retryKeys = candidateKeysFor('bank_transfer', baseParams, bucketBoundary + DEDUP_WINDOW_MS + 1);
      // The retry's candidates must include the key the original produced
      expect(retryKeys).toContain(originalKeys[0]);
    });

    it('returns a single stable key when a client reference is present', () => {
      const keys = candidateKeysFor('bank_transfer', { ...baseParams, client_reference: 'ref-abc' }, 1);
      expect(keys).toHaveLength(1);
      expect(keys[0]).toBe(deriveIdempotencyKey('bank_transfer', { ...baseParams, client_reference: 'ref-abc' }, 999));
    });
  });

  describe('deriveReference — deterministic display references', () => {
    it('produces the same reference for the same key (retries do not create new references)', () => {
      const key = deriveIdempotencyKey('bank_transfer', baseParams, 1_700_000_000_000);
      expect(deriveReference('TRF', key)).toBe(deriveReference('TRF', key));
    });

    it('produces distinct references for distinct keys', () => {
      const k1 = deriveIdempotencyKey('bank_transfer', baseParams, 1_700_000_000_000);
      const k2 = deriveIdempotencyKey('bank_transfer', { ...baseParams, amount: 6000 }, 1_700_000_000_000);
      expect(deriveReference('TRF', k1)).not.toBe(deriveReference('TRF', k2));
    });

    it('keeps a compact, uppercase format with the prefix', () => {
      const key = deriveIdempotencyKey('bank_transfer', baseParams, 1_700_000_000_000);
      expect(deriveReference('TRF', key)).toMatch(/^TRF-[A-Z0-9]{10}$/);
    });
  });
});
