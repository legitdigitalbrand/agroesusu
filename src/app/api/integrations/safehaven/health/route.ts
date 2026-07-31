import { NextResponse } from 'next/server';
import { getSafeHavenAuthService, SafeHavenAuthError } from '@/modules/integrations/safe-haven/auth';

// GET /api/integrations/safehaven/health
//
// Verifies the Safe Haven OAuth connection by:
//   1. Requesting an access token (OAuth handshake)
//   2. Confirming ibs_client_id is returned and captured
//   3. Calling GET /accounts with the authenticated session
//
// Returns a SAFE status object — NEVER returns the token, client ID, private key,
// client assertion, or any credentials.
//
// Response (success):
//   {
//     status: "connected",
//     environment: "sandbox",
//     message: "...",
//     latencyMs: 123,
//     oauth: { status: "ok", hasIbsClientId: true },
//     accounts: { status: "ok", httpStatus: 200, accountCount: 1 }
//   }

export async function GET() {
  try {
    const authService = getSafeHavenAuthService();
    const apiUrl = process.env.SAFEHAVEN_API_URL || 'https://api.sandbox.safehavenmfb.com';
    const start = Date.now();

    // Step 1: Get access token (OAuth handshake)
    const accessToken = await authService.getAccessToken();
    const ibsClientId = authService.getIbsClientId();
    const oauthLatency = Date.now() - start;

    if (!accessToken) {
      return NextResponse.json(
        {
          status: 'disconnected',
          environment: apiUrl.includes('sandbox') ? 'sandbox' : 'production',
          message: 'OAuth succeeded but no access token returned',
          latencyMs: oauthLatency,
        },
        { status: 503 },
      );
    }

    // Step 2: Verify GET /accounts with the authenticated session
    let accountsResult: { status: string; httpStatus: number; accountCount: number; message: string };

    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };

      // Include ibs_client_id in the ClientID header (required by Safe Haven)
      if (ibsClientId) {
        headers['ClientID'] = ibsClientId;
      }

      const response = await fetch(`${apiUrl}/accounts`, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(15000),
      });

      let body: unknown;
      try {
        body = await response.json();
      } catch {
        body = await response.text();
      }

      // Extract account count safely
      const dataBody = body as Record<string, unknown>;
      const dataArray = dataBody?.data as unknown[];
      const accountCount = Array.isArray(dataArray) ? dataArray.length : 0;

      accountsResult = {
        status: response.ok ? 'ok' : 'error',
        httpStatus: response.status,
        accountCount,
        message: response.ok
          ? 'GET /accounts successful'
          : `GET /accounts returned HTTP ${response.status}`,
      };
    } catch (err) {
      accountsResult = {
        status: 'error',
        httpStatus: 0,
        accountCount: 0,
        message: `GET /accounts failed: ${err instanceof Error ? err.message : 'network error'}`,
      };
    }

    const totalLatency = Date.now() - start;
    const connected = accountsResult.status === 'ok';

    return NextResponse.json(
      {
        status: connected ? 'connected' : 'disconnected',
        environment: apiUrl.includes('sandbox') ? 'sandbox' : 'production',
        message: connected
          ? 'OAuth handshake and GET /accounts both successful'
          : 'OAuth succeeded but GET /accounts failed',
        latencyMs: totalLatency,
        oauth: {
          status: 'ok',
          hasIbsClientId: !!ibsClientId,
        },
        accounts: accountsResult,
      },
      { status: connected ? 200 : 503 },
    );
  } catch (err) {
    const code = err instanceof SafeHavenAuthError ? err.code : 'unknown';
    const message = err instanceof SafeHavenAuthError ? err.message : 'Internal server error';

    return NextResponse.json(
      {
        status: 'disconnected',
        environment: 'unknown',
        message,
        errorCode: code,
        latencyMs: 0,
      },
      { status: 503 },
    );
  }
}
