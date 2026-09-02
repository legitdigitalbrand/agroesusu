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
 * Falls back to MockBankingProvider if SAFEHAVEN_CLIENT_ID is not set.
 */
export function getBankingProvider(): IBankingProvider {
  const clientId = process.env.SAFEHAVEN_CLIENT_ID;
  const privateKey = process.env.SAFEHAVEN_PRIVATE_KEY;
  const apiUrl = process.env.SAFEHAVEN_API_URL || 'https://api.sandbox.safehavenmfb.com';

  if (!clientId || !privateKey) {
    console.warn(
      '[Integrations] Using mock banking provider. Set SAFEHAVEN_CLIENT_ID and SAFEHAVEN_PRIVATE_KEY for live mode.'
    );
    return new MockBankingProvider();
  }

  return new SafeHavenAdapter({
    baseUrl: apiUrl,
    clientId,
    clientSecret: privateKey,
    webhookSecret: process.env.SAFE_HAVEN_WEBHOOK_SECRET || '',
    ibsClientId: process.env.SAFEHAVEN_IBS_CLIENT_ID,
  });
}
