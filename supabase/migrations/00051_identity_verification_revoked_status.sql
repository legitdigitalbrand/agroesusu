-- 00051: Add 'revoked' status to safe_haven_identity_verifications
--
-- Admin identity reset (PATCH /api/admin/customers/[customerId]/identity,
-- action=reset) revokes prior verification rows instead of deleting them —
-- the provider-side history and audit trail are preserved.

ALTER TABLE public.safe_haven_identity_verifications
  DROP CONSTRAINT IF EXISTS safe_haven_identity_verifications_status_check;

ALTER TABLE public.safe_haven_identity_verifications
  ADD CONSTRAINT safe_haven_identity_verifications_status_check
  CHECK (status IN ('otp_sent', 'verified', 'failed', 'expired', 'revoked'));
