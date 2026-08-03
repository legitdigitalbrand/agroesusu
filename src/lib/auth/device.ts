// ════════════════════════════════════════════════════════════
// Device management utilities for PIN-based authentication.
//
// Device ID is stored in an httpOnly cookie (set by the server
// during PIN setup). The client can read it via a companion
// non-httpOnly cookie that mirrors the value for UX purposes.
//
// The server is the authority — the client-provided device_id
// is always validated against the database (device_pins table).
// ════════════════════════════════════════════════════════════

const DEVICE_COOKIE = 'agriqcap_device';
const PIN_VERIFIED_COOKIE = 'agriqcap_pin_verified';

// ── Client-side helpers (for UX, not auth) ──

export function getDeviceId(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${DEVICE_COOKIE}=`));
  return match ? match.split('=')[1] : null;
}

export function hasPinVerifiedCookie(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie
    .split('; ')
    .some((c) => c.startsWith(`${PIN_VERIFIED_COOKIE}=true`));
}

// ── Server-side constants (used in API routes) ──

export const DEVICE_COOKIE_NAME = DEVICE_COOKIE;
export const PIN_VERIFIED_COOKIE_NAME = PIN_VERIFIED_COOKIE;
export const LAST_ACTIVITY_COOKIE_NAME = 'agriqcap_last_activity';
export const INACTIVITY_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours in ms

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 365 * 24 * 60 * 60, // 1 year for device cookie
};

export const PIN_VERIFIED_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  // Session-scoped: no maxAge means it clears when browser closes
};

export const LAST_ACTIVITY_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 30 * 24 * 60 * 60, // 30 days so cookie persists to evaluate inactivity timestamp
};
