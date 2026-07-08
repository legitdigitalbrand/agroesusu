import { createAdminClient } from "@/lib/supabase/server";

/**
 * Lightweight DB-backed rate limiter for money-movement endpoints
 * (withdraw/deposit/group-contribute init). Reuses the existing
 * `audit_logs` table as a request ledger instead of standing up new
 * infrastructure (Redis, etc.) — appropriate for current volume; revisit
 * if traffic grows enough that this query becomes a hot path.
 *
 * Call this AFTER verifying the caller is authenticated, before doing any
 * real work. Fails OPEN on its own infra errors — a rate-limit outage
 * should not be able to block legitimate money movement; it's a
 * defense-in-depth layer on top of the real balance/lock/KYC checks, not a
 * replacement for them.
 */
export async function checkRateLimit(
  userId: string,
  action: string,
  opts: { maxAttempts: number; windowSeconds: number }
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const admin = createAdminClient();
  const windowStart = new Date(Date.now() - opts.windowSeconds * 1000).toISOString();

  const { count, error } = await admin
    .from("audit_logs")
    .select("id", { count: "exact", head: true })
    .eq("actor_id", userId)
    .eq("action", action)
    .gte("created_at", windowStart);

  if (error) {
    console.error("Rate limit check failed (failing open):", error);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if ((count || 0) >= opts.maxAttempts) {
    return { allowed: false, retryAfterSeconds: opts.windowSeconds };
  }

  // Log this attempt immediately (not after the request finishes) so a
  // request that fails downstream and gets retried still counts toward
  // the window — otherwise a retry-storm on failures could bypass the cap.
  await admin.from("audit_logs").insert({
    entity_type: "rate_limit",
    actor_id: userId,
    action,
    severity: "info",
  });

  return { allowed: true, retryAfterSeconds: 0 };
}
