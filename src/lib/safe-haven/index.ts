import { ISafeHavenClient, safeHavenClient } from './client';
import { mockSafeHavenClient } from './mock';

export function getSafeHavenClient(): ISafeHavenClient {
  const apiKey = process.env.SAFE_HAVEN_API_KEY;
  if (apiKey) {
    return safeHavenClient;
  }
  return mockSafeHavenClient;
}

export type { ISafeHavenClient };
