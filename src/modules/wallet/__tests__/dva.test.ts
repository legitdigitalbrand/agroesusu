// ============================================================================
// DVA Provisioning — behavioral tests (Gate 4 funding fix)
//
// Verifies the shared idempotent provisioning path (ensureCustomerDva):
//   1. An existing ACTIVE DVA is returned from the DB — never duplicated.
//   2. Provisioning succeeds via the real provider and persists the record;
//      the returned record is the DATABASE record (authoritative read-back).
//   3. Concurrent/duplicate provisioning races resolve via UNIQUE(customer_id)
//      — the loser re-reads and returns the winner's row.
//   4. Provider failures fail safely — no fabricated data, nothing persisted.
//   5. A missing-credentials (fail-closed factory) situation surfaces a
//      non-retryable error — never a mock account.
//   6. Incomplete provider responses are rejected — nothing persisted.
// ============================================================================

type Row = Record<string, unknown>;

const CUSTOMER = {
  id: 'cust-123',
  full_name: 'Adaeze Okafor',
  email: 'adaeze@example.com',
  phone: '08031234567',
  bvn: '22212345678',
};

const NEW_SUBACCOUNT = {
  accountId: 'real-sh-account-1',
  accountNumber: '0987654321',
  accountName: 'ADA OKAFOR',
  bankName: 'Safe Haven MFB',
  bankCode: '999240',
};

/**
 * Fake supabase client for the service-role client used by dva.ts.
 * dvaQueryResults: an array consumed per safe_haven_accounts query —
 * each .maybeSingle() pops the next result (null = "no active DVA").
 */
function makeFake(opts: {
  dvaQueryResults: Array<Row | null>;
  insertError?: { code: string; message: string } | null;
}) {
  const state = {
    inserts: [] as Array<{ table: string; row: Row }>,
    walletUpdates: 0,
  };
  let dvaReadIdx = 0;

  const from = (table: string) => {
    if (table === 'safe_haven_accounts') {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => {
                const result = opts.dvaQueryResults[dvaReadIdx] ?? null;
                dvaReadIdx++;
                return { data: result, error: null };
              },
            }),
          }),
        }),
        insert: async (row: Row) => {
          state.inserts.push({ table, row });
          return { error: opts.insertError ?? null };
        },
      };
    }
    if (table === 'wallets') {
      return {
        update: () => ({
          eq: () => ({
            eq: async () => {
              state.walletUpdates++;
              return { error: null };
            },
          }),
        }),
      };
    }
    throw new Error(`unexpected table in test fake: ${table}`);
  };

  return { client: { from }, state };
}

function loadModule(fake: ReturnType<typeof makeFake>, provider?: object) {
  jest.mock('@supabase/supabase-js', () => ({ createClient: () => fake.client }));
  jest.mock('@/modules/integrations', () => ({
    getBankingProvider: () => {
      if (provider === undefined) {
        throw new Error(
          'Banking provider not configured: SAFEHAVEN_CLIENT_ID and SAFEHAVEN_PRIVATE_KEY are required.'
        );
      }
      return provider;
    },
  }));
  return require('../dva');
}

beforeEach(() => {
  jest.resetModules();
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
});

describe('ensureCustomerDva', () => {
  it('1. returns the EXISTING active DVA from the database without calling the provider', async () => {
    const fake = makeFake({
      dvaQueryResults: [{ account_number: '0123456789', account_name: 'Adaeze Okafor', bank_name: 'Safe Haven MFB', bank_code: '999240' }],
    });
    const provider = { createSubAccount: jest.fn() };
    const { ensureCustomerDva } = loadModule(fake, provider);

    const result = await ensureCustomerDva(CUSTOMER);

    expect(result.status).toBe('existing');
    if (result.status === 'existing') {
      expect(result.account.account_number).toBe('0123456789');
    }
    expect(provider.createSubAccount).not.toHaveBeenCalled();
    expect(fake.state.inserts).toHaveLength(0); // no duplicate row
  });

  it('2. provisions a NEW DVA via the real provider, persists it, and returns the authoritative DB record', async () => {
    const fake = makeFake({
      // read 1: no active DVA → provision; read 2 (read-back): the persisted row
      dvaQueryResults: [
        null,
        { account_number: '0987654321', account_name: 'ADA OKAFOR (DB)', bank_name: 'Safe Haven MFB', bank_code: '999240' },
      ],
    });
    const provider = { createSubAccount: jest.fn().mockResolvedValue(NEW_SUBACCOUNT) };
    const { ensureCustomerDva } = loadModule(fake, provider);

    const result = await ensureCustomerDva(CUSTOMER);

    expect(provider.createSubAccount).toHaveBeenCalledTimes(1);
    // deterministic per-customer identity verification reference (idempotent retries)
    expect(provider.createSubAccount).toHaveBeenCalledWith(
      expect.objectContaining({ identityVerificationId: 'customer-cust-123' })
    );
    expect(fake.state.inserts).toHaveLength(1);
    expect(fake.state.inserts[0].row).toMatchObject({
      customer_id: 'cust-123',
      safe_haven_account_id: 'real-sh-account-1',
      account_number: '0987654321',
      status: 'active',
    });
    expect(fake.state.walletUpdates).toBe(1); // copied to the primary wallet
    expect(result.status).toBe('provisioned');
    if (result.status === 'provisioned') {
      // authoritative DB record — not the raw provider response
      expect(result.account.account_number).toBe('0987654321');
      expect(result.account.account_name).toBe('ADA OKAFOR (DB)');
    }
  });

  it('3. resolves provisioning races: UNIQUE(customer_id) violation → re-read and return the winner\'s record', async () => {
    const fake = makeFake({
      // read 1: no active DVA → provision; insert: 23505 (concurrent request won);
      // read 2: the winner's row
      dvaQueryResults: [
        null,
        { account_number: '5554443333', account_name: 'Concurrent Winner', bank_name: 'Safe Haven MFB', bank_code: '999240' },
      ],
      insertError: { code: '23505', message: 'duplicate key value violates unique constraint' },
    });
    const provider = { createSubAccount: jest.fn().mockResolvedValue(NEW_SUBACCOUNT) };
    const { ensureCustomerDva } = loadModule(fake, provider);

    const result = await ensureCustomerDva(CUSTOMER);

    expect(result.status).toBe('existing'); // ONE DVA — the winner's, never a duplicate
    if (result.status === 'existing') {
      expect(result.account.account_number).toBe('5554443333');
      expect(result.account.account_name).toBe('Concurrent Winner');
    }
  });

  it('4. provider failure → safe retryable error, NOTHING persisted, no fabricated data', async () => {
    const fake = makeFake({ dvaQueryResults: [null] });
    const provider = {
      createSubAccount: jest.fn().mockRejectedValue(new Error('Safe Haven 503 unavailable')),
    };
    const { ensureCustomerDva } = loadModule(fake, provider);

    const result = await ensureCustomerDva(CUSTOMER);

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.retryable).toBe(true);
      expect(result.message).toContain('Safe Haven 503 unavailable');
    }
    expect(fake.state.inserts).toHaveLength(0);
  });

  it('5. fail-closed factory (missing credentials) → non-retryable error, NEVER a mock account', async () => {
    const fake = makeFake({ dvaQueryResults: [null] });
    const { ensureCustomerDva } = loadModule(fake, undefined); // provider factory throws

    const result = await ensureCustomerDva(CUSTOMER);

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.retryable).toBe(false);
      expect(result.message).toMatch(/SAFEHAVEN_CLIENT_ID and SAFEHAVEN_PRIVATE_KEY are required/);
    }
    expect(fake.state.inserts).toHaveLength(0); // no fabricated DVA persisted
  });

  it('6. incomplete provider response (no account number) → rejected, nothing persisted', async () => {
    const fake = makeFake({ dvaQueryResults: [null] });
    const provider = {
      createSubAccount: jest.fn().mockResolvedValue({ accountId: 'x', accountNumber: '', accountName: 'Y', bankName: 'Z', bankCode: '9' }),
    };
    const { ensureCustomerDva } = loadModule(fake, provider);

    const result = await ensureCustomerDva(CUSTOMER);

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.message).toContain('incomplete');
    }
    expect(fake.state.inserts).toHaveLength(0);
  });
});

export {};
