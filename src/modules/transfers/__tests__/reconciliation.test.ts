// ============================================================================
// Gate 4 P1 — Stale Pending Transfer Reconciliation: unit tests
//
// Covers the required scenarios:
//   1. stale pending transfer is selected and processed
//   2. provider SUCCESS  → hold settled, transfer finalized, audited
//   3. provider FAILURE  → hold/reservation reversed, funds returned, audited
//   4. provider REVERSAL → financial effect reversed, distinct audited outcome
//   5. provider STILL PENDING → everything retained, retry scheduled
//   6. provider UNAVAILABLE → nothing released, error recorded, retry later
//   7. duplicate reconciliation → idempotent no-op
//   8. webhook + cron race → claim_lost, single financial effect
//   9. concurrent reconciliation → claim_lost on the reversal path
//  10. hold release (crash window: reservation never posted)
//  11. hold settlement (deterministic settlement key + cache refresh)
//  12. crash/retry recovery (reservation posted but route crashed; legacy row flagged)
// ============================================================================

// ── Mocked dependencies ─────────────────────────────────────────────────────

const mockGetTransferStatus = jest.fn();
jest.mock('@/modules/integrations', () => ({
  getBankingProvider: () => ({ getTransferStatus: mockGetTransferStatus }),
}));

const mockInitiate = jest.fn();
const mockReverse = jest.fn();
jest.mock('@/modules/orchestrator', () => ({
  initiate: (...args: unknown[]) => mockInitiate(...args),
  reverse: (...args: unknown[]) => mockReverse(...args),
}));

const mockRefreshCache = jest.fn();
jest.mock('@/modules/ledger', () => ({
  refreshWalletBalanceCache: (...args: unknown[]) => mockRefreshCache(...args),
}));

const mockReleaseHold = jest.fn();
jest.mock('@/modules/wallet/holds', () => ({
  releaseWalletHold: (...args: unknown[]) => mockReleaseHold(...args),
}));

// ── Supabase mock ────────────────────────────────────────────────────────────
// A tiny thenable query-builder that emulates the PostgREST semantics the
// reconciliation module relies on — especially the CONDITIONAL UPDATE
// (optimistic-lock claim) returning null data when the status filter no
// longer matches.

interface TransferRow {
  id: string;
  reference: string;
  payment_reference: string | null;
  status: string;
  amount: number;
  wallet_id: string;
  customer_id: string;
  metadata: Record<string, unknown> | null;
  provider_response: Record<string, unknown> | null;
  created_at: string;
}

class Builder {
  private table: string;
  private op: 'select' | 'update' | 'insert' | 'delete' = 'select';
  private updateData: Record<string, unknown> | null = null;
  private insertData: unknown = null;
  private filters: Array<[string, unknown]> = [];
  private hasSelectAfterUpdate = false;
  private isMaybeSingle = false;

  constructor(table: string) { this.table = table; }
  select(_cols?: string) { if (this.op === 'update') this.hasSelectAfterUpdate = true; return this; }
  eq(col: string, val: unknown) { this.filters.push([col, val]); return this; }
  in(col: string, vals: unknown[]) { this.filters.push([col, vals]); return this; }
  lt(col: string, val: unknown) { this.filters.push(['__lt:' + col, val]); return this; }
  order(_col: string, _opts?: unknown) { return this; }
  limit(_n: number) { return this; }
  maybeSingle() { this.isMaybeSingle = true; return this; }
  update(data: Record<string, unknown>) { this.op = 'update'; this.updateData = data; return this; }
  insert(data: unknown) { this.op = 'insert'; this.insertData = data; return this; }

  then(resolve: (v: unknown) => void, reject: (e: unknown) => void) {
    this.execute().then(resolve, reject);
    return this as never;
  }

  private matchFilters(row: Record<string, unknown>): boolean {
    for (const [col, val] of this.filters) {
      if (col.startsWith('__lt:')) {
        const field = col.slice(5);
        if (new Date(row[field] as string) >= new Date(val as string)) return false;
      } else if (Array.isArray(val)) {
        if (!val.includes(row[col])) return false;
      } else if (row[col] !== val) {
        return false;
      }
    }
    return true;
  }

  private async execute() {
    const state = (globalThis as any).__db;
    if (this.table === 'transfers') {
      if (this.op === 'select') {
        const rows = Object.values(state.transfers).filter((r: any) => this.matchFilters(r));
        const data = this.isMaybeSingle ? (rows[0] ?? null) : rows;
        return { data, error: null };
      }
      if (this.op === 'update') {
        // Conditional UPDATE: match on id + all eq filters. Returns the row
        // (via .select()) only if EVERY filter matched — null otherwise.
        const row = state.transfers[this.filters.find(f => f[0] === 'id')?.[1] as string];
        if (!row) return { data: null, error: null };
        const match = this.matchFilters(row);
        if (match && this.updateData) {
          Object.assign(row, this.updateData);
          state.transferHistory.push({ ...row });
        }
        if (this.hasSelectAfterUpdate) {
          return { data: match ? { id: row.id } : null, error: null };
        }
        return { data: null, error: null };
      }
    }
    if (this.table === 'financial_transactions') {
      if (this.op === 'select') {
        const key = this.filters.find(f => f[0] === 'idempotency_key')?.[1] as string;
        const ft = state.fts[key as string] ?? null;
        return { data: ft ? { id: ft.id, status: ft.status } : null, error: null };
      }
    }
    if (this.table === 'transfer_reconciliation_audits' && this.op === 'insert') {
      state.audits.push(this.insertData);
      return { data: null, error: null };
    }
    if (this.table === 'reconciliation_flags' && this.op === 'insert') {
      state.flags.push(this.insertData);
      return { data: null, error: null };
    }
    return { data: null, error: null };
  }
}

const mockSupabase = { from: (table: string) => new Builder(table) };
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => mockSupabase,
}));

import { reconcileStaleTransfers, reconcileTransfer } from '../reconciliation';

// ── Test fixtures ─────────────────────────────────────────────────────────────

let db: any;

function makeTransfer(overrides: Partial<TransferRow> = {}): TransferRow {
  return {
    id: 't-1',
    reference: 'TRF-TEST1234',
    payment_reference: 'PAY-REF-1',
    status: 'pending',
    amount: 5000,
    wallet_id: 'w-1',
    customer_id: 'c-1',
    metadata: { idempotency_key: 'idem-key-1', reservation_ft_id: 'ft-res-1' },
    provider_response: {},
    created_at: new Date(Date.now() - 30 * 60_000).toISOString(),
    ...overrides,
  };
}

function resetDb(transfer: TransferRow) {
  db = {
    transfers: { [transfer.id]: { ...transfer } },
    transferHistory: [],
    fts: { 'bank_transfer_reservation:idem-key-1': { id: 'ft-res-1', status: 'completed' } },
    audits: [],
    flags: [],
  };
  (globalThis as any).__db = db;
}

const providerSuccess = { reference: 'SH-REF-1', status: 'success' as const, rawStatus: 'success', message: 'ok' };
const providerPending = { reference: 'SH-REF-1', status: 'pending' as const, rawStatus: 'pending', message: 'in flight' };
const providerFailed = { reference: 'SH-REF-1', status: 'failed' as const, rawStatus: 'failed', message: 'rejected' };
const providerReversed = { reference: 'SH-REF-1', status: 'failed' as const, rawStatus: 'REVERSED', message: 'reversed by provider' };

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
});

beforeEach(() => {
  jest.clearAllMocks();
  mockGetTransferStatus.mockResolvedValue(providerPending);
  mockInitiate.mockResolvedValue({ id: 'ft-set-1', transaction_reference: 'FT-SET-1', status: 'completed', amount: 5000 });
  mockReverse.mockResolvedValue({ id: 'ft-rev-1', transaction_reference: 'FT-REV-1', status: 'completed', amount: 5000 });
  mockRefreshCache.mockResolvedValue(undefined);
  mockReleaseHold.mockResolvedValue(true);
});

describe('reconcileStaleTransfers — stale transfer selection', () => {
  it('selects a stale pending transfer, reconciles it, and writes an audit record', async () => {
    resetDb(makeTransfer());
    mockGetTransferStatus.mockResolvedValue(providerPending);

    const { processed, results } = await reconcileStaleTransfers(15);

    expect(processed).toBe(1);
    expect(results[0].status).toBe('still_pending');
    // Audit record required fields
    const audit = db.audits[0];
    expect(audit.transfer_id).toBe('t-1');
    expect(audit.previous_status).toBe('pending');
    expect(audit.provider_status).toBe('pending');
    expect(audit.resulting_status).toBe('pending');
    expect(audit.action).toBe('pending_retry');
    expect(audit.source).toBe('cron');
    // The provider's own reference is recorded (falls back to payment_reference)
    expect(audit.safe_haven_reference).toBe('SH-REF-1');
  });

  it('ignores fresh transfers (below the staleness threshold)', async () => {
    resetDb(makeTransfer({ created_at: new Date().toISOString() }));
    const { processed } = await reconcileStaleTransfers(15);
    expect(processed).toBe(0);
  });
});

describe('reconcileTransfer — provider SUCCESS', () => {
  it('claims, settles the escrow hold, finalizes the transfer, and audits', async () => {
    resetDb(makeTransfer());
    mockGetTransferStatus.mockResolvedValue(providerSuccess);

    const result = await reconcileTransfer('t-1', 'cron');

    expect(result.status).toBe('settled');
    // Claim then finalize: pending → settling → success
    expect(db.transfers['t-1'].status).toBe('success');
    // Settlement FTO: deterministic key, exactly once
    expect(mockInitiate).toHaveBeenCalledTimes(1);
    const request = mockInitiate.mock.calls[0][0];
    expect(request.idempotency_key).toBe('bank_transfer_settlement:idem-key-1');
    expect(request.transaction_type).toBe('wallet_withdrawal_settlement');
    expect(request.amount).toBe(5000);
    expect(request.metadata.transfer_id).toBe('t-1');
    // Wallet balance cache refreshed after settlement
    expect(mockRefreshCache).toHaveBeenCalledWith('w-1');
    // Audit
    const audit = db.audits[0];
    expect(audit.action).toBe('settled');
    expect(audit.previous_status).toBe('pending');
    expect(audit.provider_status).toBe('success');
    expect(audit.resulting_status).toBe('success');
    expect(audit.metadata.reservation_ft_id).toBe('ft-res-1');
  });

  it('when the settlement FTO fails, does NOT mark success — retains and flags', async () => {
    resetDb(makeTransfer());
    mockGetTransferStatus.mockResolvedValue(providerSuccess);
    mockInitiate.mockResolvedValue({ status: 'failed', error: 'ledger posting error' });

    const result = await reconcileTransfer('t-1', 'cron');

    expect(result.status).toBe('retained_error');
    expect(db.transfers['t-1'].status).toBe('pending_settlement');
    expect(db.flags[0].flag_type).toBe('settlement_failed');
    expect(db.flags[0].severity).toBe('critical');
    expect(db.audits[0].action).toBe('retained_error');
    expect(db.audits[0].resulting_status).toBe('pending_settlement');
  });
});

describe('reconcileTransfer — provider FAILED', () => {
  it('claims, reverses the reservation (funds back to wallet), marks failed, and audits', async () => {
    resetDb(makeTransfer());
    mockGetTransferStatus.mockResolvedValue(providerFailed);

    const result = await reconcileTransfer('t-1', 'webhook');

    expect(result.status).toBe('reversed_funds_returned');
    expect(db.transfers['t-1'].status).toBe('failed');
    // Reversal FTO: deterministic key tied to the reservation FT
    expect(mockReverse).toHaveBeenCalledTimes(1);
    expect(mockReverse.mock.calls[0][0].original_transaction_id).toBe('ft-res-1');
    expect(mockReverse.mock.calls[0][0].idempotency_key).toBe('reversal:ft-res-1');
    // Funds returned → wallet cache refreshed
    expect(mockRefreshCache).toHaveBeenCalledWith('w-1');
    const audit = db.audits[0];
    expect(audit.action).toBe('reversed_funds_returned');
    expect(audit.resulting_status).toBe('failed');
    expect(audit.metadata.funds).toBe('returned_to_wallet');
  });

  it('when the reversal FTO fails, retains the transfer and flags it critical', async () => {
    resetDb(makeTransfer());
    mockGetTransferStatus.mockResolvedValue(providerFailed);
    mockReverse.mockResolvedValue({ status: 'failed', error: 'escrow account missing' });

    const result = await reconcileTransfer('t-1', 'cron');

    expect(result.status).toBe('retained_error');
    // Back to previous status so the next cron run retries
    expect(db.transfers['t-1'].status).toBe('pending');
    expect(db.flags[0].flag_type).toBe('reversal_failed');
    expect(db.flags[0].severity).toBe('critical');
  });
});

describe('reconcileTransfer — provider REVERSED (raw status)', () => {
  it('reverses the financial effect, marks the transfer reversed (distinct from failed), and audits', async () => {
    resetDb(makeTransfer());
    mockGetTransferStatus.mockResolvedValue(providerReversed);

    const result = await reconcileTransfer('t-1', 'cron');

    expect(result.status).toBe('reversed_funds_returned');
    expect(db.transfers['t-1'].status).toBe('reversed');
    expect(mockReverse).toHaveBeenCalledTimes(1);
    const audit = db.audits[0];
    expect(audit.action).toBe('reversed_funds_returned');
    expect(audit.resulting_status).toBe('reversed');
    expect(audit.provider_raw_status).toBe('REVERSED');
    expect(audit.provider_status).toBe('reversed');
  });
});

describe('reconcileTransfer — provider STILL PENDING', () => {
  it('keeps the hold and the reservation; does not move funds; schedules retry', async () => {
    resetDb(makeTransfer());
    mockGetTransferStatus.mockResolvedValue(providerPending);

    const result = await reconcileTransfer('t-1', 'cron');

    expect(result.status).toBe('still_pending');
    // Nothing changed, nothing moved
    expect(db.transfers['t-1'].status).toBe('pending');
    expect(mockInitiate).not.toHaveBeenCalled();
    expect(mockReverse).not.toHaveBeenCalled();
    expect(mockReleaseHold).not.toHaveBeenCalled();
    // Audit with pending_retry
    expect(db.audits[0].action).toBe('pending_retry');
    expect(db.audits[0].metadata).toEqual(
      expect.objectContaining({ hold: 'kept', reservation: 'kept', retry_scheduled: true })
    );
  });
});

describe('reconcileTransfer — provider UNAVAILABLE', () => {
  it('does not release the hold, retains the transfer, records the error, and retries later', async () => {
    resetDb(makeTransfer());
    mockGetTransferStatus.mockRejectedValue(new Error('Safe Haven 5xx'));

    const result = await reconcileTransfer('t-1', 'cron');

    expect(result.status).toBe('retained_error');
    expect(result.message).toContain('Safe Haven 5xx');
    // Nothing changed, nothing moved
    expect(db.transfers['t-1'].status).toBe('pending');
    expect(mockInitiate).not.toHaveBeenCalled();
    expect(mockReverse).not.toHaveBeenCalled();
    // Audit records the failure for the trail
    expect(db.audits[0].action).toBe('retained_error');
    expect(db.audits[0].provider_status).toBe('unavailable');
    expect(db.audits[0].error_message).toContain('Safe Haven 5xx');
    expect(db.audits[0].metadata).toEqual(
      expect.objectContaining({ retained: true, hold: 'kept', reservation: 'kept' })
    );
  });
});

describe('reconcileTransfer — duplicate reconciliation (idempotency)', () => {
  it('a terminal transfer is a no-op: no provider query, no financial effect', async () => {
    resetDb(makeTransfer({ status: 'success' }));

    const result = await reconcileTransfer('t-1', 'cron');

    expect(result.status).toBe('terminal_noop');
    expect(mockGetTransferStatus).not.toHaveBeenCalled();
    expect(mockInitiate).not.toHaveBeenCalled();
    expect(mockReverse).not.toHaveBeenCalled();
    expect(db.audits[0].action).toBe('terminal_noop');
  });

  it('reconciling the same transfer twice settles it exactly once', async () => {
    resetDb(makeTransfer());
    mockGetTransferStatus.mockResolvedValue(providerSuccess);

    await reconcileTransfer('t-1', 'webhook');
    const second = await reconcileTransfer('t-1', 'cron'); // cron arrives late

    // Second run sees terminal success → no second settlement FTO
    expect(second.status).toBe('terminal_noop');
    expect(mockInitiate).toHaveBeenCalledTimes(1);
  });
});

describe('reconcileTransfer — webhook + cron race', () => {
  it('when the webhook claims first, the cron aborts with claim_lost — single financial effect', async () => {
    resetDb(makeTransfer());
    // Simulate the webhook claiming the transfer DURING the cron's provider
    // query: the status changes to 'settling' before the cron's claim runs.
    mockGetTransferStatus.mockImplementation(async () => {
      db.transfers['t-1'].status = 'settling'; // webhook claimed mid-flight
      return providerSuccess;
    });

    const result = await reconcileTransfer('t-1', 'cron');

    expect(result.status).toBe('claim_lost');
    // The cron must NOT have posted its own settlement FTO — the webhook owns the claim
    expect(mockInitiate).not.toHaveBeenCalled();
    // Claim loss is audited for the race trail
    const audit = db.audits[0];
    expect(audit.action).toBe('claim_lost');
    expect(audit.provider_status).toBe('success');
  });

  it('reversal path: claim lost when another reconciler already holds the claim', async () => {
    resetDb(makeTransfer());
    mockGetTransferStatus.mockImplementation(async () => {
      db.transfers['t-1'].status = 'reversing'; // concurrent reconciler claimed
      return providerFailed;
    });

    const result = await reconcileTransfer('t-1', 'cron');

    expect(result.status).toBe('claim_lost');
    expect(mockReverse).not.toHaveBeenCalled();
    expect(db.audits[0].action).toBe('claim_lost');
  });
});

describe('reconcileTransfer — hold release (crash window: reservation never posted)', () => {
  it('releases the hold, marks the transfer failed, and audits — no funds were escrowed', async () => {
    resetDb(makeTransfer({ status: 'initiated' }));
    // No reservation FTO exists for this key
    db.fts = {};

    const result = await reconcileTransfer('t-1', 'cron');

    expect(result.status).toBe('marked_failed');
    expect(db.transfers['t-1'].status).toBe('failed');
    // The concurrency hold is explicitly released
    expect(mockReleaseHold).toHaveBeenCalledWith('hold:idem-key-1');
    // Provider is never even asked — there is nothing to settle
    expect(mockGetTransferStatus).not.toHaveBeenCalled();
    expect(db.audits[0].action).toBe('marked_failed_no_funds');
  });
});

describe('reconcileTransfer — hold settlement correctness', () => {
  it('settlement uses the deterministic key derived from the transfer (idempotent vs webhook)', async () => {
    resetDb(makeTransfer());
    mockGetTransferStatus.mockResolvedValue(providerSuccess);

    await reconcileTransfer('t-1', 'cron');

    const request = mockInitiate.mock.calls[0][0];
    // Exactly the key the transfers route uses — webhook and cron converge
    // on the same FTO even if both slip past the claim
    expect(request.idempotency_key).toBe('bank_transfer_settlement:idem-key-1');
    expect(request.source_reference).toBe('t-1');
    expect(request.metadata.safe_haven_reference).toBe('SH-REF-1');
    expect(request.metadata.reconciled).toBe(true);
  });
});

describe('reconcileTransfer — crash/retry recovery', () => {
  it('adopted: reservation posted but route crashed — reconciliation continues the flow to settlement', async () => {
    // Route crashed after the reservation FTO posted but before recording it:
    // transfer stuck in 'initiated', reservation exists in financial_transactions
    resetDb(makeTransfer({ status: 'initiated', metadata: { idempotency_key: 'idem-key-1' } }));
    mockGetTransferStatus.mockResolvedValue(providerSuccess);

    const result = await reconcileTransfer('t-1', 'cron');

    expect(result.status).toBe('settled');
    expect(db.transfers['t-1'].status).toBe('success');
    expect(mockInitiate).toHaveBeenCalledTimes(1);
    expect(db.audits[0].action).toBe('settled');
    expect(db.audits[0].previous_status).toBe('initiated');
  });

  it('legacy transfer without idempotency metadata is flagged for humans, never auto-resolved', async () => {
    resetDb(makeTransfer({ status: 'initiated', metadata: null }));

    const result = await reconcileTransfer('t-1', 'cron');

    expect(result.status).toBe('flagged_manual');
    expect(db.transfers['t-1'].status).toBe('initiated'); // unchanged
    expect(db.flags[0].flag_type).toBe('legacy_transfer_stale');
    expect(db.flags[0].severity).toBe('high');
    expect(db.audits[0].action).toBe('flagged_manual');
  });

  it('provider success without a reservation FTO is flagged critical — never auto-credited', async () => {
    // Reservation FT never posted AND metadata never recorded one
    resetDb(makeTransfer({ metadata: { idempotency_key: 'idem-key-1' } }));
    db.fts = {}; // reservation never posted
    mockGetTransferStatus.mockResolvedValue(providerSuccess);

    const result = await reconcileTransfer('t-1', 'cron');

    expect(result.status).toBe('flagged_manual');
    expect(db.flags[0].flag_type).toBe('orphaned_transfer_success');
    expect(db.flags[0].severity).toBe('critical');
    expect(mockInitiate).not.toHaveBeenCalled(); // no funds movement
    expect(db.audits[0].action).toBe('flagged_manual');
  });
});
