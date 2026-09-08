// ============================================================================
// Admin identity management route tests (Phase B)
//
// PATCH /api/admin/customers/[customerId]/identity
//   action=reset  — revoke verification, clear BVN/NIN, drop tier to tier_0.
//   action=update — staff-corrected BVN/NIN number (masked everywhere).
//
// Critical invariants:
//   - staff-only: non-staff callers get 403
//   - reset NEVER runs against a live account: active DVA or non-zero wallet
//     balance → refused 409
//   - reset revokes verification rows (audit trail) — it never deletes them
//   - update validates the 11-digit number and never touches tier/status
//   - every action is audit-logged with masked values
// ============================================================================

type Row = Record<string, unknown>;

const CUSTOMER_ID = 'cust-123';
const authUser = { id: 'auth-9a27' };
const customerRow: Row = {
  id: CUSTOMER_ID,
  auth_id: 'auth-9a27',
  full_name: 'Test Customer',
  email: 'test@agriqcap.com',
  status: 'active',
  bvn: '22229764600',
  nin: null,
  identity_verification_id: 'sh-identity-1',
  identity_verification_status: 'verified',
  identity_type: 'BVN',
  identity_verified_at: '2026-09-08T10:00:00Z',
};

function setupDeps(config: {
  staff: Row | null;
  dvaRow: Row | null;
  walletRows: Row[];
  tierBefore: string;
}) {
  const calls: Array<{ table: string; op: string; conditions: Row; payload?: Row }> = [];

  const mkChain = (table: string) => {
    const state: { op: string; conditions: Row; payload?: Row } = { op: 'select', conditions: {} };
    const c: Record<string, unknown> = {
      select: () => c,
      eq: (col: string, v: unknown) => { state.conditions[col] = v; return c; },
      neq: (col: string, v: unknown) => { state.conditions[col] = v; return c; },
      limit: () => c,
      update: (p: Row) => {
        state.op = 'update'; state.payload = p;
        calls.push({ table, op: 'update', conditions: { ...state.conditions }, payload: p });
        return c;
      },
      maybeSingle: async () => resolve(table, state),
      then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
        Promise.resolve(resolve(table, state)).then(res, rej),
    };
    return c;
  };

  const resolve = (table: string, state: { op: string; conditions: Row }): { data: unknown; error: unknown } => {
    if (table === 'staff_users') return { data: config.staff, error: null };
    if (table === 'customers' && state.op === 'select') return { data: customerRow, error: null };
    if (table === 'safe_haven_accounts') return { data: config.dvaRow, error: null };
    if (table === 'wallets') return { data: config.walletRows, error: null };
    if (table === 'profiles') return { data: { kyc_tier: config.tierBefore }, error: null };
    return { data: null, error: null };
  };

  const userClient = {
    auth: { getUser: async () => ({ data: { user: authUser }, error: null }) },
    from: (table: string) => mkChain(table),
  };
  const serviceClient = {
    from: (table: string) => mkChain(table),
    rpc: async () => ({ data: 'enc-xyz', error: null }),
  };

  const logAdminAction = jest.fn();

  jest.mock('@/lib/supabase/server', () => ({ createClient: () => userClient }));
  jest.mock('@/lib/supabase/service', () => ({ createServiceClient: () => serviceClient }));
  jest.mock('@/modules/administration', () => ({ logAdminAction }));
  jest.mock('@/lib/config/pii-key', () => ({ PII_ENCRYPTION_KEY: 'test-pii-key' }));

  return { calls, logAdminAction };
}

const makeRequest = (body: Row) =>
  ({
    headers: { get: () => '127.0.0.1' },
    nextUrl: new URL(`https://agriqcap.vercel.app/api/admin/customers/${CUSTOMER_ID}/identity`),
    json: async () => body,
  }) as never;

beforeEach(() => {
  jest.resetModules();
  process.env.SAFE_HAVEN_ENV = 'production';
});

const loadRoute = () => {
  const route = require('../route');
  return route.PATCH as (
    req: never,
    ctx: { params: { customerId: string } }
  ) => Promise<Response>;
};

const ctx = { params: { customerId: CUSTOMER_ID } };

const baseSetup = (overrides: Partial<Parameters<typeof setupDeps>[0]> = {}) =>
  setupDeps({
    staff: { id: 'staff-1', role: 'super_admin' },
    dvaRow: null,
    walletRows: [],
    tierBefore: 'tier_1',
    ...overrides,
  });

describe('PATCH /api/admin/customers/[customerId]/identity', () => {
  it('1. non-staff caller → 403, nothing touched', async () => {
    const { calls } = setupDeps({ staff: null, dvaRow: null, walletRows: [], tierBefore: 'tier_1' });
    const PATCH = loadRoute();
    const res = await PATCH(makeRequest({ action: 'reset', reason: 'needs reset' }), ctx);
    expect(res.status).toBe(403);
    expect(calls.filter((c) => c.op === 'update')).toHaveLength(0);
  });

  it('2. reset refused (409) when the customer has an ACTIVE DVA', async () => {
    const { calls } = baseSetup({ dvaRow: { id: 'dva-1', account_number: '0123456789' } });
    const PATCH = loadRoute();
    const res = await PATCH(makeRequest({ action: 'reset', reason: 'needs reset' }), ctx);
    expect(res.status).toBe(409);
    expect(calls.filter((c) => c.op === 'update')).toHaveLength(0);
  });

  it('3. reset refused (409) when the wallet has a non-zero balance', async () => {
    const { calls } = baseSetup({ walletRows: [{ id: 'w-1', cached_balance: 5000 }] });
    const PATCH = loadRoute();
    const res = await PATCH(makeRequest({ action: 'reset', reason: 'needs reset' }), ctx);
    expect(res.status).toBe(409);
    expect(calls.filter((c) => c.op === 'update')).toHaveLength(0);
  });

  it('4. reset happy path: verification rows REVOKED, BVN cleared, tier dropped, audited', async () => {
    const { calls, logAdminAction } = baseSetup();
    const PATCH = loadRoute();
    const res = await PATCH(makeRequest({ action: 'reset', reason: 'otp spent, no DVA' }), ctx);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);

    const byTable = (t: string) => calls.find((c) => c.table === t && c.op === 'update');
    // verification rows revoked — never deleted
    expect(byTable('safe_haven_identity_verifications')?.payload).toMatchObject({ status: 'revoked' });
    // customer identity fields fully cleared
    expect(byTable('customers')?.payload).toMatchObject({
      bvn: null,
      nin: null,
      bvn_encrypted: null,
      nin_encrypted: null,
      identity_verification_id: null,
      identity_verification_status: null,
    });
    // tier dropped to tier_0
    expect(byTable('profiles')?.payload).toMatchObject({ kyc_tier: 'tier_0' });
    // audit-logged with masked BVN (never raw)
    expect(logAdminAction).toHaveBeenCalledTimes(1);
    const logged = logAdminAction.mock.calls[0][0] as Row;
    expect(logged.action).toBe('identity_reset');
    expect(JSON.stringify(logged.before_state)).not.toContain('22229764600');
    expect(JSON.stringify(logged.before_state)).toContain('*****4600');
  });

  it('5. update sets the corrected number (masked in response and audit log), never touches tier', async () => {
    const { calls, logAdminAction } = baseSetup();
    const PATCH = loadRoute();
    const res = await PATCH(
      makeRequest({ action: 'update', type: 'NIN', number: '93911293560', reason: 'typo correction' }),
      ctx
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.after_state.nin).toBe('*****3560');
    const custUpdate = calls.find((c) => c.table === 'customers' && c.op === 'update');
    expect(custUpdate?.payload).toMatchObject({ nin: '93911293560', nin_encrypted: 'enc-xyz' });
    // tier and verification status never touched by update
    expect(calls.find((c) => c.table === 'profiles')).toBeUndefined();
    expect(logAdminAction).toHaveBeenCalledTimes(1);
    const logged = logAdminAction.mock.calls[0][0] as Row;
    expect(JSON.stringify(logged)).not.toContain('93911293560');
  });

  it('6. update rejects a number that is not exactly 11 digits', async () => {
    const { calls } = baseSetup();
    const PATCH = loadRoute();
    const res = await PATCH(
      makeRequest({ action: 'update', type: 'BVN', number: '12345', reason: 'bad number' }),
      ctx
    );
    expect(res.status).toBe(400);
    expect(calls.filter((c) => c.op === 'update')).toHaveLength(0);
  });

  it('7. missing reason → 400, audited nowhere', async () => {
    const { calls, logAdminAction } = baseSetup();
    const PATCH = loadRoute();
    const res = await PATCH(makeRequest({ action: 'reset', reason: '' }), ctx);
    expect(res.status).toBe(400);
    expect(calls.filter((c) => c.op === 'update')).toHaveLength(0);
    expect(logAdminAction).not.toHaveBeenCalled();
  });
});
