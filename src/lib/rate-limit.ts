import { NextResponse } from 'next/server';

// ============================================================================
// Simple In-Memory Rate Limiter
//
// For sandbox/early production. In production at scale, replace with
// Upstash Redis or Vercel KV for distributed rate limiting.
//
// Usage:
//   import { checkRateLimit } from '@/lib/rate-limit';
//   const result = checkRateLimit(identifier, limit, windowMs);
//   if (!result.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
// ============================================================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// Module-level Map — persists within a single serverless function instance
const rateLimitMap = new Map<string, RateLimitEntry>();

// Clean up old entries every 5 minutes to prevent memory leaks
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 5 * 60 * 1000;

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of rateLimitMap.entries()) {
    if (entry.resetAt < now) {
      rateLimitMap.delete(key);
    }
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check if a request should be rate limited.
 * 
 * @param identifier - Unique key (e.g. IP address or user ID + route)
 * @param limit - Max requests allowed in the window
 * @param windowMs - Time window in milliseconds
 * @returns { allowed, remaining, resetAt }
 */
export function checkRateLimit(
  identifier: string,
  limit: number,
  windowMs: number = 60_000
): RateLimitResult {
  cleanup();
  
  const now = Date.now();
  const key = identifier;
  const entry = rateLimitMap.get(key);

  if (!entry || entry.resetAt < now) {
    // New window or expired window
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

/**
 * Get client IP from Vercel request headers.
 */
export function getClientIP(request: Request): string {
  return (
    request.headers.get('x-vercel-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

/**
 * Build a rate limit identifier from IP and route path.
 * Format: "ip:route" to limit per-route per-IP.
 */
export function getRateLimitIdentifier(request: Request, routePrefix: string): string {
  const ip = getClientIP(request);
  return `${ip}:${routePrefix}`;
}

/**
 * Rate limit configurations for sensitive endpoints.
 * Limits are conservative — adjust based on production traffic.
 */
export const RATE_LIMITS = {
  // Authentication — strict to prevent brute force
  AUTH: { limit: 10, windowMs: 60_000 },      // 10/min for login, PIN
  SIGNUP: { limit: 5, windowMs: 60_000 },     // 5/min for signup
  RECOVERY: { limit: 3, windowMs: 60_000 },   // 3/min for password/PIN recovery
  OTP: { limit: 5, windowMs: 60_000 },        // 5/min for OTP requests
  
  // Financial operations — moderate
  DEPOSIT: { limit: 20, windowMs: 60_000 },   // 20/min for deposits
  WITHDRAW: { limit: 10, windowMs: 60_000 },  // 10/min for withdrawals (stricter)
  TRANSFER: { limit: 10, windowMs: 60_000 },  // 10/min for transfers
  SAVINGS: { limit: 20, windowMs: 60_000 },   // 20/min for savings operations
  LOAN: { limit: 10, windowMs: 60_000 },      // 10/min for loan applications
  
  // Provisioning & verification — strict
  PROVISIONING: { limit: 5, windowMs: 60_000 }, // 5/min for identity provisioning
  VERIFICATION: { limit: 10, windowMs: 60_000 }, // 10/min for verification checks
  
  // Admin — moderate
  ADMIN: { limit: 30, windowMs: 60_000 },     // 30/min for admin operations
  
  // Webhooks — generous (provider may burst)
  WEBHOOK: { limit: 100, windowMs: 60_000 }, // 100/min for webhooks
  
  // Default — generous
  DEFAULT: { limit: 60, windowMs: 60_000 },   // 60/min default
} as const;

/**
 * Apply rate limiting to a request. Returns null if allowed, or a 429 response if blocked.
 * 
 * Usage in API route:
 *   const limited = applyRateLimit(request, '/api/auth/login', RATE_LIMITS.AUTH);
 *   if (limited) return limited;
 */
export function applyRateLimit(
  request: Request,
  routeKey: string,
  config: { limit: number; windowMs: number }
): NextResponse | null {
  const identifier = getRateLimitIdentifier(request, routeKey);
  const result = checkRateLimit(identifier, config.limit, config.windowMs);
  
  if (!result.allowed) {
    const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { 
        error: 'Too many requests. Please try again later.',
        retry_after: retryAfter,
      },
      { 
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(config.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(result.resetAt),
        },
      }
    );
  }
  
  return null;
}
