// ============================================================================
// Safe Haven Auth Service — Unit Tests
// ============================================================================

import { SafeHavenAuthService, SafeHavenAuthError, _resetSafeHavenAuthService } from '../auth';
import crypto from 'crypto';

// ── Test helpers ──

function generateTestKeyPair() {
  const { privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 1024,
  });
  return privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
}

function mockFetchResponse(body: unknown, status: number = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

function createTestConfig(overrides: Partial<{ clientId: string; privateKey: string; apiUrl: string; requestTimeoutMs: number; tokenExpirySeconds: number; refreshBufferMs: number }> = {}) {
  const privateKeyPem = generateTestKeyPair();
  return {
    clientId: overrides.clientId !== undefined ? overrides.clientId : 'test-client-id',
    privateKey: overrides.privateKey !== undefined ? overrides.privateKey : privateKeyPem,
    apiUrl: overrides.apiUrl !== undefined ? overrides.apiUrl : 'https://api.sandbox.safehavenmfb.com',
    tokenExpirySeconds: overrides.tokenExpirySeconds ?? 60,
    refreshBufferMs: overrides.refreshBufferMs ?? 5000,
    requestTimeoutMs: overrides.requestTimeoutMs ?? 5000,
  };
}

// ── Tests ──

describe('SafeHavenAuthService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    _resetSafeHavenAuthService();
  });

  // 1. Valid credentials → token obtained
  it('should obtain an access token with valid credentials', async () => {
    const config = createTestConfig();
    const mockToken = 'mock-access-token-xyz';
    let fetchCalled = 0;

    global.fetch = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      fetchCalled++;
      const body = init?.body as string;
      expect(body).toContain('grant_type=client_credentials');
      expect(body).toContain('client_id=test-client-id');
      expect(body).toContain('client_assertion_type=urn%3Aietf%3Aparams%3Aoauth%3Aclient-assertion-type%3Ajwt-bearer');
      expect(body).toContain('client_assertion=');

      return mockFetchResponse({
        access_token: mockToken,
        token_type: 'Bearer',
        expires_in: 3600,
        ibs_client_id: 'ibs-123',
      });
    }) as typeof fetch;

    const service = new SafeHavenAuthService(config);
    const token = await service.getAccessToken();

    expect(token).toBe(mockToken);
    expect(fetchCalled).toBe(1);
    expect(service.getIbsClientId()).toBe('ibs-123');
  });

  // 2. Invalid client ID → invalid_client error
  it('should throw invalid_client error for wrong client ID', async () => {
    const config = createTestConfig();

    global.fetch = (async () => {
      return mockFetchResponse(
        { error: 'invalid_client', error_description: 'Client not found' },
        401,
      );
    }) as typeof fetch;

    const service = new SafeHavenAuthService(config);

    try {
      await service.getAccessToken();
      throw new Error('Should have thrown SafeHavenAuthError');
    } catch (err) {
      expect(err).toBeInstanceOf(SafeHavenAuthError);
      expect((err as SafeHavenAuthError).code).toBe('invalid_client');
    }
  });

  // 3. Invalid private key → signing_error
  it('should throw signing_error for invalid private key', async () => {
    const config = createTestConfig({ privateKey: 'not-a-valid-key' });

    global.fetch = (async () => mockFetchResponse({})) as typeof fetch;

    const service = new SafeHavenAuthService(config);

    try {
      await service.getAccessToken();
      throw new Error('Should have thrown');
    } catch (err) {
      expect((err as SafeHavenAuthError).code).toBe('signing_error');
    }
  });

  // 4. Expired assertion → invalid_grant error
  it('should throw invalid_grant for expired assertion', async () => {
    const config = createTestConfig();

    global.fetch = (async () => {
      return mockFetchResponse(
        { error: 'invalid_grant', error_description: 'Assertion expired' },
        400,
      );
    }) as typeof fetch;

    const service = new SafeHavenAuthService(config);

    try {
      await service.getAccessToken();
      throw new Error('Should have thrown');
    } catch (err) {
      expect((err as SafeHavenAuthError).code).toBe('invalid_grant');
    }
  });

  // 5. Safe Haven timeout → timeout error
  it('should throw timeout error when Safe Haven does not respond', async () => {
    const config = createTestConfig({ requestTimeoutMs: 100 });

    global.fetch = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      const signal = init?.signal as AbortSignal;
      return new Promise<Response>((_resolve, reject) => {
        if (signal) {
          signal.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }
      });
    }) as typeof fetch;

    const service = new SafeHavenAuthService(config);

    try {
      await service.getAccessToken();
      throw new Error('Should have thrown');
    } catch (err) {
      expect((err as SafeHavenAuthError).code).toBe('timeout');
    }
  });

  // 6. Token caching → no duplicate requests
  it('should cache token and not make duplicate requests', async () => {
    const config = createTestConfig();
    let fetchCalled = 0;

    global.fetch = (async () => {
      fetchCalled++;
      return mockFetchResponse({
        access_token: 'cached-token',
        token_type: 'Bearer',
        expires_in: 3600,
      });
    }) as typeof fetch;

    const service = new SafeHavenAuthService(config);

    await service.getAccessToken();
    expect(fetchCalled).toBe(1);

    await service.getAccessToken();
    expect(fetchCalled).toBe(1);

    await service.getAccessToken();
    expect(fetchCalled).toBe(1);
  });

  // 7. Token refresh → new token after expiry
  it('should refresh token after cache expires', async () => {
    const config = createTestConfig({ tokenExpirySeconds: 1, refreshBufferMs: 0 });

    let fetchCalled = 0;
    let tokenValue = 'token-v1';

    global.fetch = (async () => {
      fetchCalled++;
      return mockFetchResponse({
        access_token: tokenValue,
        token_type: 'Bearer',
        expires_in: 1,
      });
    }) as typeof fetch;

    const service = new SafeHavenAuthService(config);

    const t1 = await service.getAccessToken();
    expect(t1).toBe('token-v1');
    expect(fetchCalled).toBe(1);

    await new Promise((r) => setTimeout(r, 1100));

    tokenValue = 'token-v2';
    const t2 = await service.getAccessToken();
    expect(t2).toBe('token-v2');
    expect(fetchCalled).toBe(2);
  });

  // 8. Secret redaction → no secrets in error messages
  it('should never expose secrets in error messages', async () => {
    const config = createTestConfig();
    const secretValue = config.privateKey;

    global.fetch = (async () => {
      return mockFetchResponse(
        { error: 'invalid_client', error_description: `Key: ${secretValue}` },
        401,
      );
    }) as typeof fetch;

    const service = new SafeHavenAuthService(config);

    try {
      await service.getAccessToken();
      throw new Error('Should have thrown');
    } catch (err) {
      const error = err as SafeHavenAuthError;
      expect(error.message).not.toContain(secretValue);
      expect(error.message).not.toContain('BEGIN PRIVATE KEY');
      expect(error.message).not.toContain('client_assertion');
    }
  });

  // 9. Missing configuration → missing_config error
  it('should throw missing_config when env vars are absent', async () => {
    const config = createTestConfig({ clientId: '', privateKey: '' });
    const service = new SafeHavenAuthService(config);

    try {
      await service.getAccessToken();
      throw new Error('Should have thrown');
    } catch (err) {
      expect((err as SafeHavenAuthError).code).toBe('missing_config');
    }
  });

  // 10. Malformed response → malformed_response error
  it('should throw malformed_response for non-JSON response', async () => {
    const config = createTestConfig();

    global.fetch = (async () => {
      return {
        ok: true,
        status: 200,
        json: async () => { throw new Error('Not JSON'); },
        text: async () => 'Not JSON',
      } as unknown as Response;
    }) as typeof fetch;

    const service = new SafeHavenAuthService(config);

    try {
      await service.getAccessToken();
      throw new Error('Should have thrown');
    } catch (err) {
      expect((err as SafeHavenAuthError).code).toBe('malformed_response');
    }
  });

  // 11. Health check returns safe status
  it('health check should return safe status without token', async () => {
    const config = createTestConfig();

    global.fetch = (async () => {
      return mockFetchResponse({
        access_token: 'secret-token-value',
        token_type: 'Bearer',
        expires_in: 3600,
      });
    }) as typeof fetch;

    const service = new SafeHavenAuthService(config);
    const health = await service.healthCheck();

    expect(health.status).toBe('connected');
    expect(health.environment).toBe('sandbox');
    expect(JSON.stringify(health)).not.toContain('secret-token-value');
  });

  // 12. Single-flight: concurrent requests don't trigger multiple fetches
  it('should use single-flight for concurrent token requests', async () => {
    const config = createTestConfig();
    let fetchCalled = 0;

    global.fetch = (async () => {
      fetchCalled++;
      await new Promise((r) => setTimeout(r, 50));
      return mockFetchResponse({
        access_token: 'concurrent-token',
        token_type: 'Bearer',
        expires_in: 3600,
      });
    }) as typeof fetch;

    const service = new SafeHavenAuthService(config);

    const results = await Promise.all([
      service.getAccessToken(),
      service.getAccessToken(),
      service.getAccessToken(),
      service.getAccessToken(),
      service.getAccessToken(),
    ]);

    expect(fetchCalled).toBe(1);
    results.forEach((t) => expect(t).toBe('concurrent-token'));
  });
  });
