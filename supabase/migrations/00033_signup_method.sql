-- ════════════════════════════════════════════════════════════
-- Agriqcap — Add signup_method column to customers table
--
-- Tracks whether a customer registered via manual form or Google OAuth.
-- Used for audit/compliance purposes (Phase 1 KYC requirements).
-- Does NOT change downstream logic — all customers follow the same
-- onboarding and verification path regardless of signup method.
-- ════════════════════════════════════════════════════════════

-- Add signup_method enum type
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'signup_method') THEN
    CREATE TYPE public.signup_method AS ENUM ('manual', 'google');
  END IF;
END
$$;

-- Add column to customers table
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS signup_method public.signup_method NOT NULL DEFAULT 'manual';

-- Add comment for documentation
COMMENT ON COLUMN public.customers.signup_method IS
  'How the customer registered: manual (email/password form) or google (Google OAuth). Used for audit/compliance. Does not affect downstream logic.';

-- Update existing customer records to 'manual' (they all signed up via the form)
UPDATE public.customers
  SET signup_method = 'manual'
  WHERE signup_method IS NULL OR signup_method = 'manual';
