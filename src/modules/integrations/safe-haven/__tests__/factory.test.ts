// ============================================================================
// Factory fail-closed tests (Gate 4 funding fix)
//
// The mock provider must NEVER be selected silently when credentials are
// missing — that is exactly how fabricated "virtual accounts" previously
// got persisted as real records and displayed to customers.
// ============================================================================

describe('getBankingProvider — fail-closed factory', () => {
  beforeEach(() => {
    jest.resetModules();
    delete process.env.SAFEHAVEN_CLIENT_ID;
    delete process.env.SAFEHAVEN_PRIVATE_KEY;
    delete process.env.SAFE_HAVEN_ENV;
    delete process.env.NODE_ENV_TEST_FLAG;
  });

  afterEach(() => {
    Object.assign(process.env, { NODE_ENV: 'test' }); // restore for the rest of the suite
  });

  it('THROWS when credentials are missing and mock is not explicitly enabled', () => {
    Object.assign(process.env, { NODE_ENV: 'production' });
    process.env.SAFE_HAVEN_ENV = 'production';
    const { getBankingProvider } = require('../factory');
    expect(() => getBankingProvider()).toThrow(
      /SAFEHAVEN_CLIENT_ID and SAFEHAVEN_PRIVATE_KEY are required/
    );
  });

  it('never returns the mock provider implicitly (no credentials, no opt-in)', () => {
    Object.assign(process.env, { NODE_ENV: 'production' });
    delete process.env.SAFE_HAVEN_ENV;
    const { getBankingProvider } = require('../factory');
    expect(() => getBankingProvider()).toThrow();
  });

  it('returns the MOCK provider only with explicit SAFE_HAVEN_ENV=mock opt-in', () => {
    Object.assign(process.env, { NODE_ENV: 'production' });
    process.env.SAFE_HAVEN_ENV = 'mock';
    const { getBankingProvider } = require('../factory');
    const { MockBankingProvider } = require('../mock');
    expect(getBankingProvider()).toBeInstanceOf(MockBankingProvider);
  });

  it('returns the MOCK provider under NODE_ENV=test', () => {
    Object.assign(process.env, { NODE_ENV: 'test' });
    const { getBankingProvider } = require('../factory');
    const { MockBankingProvider } = require('../mock');
    expect(getBankingProvider()).toBeInstanceOf(MockBankingProvider);
  });

  it('returns the REAL adapter when credentials are configured', () => {
    Object.assign(process.env, { NODE_ENV: 'production' });
    process.env.SAFEHAVEN_CLIENT_ID = 'live-client-id';
    process.env.SAFEHAVEN_PRIVATE_KEY = 'live-private-key';
    const { getBankingProvider } = require('../factory');
    const { SafeHavenAdapter } = require('../adapter');
    expect(getBankingProvider()).toBeInstanceOf(SafeHavenAdapter);
  });
});

export {};
