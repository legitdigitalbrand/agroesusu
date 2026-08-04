// ════════════════════════════════════════════════════════════
// Agriqcap — Device & Session Constants
//
// Device ID is stored in a cookie for UX purposes.
// Session inactivity timeout is enforced server-side via middleware.
// PIN authentication has been removed — standard email/password only.
// ════════════════════════════════════════════════════════════

const DEVICE_COOKIE = 'agriqcap_device';

// ── Client-side helpers (for UX, not auth) ──

export function getDeviceId(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${DEVICE_COOKIE}=`));
  return match ? match.split('=')[1] : null;
}

// ── Server-side constants (used in middleware/API) ──

export const DEVICE_COOKIE_NAME = DEVICE_COOKIE;
export const LAST_ACTIVITY_COOKIE_NAME = 'agriqcap_last_activity';
export const INACTIVITY_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours in ms

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 365 * 24 * 60 * 60, // 1 year for device cookie
};

export const LAST_ACTIVITY_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 30 * 24 * 60 * 60, // 30 days so cookie persists to evaluate inactivity timestamp
};
