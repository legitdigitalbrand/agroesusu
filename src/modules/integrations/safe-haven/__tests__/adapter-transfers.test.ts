/**
 * Safe Haven adapter — transfers (name enquiry / transfer / status)
 *
 * Regression tests for the response-envelope fix: Safe Haven wraps payloads
 * in { statusCode, responseCode, message, data: {...} } and reports transfer
 * status as "Completed"/"Pending"/"Failed" (Capitalized). The adapter must
 * read the inner `data` object and normalize the status — a wrong mapping
 * marks completed transfers as failed and triggers an escrow reversal while
 * the money has actually left (Gate 4-style fail-closed review).
 */

import { SafeHavenAdapter } from '../adapter';
import { SafeHavenClient } from '../client';
import { IntegrationError } from '../../types';

// Chainable thenable Supabase fake for the idempotency_keys table.
function fakeSupabase() {
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: async () => ({ data: null }),
    insert: () => chain,
    update: () => chain,
    delete: () => chain,
    upsert: async () => ({ error: null }),
  };
  return chain as any;
}

function makeAdapter(postResponses: Record<string, { status: number; data: unknown }>) {
  const adapter = new SafeHavenAdapter({
    baseUrl: 'https://api.sandbox.safehavenmfb.com',
    clientId: 'test-client-id',
    clientSecret: 'test-secret',
    webhookSecret: 'whsec',
  });
  (adapter as unknown as { supabase: unknown }).supabase = { from: () => fakeSupabase() };

  // Stub the low-level client: every call hits idempotency (empty table) then
  // returns the canned response for its path.
  const real = adapter['client'] as unknown as SafeHavenClient;
  (adapter as any)['client'] = {
    post: jest.fn(async (path: string) => {
      const canned = postResponses[path];
      if (!canned) throw new Error(`unexpected POST ${path}`);
      return canned;
    }),
    get: jest.fn(async (path: string) => {
      const canned = postResponses[path];
      if (!canned) throw new Error(`unexpected GET ${path}`);
      return canned;
    }),
    authenticate: real.authenticate,
  };
  return adapter;
}

describe('SafeHavenAdapter — nameEnquiry', () => {
  test('reads sessionId/accountName from the nested data envelope (real provider shape)', async () => {
    const adapter = makeAdapter({
      '/transfers/name-enquiry': {
        status: 200,
        data: {
          statusCode: 200,
          responseCode: '00',
          message: 'Approved or completed successfully',
          data: {
            responseCode: '00',
            responseMessage: 'Approved or completed successfully',
            sessionId: '999240251124101245674114910662',
            bankCode: '000014',
            accountNumber: '0106664982',
            accountName: 'BITAKO TECHNOLOGIES LIMITED',
            kycLevel: '3',
          },
        },
      },
    });

    const result = await adapter.nameEnquiry({
      accountNumber: '0106664982',
      bankCode: '000014',
    });

    expect(result.sessionId).toBe('999240251124101245674114910662');
    expect(result.accountName).toBe('BITAKO TECHNOLOGIES LIMITED');
    expect(result.bankName).toBe('Unknown'); // provider does not return one
  });

  test('fail-closed: no sessionId in response throws, never returns an empty session', async () => {
    const adapter = makeAdapter({
      '/transfers/name-enquiry': {
        status: 200,
        data: {
          statusCode: 200,
          responseCode: '00',
          message: 'Approved or completed successfully',
          data: { responseCode: '00', accountName: 'SOMEONE' }, // no sessionId
        },
      },
    });

    await expect(
      adapter.nameEnquiry({ accountNumber: '0106664982', bankCode: '000014' })
    ).rejects.toThrow(IntegrationError);
  });

  test('fail-closed: empty accountName throws (customer cannot confirm beneficiary)', async () => {
    const adapter = makeAdapter({
      '/transfers/name-enquiry': {
        status: 200,
        data: {
          statusCode: 200,
          data: { sessionId: 'sess-123', accountName: '   ' },
        },
      },
    });

    await expect(
      adapter.nameEnquiry({ accountNumber: '0106664982', bankCode: '000014' })
    ).rejects.toThrow(IntegrationError);
  });
});

describe('SafeHavenAdapter — transfer', () => {
  const params = {
    nameEnquiryReference: 'sess-abc',
    debitAccountNumber: '011234561',
    beneficiaryBankCode: '000014',
    beneficiaryAccountNumber: '0106664982',
    amount: 5000,
    narration: 'Test',
    paymentReference: 'WDL-123',
  };

  test('maps real "Completed" response to success (was mapping to failed!)', async () => {
    const adapter = makeAdapter({
      '/transfers': {
        status: 200,
        data: {
          statusCode: 200,
          responseCode: '00',
          message: 'Approved or completed successfully',
          data: {
            status: 'Completed',
            sessionId: '999240230705103517889604437936',
            nameEnquiryReference: 'sess-abc',
            paymentReference: 'WDL-123',
            responseCode: '00',
            responseMessage: 'Approved or completed successfully',
            isReversed: false,
            amount: 5000,
          },
        },
      },
    });

    const result = await adapter.transfer(params);
    expect(result.status).toBe('success');
    expect(result.reference).toBe('WDL-123');
    expect(result.rawStatus).toBe('Completed');
  });

  test('maps "Pending" response to pending — funds stay reserved for reconciliation', async () => {
    const adapter = makeAdapter({
      '/transfers': {
        status: 200,
        data: {
          statusCode: 200,
          data: { status: 'Pending', responseCode: '00', isReversed: false },
        },
      },
    });

    const result = await adapter.transfer(params);
    expect(result.status).toBe('pending');
  });

  test('maps explicit failure status to failed', async () => {
    const adapter = makeAdapter({
      '/transfers': {
        status: 200,
        data: {
          statusCode: 200,
          data: { status: 'Failed', responseCode: 'XX', isReversed: false, responseMessage: 'Invalid account' },
        },
      },
    });

    const result = await adapter.transfer(params);
    expect(result.status).toBe('failed');
    expect(result.message).toBe('Invalid account');
  });

  test('isReversed=true maps to failed (provider returned the funds)', async () => {
    const adapter = makeAdapter({
      '/transfers': {
        status: 200,
        data: {
          statusCode: 200,
          data: { status: 'Completed', isReversed: true, responseMessage: 'Reversed' },
        },
      },
    });

    const result = await adapter.transfer(params);
    expect(result.status).toBe('failed');
  });

  test('unknown status + responseCode 00 maps to success, not failed', async () => {
    const adapter = makeAdapter({
      '/transfers': {
        status: 200,
        data: { statusCode: 200, data: { responseCode: '00', isReversed: false } },
      },
    });

    const result = await adapter.transfer(params);
    expect(result.status).toBe('success');
  });

  test('no recognizable status at all maps to pending — never a blind reversal', async () => {
    const adapter = makeAdapter({
      '/transfers': {
        status: 200,
        data: { statusCode: 200, data: {} },
      },
    });

    const result = await adapter.transfer(params);
    expect(result.status).toBe('pending');
  });
});

describe('SafeHavenAdapter — getTransferStatus', () => {
  test('reads nested status object and normalizes casing', async () => {
    const adapter = makeAdapter({
      '/transfers/status': {
        status: 200,
        data: {
          statusCode: 200,
          responseCode: '00',
          data: {
            queued: false,
            limitExceeded: false,
            sessionId: '999240251203085206775164061497',
            paymentReference: 'WDL-123',
            isReversed: false,
            status: 'Completed',
          },
        },
      },
    });

    const result = await adapter.getTransferStatus('WDL-123');
    expect(result.status).toBe('success');
    expect(result.reference).toBe('WDL-123');
  });

  test('pending transfer stays pending', async () => {
    const adapter = makeAdapter({
      '/transfers/status': {
        status: 200,
        data: { statusCode: 200, data: { status: 'Pending', isReversed: false } },
      },
    });

    const result = await adapter.getTransferStatus('WDL-123');
    expect(result.status).toBe('pending');
  });
});
