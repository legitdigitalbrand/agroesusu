-- ============================================================================
-- 00050: Clear mock-era identity data so real verification can run
-- ============================================================================
-- Root cause (2026-09-08 audit): migration 00048 purged mock DVAs but left the
-- mock identity verification rows AND the dummy BVN/NIN values they wrote to
-- customers. With a BVN present in customers, POST /api/provisioning/identity
-- takes the auto-repair path ("already verified") instead of calling Safe
-- Haven, while ensureCustomerDva correctly refuses non-provider identities —
-- a silent dead end: the UI shows "verified", no DVA can ever be issued, and
-- no OTP is ever sent.
--
-- This migration removes the mock-era leftovers so affected customers can run
-- a REAL verification (₦50 provider debit → OTP → real identity id → DVA).
-- It is safe to re-run (all operations are idempotent).
-- ============================================================================

BEGIN;

-- 1. Delete mock/fabricated identity verification rows.
DELETE FROM safe_haven_identity_verifications
WHERE identity_id LIKE 'mock-%'
   OR identity_id LIKE 'customer-%';

-- 2. For customers whose ONLY verification was mock-era (no real verified
--    identity remains), clear identity fields so a real verification can run.
--    Customers with a REAL verified identity are untouched.
UPDATE customers c
SET bvn = NULL,
    nin = NULL,
    bvn_encrypted = NULL,
    nin_encrypted = NULL,
    identity_type = NULL,
    identity_verification_id = NULL,
    identity_verification_status = 'not_started',
    identity_verified_at = NULL,
    identity_verification_attempts = 0,
    identity_rejection_reason = NULL,
    updated_at = now()
WHERE (c.bvn IS NOT NULL
       OR c.nin IS NOT NULL
       OR c.identity_verification_status <> 'not_started')
  AND NOT EXISTS (
      SELECT 1 FROM safe_haven_identity_verifications v
      WHERE v.customer_id = c.id
        AND v.status = 'verified'
        AND v.identity_id NOT LIKE 'mock-%'
        AND v.identity_id NOT LIKE 'customer-%'
        AND v.identity_id <> ''
  );

-- 3. Reset kyc_tier for profiles whose customer has NO real verified
--    identity (the auto-repair path had falsely promoted them).
--    protect_sensitive_profile_columns() blocks kyc_tier changes unless the
--    session role is service_role/supabase_admin/postgres (hence the explicit SET LOCAL ROLE) — elevate for this
--    statement group.
SET LOCAL ROLE postgres;
UPDATE profiles p
SET kyc_tier = 'tier_0'
WHERE p.kyc_tier <> 'tier_0'
  AND EXISTS (SELECT 1 FROM customers c WHERE c.auth_id = p.id)
  AND NOT EXISTS (
      SELECT 1 FROM customers c
      JOIN safe_haven_identity_verifications v ON v.customer_id = c.id
      WHERE c.auth_id = p.id
        AND v.status = 'verified'
        AND v.identity_id NOT LIKE 'mock-%'
        AND v.identity_id NOT LIKE 'customer-%'
        AND v.identity_id <> ''
  );

COMMIT;
