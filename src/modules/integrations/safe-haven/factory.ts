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
 * - SAFE_HAVEN_ENV=mock (or no credentials) → MockBankingProvider
 * - SAFE_HAVEN_ENV=sandbox + credentials → SafeHavenAdapter (sandbox URL)
 * - SAFE_HAVEN_ENV=production + credentials → SafeHavenAdapter (production URL)
 */
export function getBankingProvider(): IBankingProvider {
  const env = process.env.SAFE_HAVEN_ENV || 'mock';
  const hasCredentials = process.env.SAFE_HAVEN_API_KEY && process.env.SAFE_HAVEN_SECRET_KEY;

  if (env === 'mock' || !hasCredentials) {
    console.warn(
      `[Integrations] Using mock banking provider. Set SAFE_HAVEN_ENV=sandbox and SAFE_HAVEN_API_KEY/SECRET_KEY for live mode.`
    );
    return new MockBankingProvider();
  }

  const baseUrl =
    env === 'sandbox'
      ? 'https://api.sandbox.safehavenmfb.com'
      : 'https://api.safehavenmfb.com';

  return new SafeHavenAdapter({
    baseUrl,
    clientId: process.env.SAFE_HAVEN_API_KEY!,
    clientSecret: process.env.SAFE_HAVEN_SECRET_KEY!,
    webhookSecret: process.env.SAFE_HAVEN_WEBHOOK_SECRET || '',
    ibsClientId: process.env.SAFE_HAVEN_IBS_CLIENT_ID,
  });
}
