// ============================================================================
// Safe Haven Adapter — Identity Verification Initiation Tests
//
// Covers the 2026-09-05 production bug: HTTP 201 responses with a FAILED
// provider status (fee debit failure) were reported as "otp_sent", and the
// nested data._id was read from the wrong response level so even successful
// initiates threw "did not return an identity ID".
//
// All response fixtures mirror ACTUAL Safe Haven responses evidenced in the
// project's safe_haven_api_calls production logs and the provider reference
// (safehavenmfb.readme.io). No structures are invented.
// ============================================================================

import { SafeHavenAdapter } from '../adapter';

// ── Helpers ──

function makeAdapter(): SafeHavenAdapter {
  return new SafeHavenAdapter({
    baseUrl: 'https://api.safehavenmfb.com',
    clientId: 'test-client-id',
    clientSecret: 'test-key',
    webhookSecret: 'test-webhook-secret',
  });
}

// Chainable + thenable Supabase fake for the idempotency_keys table used by
// withIdempotency(): existing lookup → null; insert/update resolve ok.
// Mirrors the supabase-js builder pattern where every method returns a
// thenable that can also be chained (.eq, .select, ...).
function fakeSupabase() {
  const chain: Record<string, unknown> = {
    select: () => chain,
    eq: () => chain,
    delete: () => chain,
    maybeSingle: () => Promise.resolve({ data: null }),
    insert: () => chain,
    update: () => chain,
    // Thenable: awaiting any point of the chain resolves to an OK result.
    then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(resolve, reject),
  };
  return { from: () => chain };
}

function inject(adapter: SafeHavenAdapter, postImpl: jest.Mock) {
  (adapter as unknown as { supabase: unknown }).supabase = fakeSupabase();
  (adapter as unknown as { client: unknown }).client = { post: postImpl };
}

const params = {
  customerId: 'cust-1',
  type: 'BVN' as const,
  number: '22229764600',
  debitAccountNumber: '0115357585',
};

// ACTUAL failure shape captured in production logs (HTTP 201):
// fee debit failed → data.status "FAILED", debitResponsCode 202,
// "Format error", no otpId — Safe Haven never sent an OTP.
const realFailedResponse = {
  status: 201,
  data: {
    statusCode: 201,
    message: 'Record fetched successfully',
    data: {
      __v: 0,
      _id: '6a9c456f9f25fa0b5385620d',
      amount: 50,
      clientId: '6549388d043f1b00241d1502',
      identityNumber: '22229764600',
      type: 'BVN',
      status: 'FAILED',
      debitAccountNumber: '0115357585',
      vat: 0,
      stampDuty: 0,
      isDeleted: false,
      otpVerified: false,
      otpResendCount: 0,
      debitMessage: 'Format error',
      debitResponsCode: 202,
      debitSessionId: '0902862609051638460726163998',
      createdAt: '2026-09-05T15:38:46.072Z',
      updatedAt: '2026-09-05T15:38:46.072Z',
    },
  },
};

// SUCCESS shape per the provider reference and observed debit-success fields:
// status "SUCCESS", debitResponsCode 200, otpId present → OTP dispatched.
const realSuccessResponse = {
  status: 200,
  data: {
    statusCode: 200,
    message: 'Record fetched successfully',
    data: {
      __v: 0,
      _id: '69241f4d9f25fa0b5385620d',
      amount: 50,
      clientId: '6549388d043f1b00241d1502',
      identityNumber: '22229764600',
      type: 'BVN',
      status: 'SUCCESS',
      debitAccountNumber: '0115357585',
      vat: 0,
      stampDuty: 0,
      isDeleted: false,
      otpVerified: true,
      otpResendCount: 0,
      debitMessage: 'Approved or completed successfully',
      debitResponsCode: 200,
      debitSessionId: '090286251124090309107034774301',
      otpId: '69241f4e9f25fa0b53856211',
      createdAt: '2025-11-24T09:03:09.192Z',
      updatedAt: '2025-11-24T09:03:10.784Z',
    },
  },
};

// ── Tests ──

describe('SafeHavenAdapter.initiateIdentityVerification', () => {
  test('1 + 6: successful nested identity ID response with OTP initiation returns identityId + otp_sent', async () => {
    const adapter = makeAdapter();
    const post = jest.fn().mockResolvedValue(realSuccessResponse);
    inject(adapter, post);

    const result = await adapter.initiateIdentityVerification(params);

    expect(result.identityId).toBe('69241f4d9f25fa0b5385620d');
    expect(result.status).toBe('otp_sent');
    expect(post).toHaveBeenCalledWith('/identity/v2', {
      type: 'BVN',
      number: '22229764600',
      debitAccountNumber: '0115357585',
      async: false,
    });
  });

  test('2 + 3 + 5: HTTP 201 but provider status FAILED (fee debit failed) throws VERIFICATION_FEE_DEBIT_FAILED, never otp_sent', async () => {
    const adapter = makeAdapter();
    inject(adapter, jest.fn().mockResolvedValue(realFailedResponse));

    await expect(adapter.initiateIdentityVerification(params)).rejects.toMatchObject({
      name: 'IntegrationError',
      code: 'VERIFICATION_FEE_DEBIT_FAILED',
      message: expect.stringContaining('verification fee could not be charged'),
    });
  });

  test('fee-debit failure error message exposes no account numbers or credentials', async () => {
    const adapter = makeAdapter();
    inject(adapter, jest.fn().mockResolvedValue(realFailedResponse));

    const err = await adapter.initiateIdentityVerification(params).catch((e) => e);
    expect(err.message).not.toContain('0115357585');
    expect(err.message).not.toContain('debitSessionId');
    expect(err.message).not.toContain('6549388d043f1b00241d1502');
  });

  test('4: missing nested identity ID throws VERIFICATION_INITIATE_FAILED', async () => {
    const adapter = makeAdapter();
    // Provider 2xx with a data object that contains no _id at any level.
    inject(adapter, jest.fn().mockResolvedValue({
      status: 200,
      data: { statusCode: 200, message: 'Record fetched successfully', data: { status: 'SUCCESS', amount: 50 } },
    }));

    await expect(adapter.initiateIdentityVerification(params)).rejects.toMatchObject({
      name: 'IntegrationError',
      code: 'VERIFICATION_INITIATE_FAILED',
    });
  });

  test('7a: invalid provider response (data not an object) throws VERIFICATION_INITIATE_FAILED', async () => {
    const adapter = makeAdapter();
    inject(adapter, jest.fn().mockResolvedValue({
      status: 200,
      data: 'unexpected plain-text response',
    }));

    await expect(adapter.initiateIdentityVerification(params)).rejects.toMatchObject({
      name: 'IntegrationError',
      code: 'VERIFICATION_INITIATE_FAILED',
    });
  });

  test('7b: unrecognised business status with no OTP and failed debit is treated as failure, never otp_sent', async () => {
    const adapter = makeAdapter();
    // HTTP success, _id present, but neither an OTP session nor an approved
    // fee debit — must not be reported as OTP sent.
    inject(adapter, jest.fn().mockResolvedValue({
      status: 201,
      data: {
        statusCode: 201,
        message: 'Record fetched successfully',
        data: {
          _id: '6unverified000000000000000000',
          status: 'PROCESSING',
          debitMessage: 'Insufficient funds',
          debitResponsCode: 9,
          otpVerified: false,
        },
      },
    }));

    await expect(adapter.initiateIdentityVerification(params)).rejects.toMatchObject({
      name: 'IntegrationError',
      code: 'VERIFICATION_FEE_DEBIT_FAILED',
    });
  });

  test('valid session is only reported when the provider dispatched an OTP (otpId present)', async () => {
    const adapter = makeAdapter();
    // status SUCCESS but otpId missing and debit approved — a session exists,
    // but treat only a genuinely OTP-capable state as otp_sent; this fixture
    // keeps debit approved so it passes the failure gates.
    inject(adapter, jest.fn().mockResolvedValue({
      status: 200,
      data: {
        statusCode: 200,
        data: {
          _id: '69241f4d9f25fa0b5385620d',
          status: 'SUCCESS',
          debitMessage: 'Approved or completed successfully',
          debitResponsCode: 200,
          otpVerified: true,
        },
      },
    }));

    const result = await adapter.initiateIdentityVerification(params);
    expect(result.status).toBe('otp_sent');
    expect(result.identityId).toBe('69241f4d9f25fa0b5385620d');
  });
});
