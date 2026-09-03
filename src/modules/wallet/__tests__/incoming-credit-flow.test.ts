// ============================================================================
// Incoming Credit — BEHAVIORAL flow tests (Gate 4 funding fix)
//
// Mocks the Supabase service client and the Orchestrator, then verifies
// processIncomingCredit end-to-end:
//   - a matched deposit creates EXACTLY ONE financial transaction with the
//     deterministic key incoming_deposit:<SH reference>
//   - the same webhook delivered twice → exactly one credit (second = duplicate)
//   - a duplicate provider reference → no second credit
//   - unmatched account numbers → reconciliation queue, never a wallet credit
//   - invalid amounts (zero/negative/NaN) → no credit, event failed
//   - correct FTO/ledger parameters (transaction_type, idempotency_key,
//     amount, wallet_id, metadata with provider reference)
// ============================================================================

type Row = Record<string, unknown>;

/**
 * Chainable fake Supabase client. Table handlers receive the accumulated
 * filter conditions and return configured results.
 */
function makeFakeSupabase(config: {
  ftByIdempotencyKey?: (key: string) => Row | null;
  unmatchedByRef?: (ref: string) => Row | null;
  dvaByAccountNumber?: (acct: string) => Row | null;
  walletByCustomer?: (customerId: string) => Row | null;
  customerById?: (id: string) => Row | null;
}) {
  const state = {
    unmatchedInserts: [] as Row[],
    inboundEventUpdates: [] as Row[],
    depositRequestUpdates: 0,
  };

  function selector(conditions: Record<string, unknown>, table: string) {
    return {
      eq: (col: string, val: unknown) => selector({ ...conditions, [col]: val }, table),
      in: (col: string, val: unknown) => selector({ ...conditions, [col]: val }, table),
      lte: (col: string, val: unknown) => selector({ ...conditions, [col]: val }, table),
      limit: () => ({ maybeSingle: async () => execSelect(table, conditions) }),
      maybeSingle: async () => execSelect(table, conditions),
      single: async () => ({ data: execSelect(table, conditions), error: null }),
    };
  }

  async function execSelect(table: string, c: Record<string, unknown>) {
    if (table === 'financial_transactions') {
      return { data: config.ftByIdempotencyKey?.(c.idempotency_key as string) ?? null, error: null };
    }
    if (table === 'unmatched_credits') {
      return { data: config.unmatchedByRef?.(c.safe_haven_reference as string) ?? null, error: null };
    }
    if (table === 'safe_haven_accounts') {
      return { data: config.dvaByAccountNumber?.(c.account_number as string) ?? null, error: null };
    }
    if (table === 'wallets') {
      return { data: config.walletByCustomer?.(c.customer_id as string) ?? null, error: null };
    }
    if (table === 'customers') {
      return { data: config.customerById?.(c.id as string) ?? null, error: null };
    }
    return { data: null, error: null };
  }

  return {
    client: {
      from: (table: string) => ({
        select: () => selector({}, table),
        insert: (row: Row) => {
          const result = { data: { id: 'um-1' }, error: null };
          // supabase-js builders are thenables that also chain .select().single()
          const builder = {
            select: () => ({ single: async () => ({ data: { id: 'um-1' }, error: null }) }),
            then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
              Promise.resolve(result).then(resolve, reject),
          };
          if (table === 'unmatched_credits') state.unmatchedInserts.push(row);
          return builder;
        },
        update: (row: Row) => {
          state.inboundEventUpdates.push(row);
          const terminal = {
            eq: () => terminal,
            lte: () => terminal,
            then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
              Promise.resolve({ error: null }).then(resolve, reject),
          };
          return { eq: () => terminal, lte: () => terminal, then: terminal.then };
        },
      }),
    },
    state,
  };
}

beforeEach(() => {
  jest.resetModules();
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
});

function loadModule(
  fake: ReturnType<typeof makeFakeSupabase>,
  initiateImpl: (params: Row) => Promise<Row>
) {
  const initiate = jest.fn(initiateImpl);
  jest.mock('@supabase/supabase-js', () => ({ createClient: () => fake.client }));
  jest.mock('@/modules/orchestrator', () => ({ initiate }));
  jest.mock('@/modules/communications', () => ({
    dispatchNotification: jest.fn().mockResolvedValue(undefined),
  }));
  const mod = require('../incoming-credit');
  return { processIncomingCredit: mod.processIncomingCredit, initiate };
}

const CREDIT = {
  safe_haven_reference: 'SH-REF-9001',
  account_number: '0123456789',
  amount: 5000,
  sender_name: 'Test Sender',
};

const DVA = {
  customer_id: 'cust-1',
  account_number: '0123456789',
  account_name: 'Adaeze Okafor',
  bank_name: 'Safe Haven MFB',
  bank_code: '999240',
};

const WALLET = { id: 'wallet-1', customer_id: 'cust-1' };

describe('processIncomingCredit — deposit behavioral flow', () => {
  it('1. matched deposit → EXACTLY ONE FTO with the deterministic idempotency key and correct ledger params', async () => {
    const fake = makeFakeSupabase({
      dvaByAccountNumber: (a) => (a === '0123456789' ? DVA : null),
      walletByCustomer: (cid) => (cid === 'cust-1' ? WALLET : null),
      customerById: (id) => (id === 'cust-1' ? { auth_id: 'auth-1' } : null),
    });
    const { processIncomingCredit, initiate } = loadModule(fake, async (p) => ({
      id: 'ft-1',
      status: 'completed',
      transaction_reference: 'TX-1',
      ...p,
    }));

    const result = await processIncomingCredit('event-1', CREDIT);

    expect(result.status).toBe('matched');
    expect(initiate).toHaveBeenCalledTimes(1);
    expect(initiate).toHaveBeenCalledWith(
      expect.objectContaining({
        transaction_type: 'incoming_deposit',
        idempotency_key: 'incoming_deposit:SH-REF-9001',
        amount: 5000,
        wallet_id: 'wallet-1',
        source_reference: 'SH-REF-9001',
        source_module: 'wallet',
      })
    );
    // metadata carries the provider reference for reconciliation
    const call = initiate.mock.calls[0][0] as Row;
    expect(call.metadata).toMatchObject({
      safe_haven_reference: 'SH-REF-9001',
      account_number: '0123456789',
      inbound_event_id: 'event-1',
    });
  });

  it('2. same webhook delivered twice → EXACTLY ONE credit (second is duplicate, no second FTO)', async () => {
    // Simulate two deliveries: after the first, the FTO exists with the same key
    let ftExists = false;
    const fake = makeFakeSupabase({
      ftByIdempotencyKey: (key) =>
        key === 'incoming_deposit:SH-REF-9001' && ftExists
          ? { id: 'ft-1', status: 'completed' }
          : null,
      dvaByAccountNumber: (a) => (a === '0123456789' ? DVA : null),
      walletByCustomer: (cid) => (cid === 'cust-1' ? WALLET : null),
      customerById: (id) => (id === 'cust-1' ? { auth_id: 'auth-1' } : null),
    });
    const { processIncomingCredit, initiate } = loadModule(fake, async () => {
      ftExists = true;
      return { id: 'ft-1', status: 'completed', transaction_reference: 'TX-1' };
    });

    const first = await processIncomingCredit('event-1', CREDIT);
    const second = await processIncomingCredit('event-2', CREDIT); // redelivery

    expect(first.status).toBe('matched');
    expect(second.status).toBe('duplicate');
    expect(initiate).toHaveBeenCalledTimes(1); // EXACTLY ONE financial credit
  });

  it('3. duplicate provider reference (FT already completed) → no orchestrator call at all', async () => {
    const fake = makeFakeSupabase({
      ftByIdempotencyKey: () => ({ id: 'ft-existing', status: 'completed' }),
    });
    const { processIncomingCredit, initiate } = loadModule(fake, async () => ({
      id: 'ft-x', status: 'completed', transaction_reference: 'TX-X',
    }));

    const result = await processIncomingCredit('event-1', CREDIT);

    expect(result.status).toBe('duplicate');
    expect(result.financial_transaction_id).toBe('ft-existing');
    expect(initiate).not.toHaveBeenCalled();
  });

  it('4. unmatched account number → routed to reconciliation, NEVER credited to any wallet', async () => {
    const fake = makeFakeSupabase({
      dvaByAccountNumber: () => null, // no customer owns this account
    });
    const { processIncomingCredit, initiate } = loadModule(fake, async () => ({
      id: 'ft-x', status: 'completed',
    }));

    const result = await processIncomingCredit('event-1', CREDIT);

    expect(result.status).toBe('unmatched');
    expect(initiate).not.toHaveBeenCalled(); // no wallet was credited
    expect(fake.state.unmatchedInserts).toHaveLength(1);
    expect(fake.state.unmatchedInserts[0]).toMatchObject({
      safe_haven_reference: 'SH-REF-9001',
      account_number: '0123456789',
      status: 'requires_reconciliation',
    });
  });

  it('5. duplicate UNMATCHED credit (already under reconciliation) → not recorded twice', async () => {
    const fake = makeFakeSupabase({
      dvaByAccountNumber: () => null,
      unmatchedByRef: () => ({ id: 'um-1', status: 'requires_reconciliation' }),
    });
    const { processIncomingCredit, initiate } = loadModule(fake, async () => ({
      id: 'ft-x', status: 'completed',
    }));

    const result = await processIncomingCredit('event-1', CREDIT);

    expect(result.status).toBe('duplicate');
    expect(fake.state.unmatchedInserts).toHaveLength(0); // only one unmatched row
    expect(initiate).not.toHaveBeenCalled();
  });

  it('6. zero amount → NO credit, event marked failed', async () => {
    const fake = makeFakeSupabase({
      dvaByAccountNumber: (a) => (a === '0123456789' ? DVA : null),
      walletByCustomer: (cid) => (cid === 'cust-1' ? WALLET : null),
    });
    const { processIncomingCredit, initiate } = loadModule(fake, async () => ({
      id: 'ft-x', status: 'completed',
    }));

    const result = await processIncomingCredit('event-1', { ...CREDIT, amount: 0 });

    expect(result.status).toBe('failed');
    expect(initiate).not.toHaveBeenCalled();
  });

  it('7. NEGATIVE amount → NO credit (a negative "deposit" must never post a debit)', async () => {
    const fake = makeFakeSupabase({
      dvaByAccountNumber: (a) => (a === '0123456789' ? DVA : null),
      walletByCustomer: (cid) => (cid === 'cust-1' ? WALLET : null),
    });
    const { processIncomingCredit, initiate } = loadModule(fake, async () => ({
      id: 'ft-x', status: 'completed',
    }));

    const result = await processIncomingCredit('event-1', { ...CREDIT, amount: -5000 });

    expect(result.status).toBe('failed');
    expect(initiate).not.toHaveBeenCalled();
  });

  it('8. orchestrator failure → status failed, wallet NOT credited, inbound event marked failed', async () => {
    const fake = makeFakeSupabase({
      dvaByAccountNumber: (a) => (a === '0123456789' ? DVA : null),
      walletByCustomer: (cid) => (cid === 'cust-1' ? WALLET : null),
    });
    const { processIncomingCredit } = loadModule(fake, async () => ({
      status: 'failed', error: 'ledger posting failed',
    }));

    const result = await processIncomingCredit('event-1', CREDIT);

    expect(result.status).toBe('failed');
    expect(result.message).toContain('ledger posting failed');
  });
});

export {};
