import { NextResponse } from 'next/server';
import { getSafeHavenAuthService, SafeHavenAuthError } from '@/modules/integrations/safe-haven/auth';

// GET /api/integrations/safehaven/health
//
// Verifies the Safe Haven OAuth connection by requesting an access token.
// Returns a SAFE status object — NEVER returns the token, client ID, or any secrets.
//
// Response (success):
//   { status: "connected", environment: "sandbox", message: "...", latencyMs: 123 }
//
// Response (failure):
//   { status: "disconnected", environment: "sandbox", message: "...", latencyMs: 123, errorCode: "..." }

export async function GET() {
  try {
    const authService = getSafeHavenAuthService();
    const health = await authService.healthCheck();
    return NextResponse.json(health, { status: health.status === 'connected' ? 200 : 503 });
  } catch (err) {
    // If the service can't even be constructed (missing config), return a safe error
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
