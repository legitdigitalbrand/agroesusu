// ═══════════════════════════════════════════════════════════════
// Agriqcap — OTP Utility
//
// Generates and verifies 6-digit OTP codes for the Resend email flow.
// When Resend is not configured, the system falls back to Supabase
// GoTrue's built-in OTP — these functions are not used in that path.
// ═══════════════════════════════════════════════════════════════

import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { OTP_LENGTH } from './device';

/**
 * Generate a cryptographically random numeric OTP code.
 */
export function generateOtp(length: number = OTP_LENGTH): string {
  const digits: string[] = [];
  const bytes = randomBytes(length);
  for (let i = 0; i < length; i++) {
    digits.push(String(bytes[i] % 10));
  }
  return digits.join('');
}

/**
 * Hash an OTP code for storage in a cookie.
 * Uses HMAC-SHA256 with a server-side secret.
 */
function getSecret(): string {
  return process.env.OTP_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'agriqcap-otp-fallback';
}

export function hashOtp(code: string): string {
  return createHmac('sha256', getSecret())
    .update(code)
    .digest('hex');
}

/**
 * Verify an OTP code against a stored hash.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function verifyOtp(code: string, storedHash: string): boolean {
  const candidateHash = hashOtp(code);
  try {
    return timingSafeEqual(Buffer.from(candidateHash, 'hex'), Buffer.from(storedHash, 'hex'));
  } catch {
    return false;
  }
}
