// ============================================================================
// Webhook security primitives (Gate 4)
//
// Extracted from /api/webhooks/safe-haven so the verification logic is
// directly unit-testable. Behavior is identical to the previous inline
// implementation.
// ============================================================================

import { NextRequest } from 'next/server';
import * as crypto from 'crypto';

/**
 * The webhook URL registered with Safe Haven should be:
 *   https://agriqcap.vercel.app/api/webhooks/safe-haven?token=SAFE_HAVEN_WEBHOOK_SECRET
 *
 * Checks that the `token` query parameter matches the env var using a
 * timing-safe comparison.
 *
 * If no secret is configured, returns true (dev mode ONLY — documented
 * behavior; production always has SAFE_HAVEN_WEBHOOK_SECRET set).
 */
export function verifyWebhookToken(request: NextRequest): boolean {
  const webhookSecret = process.env.SAFE_HAVEN_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.warn('[Webhook] No SAFE_HAVEN_WEBHOOK_SECRET — accepting all (dev mode ONLY)');
    return true; // Dev mode — do NOT block when secret is not configured
  }
  const token = request.nextUrl.searchParams.get('token');
  if (!token) return false;
  try {
    const a = Buffer.from(token);
    const b = Buffer.from(webhookSecret);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
