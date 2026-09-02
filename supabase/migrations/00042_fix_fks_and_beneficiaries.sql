-- Migration 00042: Fix orphaned FKs + Create beneficiaries table
-- Date: September 2, 2026
-- 
-- FIXES:
-- 1. notification_preferences and scheduled_reports reference profiles(id) which was dropped in 00002
-- 2. Create beneficiaries table (PRD Section 36 requirement)
--
-- This migration is SAFE to run on existing production data.

-- ═══ Fix 1: Orphaned FK references ═══
-- Drop the orphaned FK constraints
ALTER TABLE public.notification_preferences 
  DROP CONSTRAINT IF EXISTS notification_preferences_user_id_fkey;
ALTER TABLE public.scheduled_reports
  DROP CONSTRAINT IF EXISTS scheduled_reports_user_id_fkey;

-- Re-add with correct reference to auth.users(id)
ALTER TABLE public.notification_preferences
  ADD CONSTRAINT notification_preferences_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.scheduled_reports
  ADD CONSTRAINT scheduled_reports_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ═══ Fix 2: Create beneficiaries table ═══
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

-- Unique constraint: one beneficiary per (customer, account_number, bank_code)
CREATE UNIQUE INDEX IF NOT EXISTS beneficiaries_customer_account_bank_uniq
  ON public.beneficiaries(customer_id, account_number, bank_code);

-- Enable RLS
ALTER TABLE public.beneficiaries ENABLE ROW LEVEL SECURITY;

-- RLS policies
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

-- Staff can read all beneficiaries
CREATE POLICY beneficiaries_read_staff ON public.beneficiaries
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.staff_users su
    WHERE su.auth_id = auth.uid() AND su.is_active = true
  ));

-- Grant access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.beneficiaries TO authenticated;

-- Auto-update updated_at
CREATE OR REPLACE TRIGGER beneficiaries_updated_at
  BEFORE UPDATE ON public.beneficiaries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Comment
COMMENT ON TABLE public.beneficiaries IS 'Saved beneficiary accounts for customer transfers. PRD Section 36.';
