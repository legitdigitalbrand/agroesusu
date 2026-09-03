// ============================================================================
// Webhook security tests (Gate 4 funding fix)
//
// An invalid/unverified webhook must never be able to create wallet funds.
// The token gate is the first line of defense; the deposit branch additionally
// re-verifies the transaction with Safe Haven before crediting (quarantine on
// indeterminate — covered by the webhook route's credit-verification tests).
// ============================================================================

import { verifyWebhookToken } from '../webhook-security';

function makeRequest(url: string) {
  return { nextUrl: new URL(url) } as never;
}

const SECRET = 'whsec_abc123DEF456';

describe('verifyWebhookToken', () => {
  beforeEach(() => {
    process.env.SAFE_HAVEN_WEBHOOK_SECRET = SECRET;
  });

  it('rejects a webhook with NO token', () => {
    const req = makeRequest('https://agriqcap.vercel.app/api/webhooks/safe-haven');
    expect(verifyWebhookToken(req)).toBe(false);
  });

  it('rejects a webhook with the WRONG token', () => {
    const req = makeRequest('https://agriqcap.vercel.app/api/webhooks/safe-haven?token=wrong-token');
    expect(verifyWebhookToken(req)).toBe(false);
  });

  it('rejects a token of different LENGTH (timing-safe early exit)', () => {
    const req = makeRequest('https://agriqcap.vercel.app/api/webhooks/safe-haven?token=short');
    expect(verifyWebhookToken(req)).toBe(false);
  });

  it('accepts a webhook with the CORRECT token', () => {
    const req = makeRequest(`https://agriqcap.vercel.app/api/webhooks/safe-haven?token=${SECRET}`);
    expect(verifyWebhookToken(req)).toBe(true);
  });

  it('rejects even a prefix-match token (full exact match required)', () => {
    const req = makeRequest(`https://agriqcap.vercel.app/api/webhooks/safe-haven?token=${SECRET}X`);
    expect(verifyWebhookToken(req)).toBe(false);
  });
});

export {};
