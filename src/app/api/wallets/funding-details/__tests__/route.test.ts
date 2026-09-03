// ============================================================================
// funding-details route tests (Gate 4 funding fix)
//
// The wallet dashboard's DVA display comes from this endpoint. Verifies:
//   - unauthenticated callers get nothing
//   - the DVA is looked up ONLY under the authenticated user's own customer
//     record (User A can never receive User B's DVA)
//   - a user with no verified KYC gets an accurate empty state and NO account
//   - a verified user with an ACTIVE DVA gets exactly the database record
// ============================================================================

type Row = Record<string, unknown>;

function setupDeps(config: {
  authUser: { id: string } | null;
  customerByAuthId: Row | null;
  kycTier: string;
  dvaRow: Row | null;
  walletRow: Row | null;
}) {
  const eqLog: Array<{ table: string; conditions: Row }> = [];
  const serviceLog: Array<{ table: string; conditions: Row }> = [];

  const userClient = {
    auth: { getUser: async () => ({ data: { user: config.authUser }, error: null }) },
    from: (table: string) => ({
      select: () => ({
        eq: (col: string, val: unknown) => {
          eqLog.push({ table, conditions: { [col]: val } });
          return {
            maybeSingle: async () => {
              if (table === 'customers' && col === 'auth_id') {
                return { data: config.customerByAuthId, error: null };
              }
              if (table === 'profiles') return { data: { kyc_tier: config.kycTier }, error: null };
              return { data: null, error: null };
            },
          };
        },
      }),
    }),
  };

  const serviceClient = {
    from: (table: string) => ({
      select: () => ({
        eq: (col: string, val: unknown) => ({
          eq: (col2: string, val2: unknown) => {
            serviceLog.push({ table, conditions: { [col]: val, [col2]: val2 } });
            const result = async () => {
              if (table === 'safe_haven_accounts') return { data: config.dvaRow, error: null };
              if (table === 'wallets') return { data: config.walletRow, error: null };
              return { data: null, error: null };
            };
            return {
              maybeSingle: result,
              limit: () => ({ maybeSingle: result }),
            };
          },
        }),
      }),
      insert: () => ({ then: (r: (v: unknown) => unknown) => Promise.resolve({ error: null }).then(r) }),
    }),
  };

  const ensureCustomerDva = jest.fn();

  jest.mock('@/lib/supabase/server', () => ({ createClient: () => userClient }));
  jest.mock('@/lib/supabase/service', () => ({ createServiceClient: () => serviceClient }));
  jest.mock('@/modules/wallet/dva', () => ({ ensureCustomerDva }));

  return { ensureCustomerDva, eqLog, serviceLog };
}

function makeRequest() {
  return {
    headers: { get: () => '127.0.0.1' },
    nextUrl: new URL('https://agriqcap.vercel.app/api/wallets/funding-details'),
  } as never;
}

beforeEach(() => {
  jest.resetModules();
  process.env.SAFE_HAVEN_ENV = 'production';
  process.env.SAFE_HAVEN_API_KEY = 'live-key';
  process.env.SAFE_HAVEN_SECRET_KEY = 'live-secret';
});

const loadRoute = () => {
  const route = require('../route');
  return route.GET as (req: never) => Promise<Response>;
};

describe('GET /api/wallets/funding-details', () => {
  it('1. unauthenticated → 401, no account data of any user', async () => {
    setupDeps({ authUser: null, customerByAuthId: null, kycTier: 'tier_0', dvaRow: null, walletRow: null });
    const GET = loadRoute();
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('2. the DVA query is scoped to the AUTHENTICATED user\'s own customer record (User A never sees User B)', async () => {
    const deps = setupDeps({
      authUser: { id: 'auth-A' },
      customerByAuthId: { id: 'cust-A', status: 'active', full_name: 'User A', email: 'a@x.com', phone: '080', bvn: null },
      kycTier: 'tier_1',
      dvaRow: { account_number: '1111111111', account_name: 'User A DVA', bank_name: 'Safe Haven MFB', bank_code: '999240', status: 'active' },
      walletRow: { id: 'wallet-A', status: 'active' },
    });
    const GET = loadRoute();
    const res = await GET(makeRequest());
    const body = await res.json();

    // customer resolution is keyed on the authenticated auth_id
    const customerQuery = deps.eqLog.find((q) => q.table === 'customers');
    expect(customerQuery?.conditions.auth_id).toBe('auth-A');

    // the DVA is read ONLY under User A's customer id
    const dvaQuery = deps.serviceLog.find((q) => q.table === 'safe_haven_accounts');
    expect(dvaQuery?.conditions.customer_id).toBe('cust-A');

    expect(body.provisioned).toBe(true);
    expect(body.account.account_number).toBe('1111111111'); // the real DB record
  });

  it('3. unverified user (tier_0) → accurate empty state, NO provisioning, NO account data', async () => {
    const { ensureCustomerDva } = setupDeps({
      authUser: { id: 'auth-B' },
      customerByAuthId: { id: 'cust-B', status: 'active', full_name: 'User B', email: 'b@x.com', phone: '080', bvn: null },
      kycTier: 'tier_0',
      dvaRow: null,
      walletRow: null,
    });
    const GET = loadRoute();
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.provisioned).toBe(false);
    expect(body.account).toBeUndefined();
    expect(body.message).toContain('identity verification');
    expect(ensureCustomerDva).not.toHaveBeenCalled();
  });

  it('4. verified user with NO active DVA → idempotent provisioning attempted, result comes from the DB', async () => {
    const { ensureCustomerDva } = setupDeps({
      authUser: { id: 'auth-C' },
      customerByAuthId: { id: 'cust-C', status: 'active', full_name: 'User C', email: 'c@x.com', phone: '080', bvn: null },
      kycTier: 'tier_1',
      dvaRow: null, // first read: none
      walletRow: { id: 'wallet-C', status: 'active' },
    });
    ensureCustomerDva && (ensureCustomerDva as jest.Mock).mockResolvedValue({ status: 'provisioned' });
    const GET = loadRoute();
    const res = await GET(makeRequest());

    expect(ensureCustomerDva).toHaveBeenCalledTimes(1);
    expect(ensureCustomerDva).toHaveBeenCalledWith(expect.objectContaining({ id: 'cust-C' }));
    // provisioned:false + no account because the second DVA read returned null
    const body = await res.json();
    expect(body.provisioned).toBe(false);
    expect(body.account).toBeUndefined(); // NEVER fabricated details
  });
});

export {};
