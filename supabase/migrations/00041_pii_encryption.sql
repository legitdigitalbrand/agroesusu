-- Migration 00041: PII Encryption at Rest
-- Adds pgcrypto extension and encrypted columns for BVN/NIN
-- Existing plaintext columns remain for backward compatibility during migration
-- New writes should go to encrypted columns; reads should prefer encrypted columns

-- ─── Enable pgcrypto ───
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── Add encrypted columns to customers ───
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS bvn_encrypted text,
  ADD COLUMN IF NOT EXISTS nin_encrypted text;

-- ─── Add encrypted columns to safe_haven_identity_verifications ───
ALTER TABLE public.safe_haven_identity_verifications
  ADD COLUMN IF NOT EXISTS number_encrypted text;

-- ─── Migration function: encrypt existing plaintext data ───
-- Uses a deterministic key from the application — in production, this should
-- be a KMS-managed key. For now, we use a Supabase Vault secret or env var.
-- The encryption key MUST be set as an environment variable: PII_ENCRYPTION_KEY
-- This migration only adds the columns; data migration must be done via
-- application code after the key is configured.

-- ─── Helper: encrypt PII (call from application layer) ───
CREATE OR REPLACE FUNCTION public.encrypt_pii(plaintext text, key text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT pgp_sym_encrypt(plaintext, key)::text;
$$;

-- ─── Helper: decrypt PII (call from application layer) ───
CREATE OR REPLACE FUNCTION public.decrypt_pii(ciphertext text, key text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT pgp_sym_decrypt(ciphertext::bytea, key);
$$;

-- ─── Revoke public access to encryption functions ───
REVOKE EXECUTE ON FUNCTION public.encrypt_pii(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.decrypt_pii(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.encrypt_pii(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.decrypt_pii(text, text) TO service_role;

-- ─── RLS on new columns (inherits from table RLS) ───
-- No additional RLS needed — columns inherit table-level RLS policies.

-- ─── Comment ───
COMMENT ON COLUMN public.customers.bvn_encrypted IS 'PGP-encrypted BVN. Use decrypt_pii() with PII_ENCRYPTION_KEY to read.';
COMMENT ON COLUMN public.customers.nin_encrypted IS 'PGP-encrypted NIN. Use decrypt_pii() with PII_ENCRYPTION_KEY to read.';
COMMENT ON COLUMN public.safe_haven_identity_verifications.number_encrypted IS 'PGP-encrypted identity number. Use decrypt_pii() with PII_ENCRYPTION_KEY to read.';
