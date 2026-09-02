-- ═══════════════════════════════════════════════════════════════════════
-- AgriQCap Gate 2 — Database Architecture Migrations
-- Run this entire script in the Supabase Dashboard SQL Editor:
-- https://supabase.com/dashboard/project/vhzsnsovfjnztawzuueo/sql/new
-- ═══════════════════════════════════════════════════════════════════════

-- ─── Migration 00041: PII Encryption at Rest ───
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS bvn_encrypted text,
  ADD COLUMN IF NOT EXISTS nin_encrypted text;

ALTER TABLE public.safe_haven_identity_verifications
  ADD COLUMN IF NOT EXISTS number_encrypted text;

CREATE OR REPLACE FUNCTION public.encrypt_pii(plaintext text, key text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT pgp_sym_encrypt(plaintext, key)::text;
$$;

CREATE OR REPLACE FUNCTION public.decrypt_pii(ciphertext text, key text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT pgp_sym_decrypt(ciphertext::bytea, key);
$$;

REVOKE EXECUTE ON FUNCTION public.encrypt_pii(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.decrypt_pii(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.encrypt_pii(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.decrypt_pii(text, text) TO service_role;

COMMENT ON COLUMN public.customers.bvn_encrypted IS 'PGP-encrypted BVN. Use decrypt_pii() with PII_ENCRYPTION_KEY to read.';
COMMENT ON COLUMN public.customers.nin_encrypted IS 'PGP-encrypted NIN. Use decrypt_pii() with PII_ENCRYPTION_KEY to read.';
COMMENT ON COLUMN public.safe_haven_identity_verifications.number_encrypted IS 'PGP-encrypted identity number. Use decrypt_pii() with PII_ENCRYPTION_KEY to read.';

-- ─── Migration 00042: Fix Orphaned FKs + Create Beneficiaries Table ───

-- Fix 1: Orphaned FK references
ALTER TABLE public.notification_preferences 
  DROP CONSTRAINT IF EXISTS notification_preferences_user_id_fkey;
ALTER TABLE public.scheduled_reports
  DROP CONSTRAINT IF EXISTS scheduled_reports_user_id_fkey;

ALTER TABLE public.notification_preferences
  ADD CONSTRAINT notification_preferences_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.scheduled_reports
  ADD CONSTRAINT scheduled_reports_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Fix 2: Create beneficiaries table
CREATE TABLE IF NOT EXISTS public.beneficiaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  nickname text NOT NULL,
  account_name text NOT NULL,
  account_number text NOT NULL CHECK (char_length(account_number) = 10),
  bank_code text NOT NULL,
  bank_name text NOT NULL,
  name_enquiry_session_id text,
  is_verified boolean DEFAULT false,
  verification_date timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS beneficiaries_customer_account_bank_uniq
  ON public.beneficiaries(customer_id, account_number, bank_code);

ALTER TABLE public.beneficiaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY beneficiaries_read_self ON public.beneficiaries
  FOR SELECT TO authenticated
  USING (customer_id IN (
    SELECT id FROM public.customers WHERE auth_id = auth.uid()
  ));

CREATE POLICY beneficiaries_insert_self ON public.beneficiaries
  FOR INSERT TO authenticated
  WITH CHECK (customer_id IN (
    SELECT id FROM public.customers WHERE auth_id = auth.uid()
  ));

CREATE POLICY beneficiaries_update_self ON public.beneficiaries
  FOR UPDATE TO authenticated
  USING (customer_id IN (
    SELECT id FROM public.customers WHERE auth_id = auth.uid()
  ))
  WITH CHECK (customer_id IN (
    SELECT id FROM public.customers WHERE auth_id = auth.uid()
  ));

CREATE POLICY beneficiaries_delete_self ON public.beneficiaries
  FOR DELETE TO authenticated
  USING (customer_id IN (
    SELECT id FROM public.customers WHERE auth_id = auth.uid()
  ));

CREATE POLICY beneficiaries_read_staff ON public.beneficiaries
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.staff_users su
    WHERE su.auth_id = auth.uid() AND su.is_active = true
  ));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.beneficiaries TO authenticated;

CREATE OR REPLACE TRIGGER beneficiaries_updated_at
  BEFORE UPDATE ON public.beneficiaries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.beneficiaries IS 'Saved beneficiary accounts for customer transfers. PRD Section 36.';

-- ═══════════════════════════════════════════════════════════════════════
-- DONE — All Gate 2 migrations applied.
-- ═══════════════════════════════════════════════════════════════════════
