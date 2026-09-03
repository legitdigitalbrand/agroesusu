import { IBankingProvider } from '../types';
import { SafeHavenAdapter } from './adapter';
import { MockBankingProvider } from './mock';

export interface SafeHavenConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  webhookSecret: string;
  ibsClientId?: string;
}

/**
 * Factory: returns the appropriate banking provider based on environment.
 *
 * Uses the SAME env var names as auth.ts (SAFEHAVEN_* without underscore):
 * - SAFEHAVEN_CLIENT_ID — OAuth client ID
 * - SAFEHAVEN_PRIVATE_KEY — RSA private key for JWT signing
 * - SAFEHAVEN_API_URL — base API URL (production or sandbox)
 * - SAFEHAVEN_IBS_CLIENT_ID — IBS client ID (optional, also returned from auth)
 * - SAFE_HAVEN_WEBHOOK_SECRET — webhook verification secret
 *
 * Fail-closed (Gate 4 funding fix): the mock provider is NEVER selected
 * implicitly. Missing credentials previously caused a silent fallback to
 * MockBankingProvider, which fabricated "virtual accounts" that were
 * persisted as real records and displayed to customers as fundable banking
 * details. The mock provider is now allowed ONLY by explicit opt-in:
 *   - SAFE_HAVEN_ENV === 'mock' (deliberate local/test configuration), or
 *   - NODE_ENV === 'test' (automated test runs)
 * In any other configuration without credentials, this factory throws —
 * callers surface an accurate error state instead of fake financial data.
 */
export function getBankingProvider(): IBankingProvider {
  const clientId = process.env.SAFEHAVEN_CLIENT_ID;
  const privateKey = process.env.SAFEHAVEN_PRIVATE_KEY;
  const apiUrl = process.env.SAFEHAVEN_API_URL || 'https://api.sandbox.safehavenmfb.com';

  if (clientId && privateKey) {
    return new SafeHavenAdapter({
      baseUrl: apiUrl,
      clientId,
      clientSecret: privateKey,
      webhookSecret: process.env.SAFE_HAVEN_WEBHOOK_SECRET || '',
      ibsClientId: process.env.SAFEHAVEN_IBS_CLIENT_ID,
    });
  }

  const explicitMockOptIn =
    process.env.SAFE_HAVEN_ENV === 'mock' || process.env.NODE_ENV === 'test';

  if (explicitMockOptIn) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn(
        '[Integrations] Mock banking provider enabled via SAFE_HAVEN_ENV=mock. ' +
        'No real Safe Haven calls will be made.'
      );
    }
    return new MockBankingProvider();
  }

  // Fail-closed: no credentials and no explicit mock opt-in. NEVER fabricate
  // accounts — surface the configuration error to the caller.
  throw new Error(
    'Banking provider not configured: SAFEHAVEN_CLIENT_ID and SAFEHAVEN_PRIVATE_KEY are required. ' +
    'Set SAFE_HAVEN_ENV=mock to explicitly enable the mock provider for local development.'
  );
}
