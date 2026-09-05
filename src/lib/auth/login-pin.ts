// ============================================================================
// Agriqcap — Login PIN (server-side primitives)
//
// A user-configurable 4-digit PIN required after password sign-in when the
// user has one set up.
//
// Security properties:
//   * The PIN is stored ONLY as a salted scrypt hash (login_pins.pin_hash).
//   * The gate cookie is HMAC-SHA256 signed with a server-only key — unlike
//     the OTP cookie it cannot be forged by setting a cookie by hand.
//   * Verification, setup and reset happen in API routes with the service
//     client; the middleware only verifies the signed cookie.
//   * Failed attempts are tracked server-side with a lockout window.
// ============================================================================

import crypto from 'crypto';

// ── Cookie ──
export const PIN_COOKIE_NAME = 'agriqcap_pin_v';
export const PIN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  // Pin to the login session: re-entered after the PIN expires or sign-out.
  maxAge: 12 * 60 * 60,
};

// ── Policy ──
export const PIN_LENGTH = 4;
export const PIN_MAX_FAILED_ATTEMPTS = 5;
export const PIN_LOCKOUT_MINUTES = 15;

/** Get the server-only HMAC key for the gate cookie. Never exposed client-side. */
async function getCookieSecret(): Promise<string> {
  // Key-separation label over the service key: only the server can produce or
  // verify gate cookies; the service key itself is never in any cookie value.
  const base = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!base) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for PIN cookie signing');
  return 'agriqcap-pin-cookie-v1:' + base;
}

async function hmac(value: string, secret: string): Promise<string> {
  // Web Crypto — works in both Node (API routes) and Edge (middleware).
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(value));
  return Buffer.from(sig).toString('base64url');
}

/**
 * Create the signed PIN-gate cookie value for a user.
 * Format: `<userId>:<expiresAtMs>:<hmac(userId:expiresAtMs)>`
 */
export async function signPinCookie(userId: string): Promise<string> {
  const exp = Date.now() + PIN_COOKIE_OPTIONS.maxAge * 1000;
  const secret = await getCookieSecret();
  const sig = await hmac(`${userId}:${exp}`, secret);
  return `${userId}:${exp}:${sig}`;
}

/** Verify a PIN-gate cookie value for a user. Returns true only if valid. */
export async function verifyPinCookie(value: string | undefined, userId: string): Promise<boolean> {
  if (!value) return false;
  const parts = value.split(':');
  if (parts.length !== 3) return false;
  const [uid, expStr, sig] = parts;
  const exp = parseInt(expStr, 10);
  if (uid !== userId || !Number.isFinite(exp) || exp < Date.now()) return false;
  const secret = await getCookieSecret();
  const expected = await hmac(`${userId}:${exp}`, secret);
  // Constant-time compare.
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ── PIN hashing (server-side only; API routes run on the Node runtime) ──

/** Hash a 4-digit PIN with a random salt (scrypt). Returns `scrypt$<salt>$<hash>`. */
export function hashPin(pin: string): string {
  if (!/^\d{4}$/.test(pin)) throw new Error('PIN must be exactly 4 digits');
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pin, salt, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

/** Verify a plaintext PIN against a stored `scrypt$<salt>$<hash>` string. */
export function verifyPinHash(pin: string, stored: string): boolean {
  if (!/^\d{4}$/.test(pin)) return false;
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[1], 'base64');
  const expected = Buffer.from(parts[2], 'base64');
  const actual = crypto.scryptSync(pin, salt, expected.length, { N: 16384, r: 8, p: 1 });
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

/** Validate PIN format (exactly 4 digits, no patterns from plaintext rules). */
export function isValidPinFormat(pin: unknown): pin is string {
  return typeof pin === 'string' && /^\d{4}$/.test(pin);
}
