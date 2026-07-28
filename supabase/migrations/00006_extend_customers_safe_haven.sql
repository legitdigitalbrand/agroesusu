-- ============================================================================
-- Migration 00006: Extend Customers with Safe Haven + Verification Fields
-- 
-- Extends the customers table (from migration 00004) with:
--   - Safe Haven customer reference (external ID, never overwrites our identity)
--   - Identity verification tracking (BVN/NIN OTP-based flow per Safe Haven API)
--   - Verification status fields for KYC lifecycle
--
-- Design note (Volume 05 Part 5.3): The Customer Domain owns identity.
-- Safe Haven's customer ID is a reference, not our identity source.
-- We never overwrite our own identity fields with Safe Haven's data.
--
-- DOWN PATH: ALTER TABLE customers DROP COLUMN ... (reverse order)
-- ============================================================================

BEGIN;

-- Safe Haven customer reference
ALTER TABLE public.customers 
  ADD COLUMN safe_haven_customer_id text,
  ADD COLUMN safe_haven_customer_id_set_at timestamptz;

-- Identity verification tracking (Safe Haven OTP-based flow)
ALTER TABLE public.customers
  ADD COLUMN identity_verification_id text,              -- Safe Haven's identityId from Initiate step
  ADD COLUMN identity_type text CHECK (identity_type IN ('BVN', 'NIN')),
  ADD COLUMN identity_verification_status text NOT NULL DEFAULT 'not_started'
    CHECK (identity_verification_status IN (
      'not_started',         -- No verification initiated
      'initiate_pending',    -- Initiate call in progress
      'otp_sent',            -- OTP sent to customer's phone (Initiate succeeded)
      'validate_pending',    -- Validate call in progress
      'verified',            -- Successfully verified
      'rejected',            -- Verification failed
      'expired'              -- Verification expired (OTP timeout)
    )),
  ADD COLUMN identity_verified_at timestamptz,
  ADD COLUMN identity_verification_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN identity_rejection_reason text;

-- Indexes for verification queries
CREATE INDEX idx_customers_sh_customer_id ON public.customers(safe_haven_customer_id) WHERE safe_haven_customer_id IS NOT NULL;
CREATE INDEX idx_customers_identity_status ON public.customers(identity_verification_status);
CREATE INDEX idx_customers_identity_verification_id ON public.customers(identity_verification_id) WHERE identity_verification_id IS NOT NULL;

-- Add audit trigger for identity verification status changes
CREATE OR REPLACE FUNCTION public.audit_customer_identity_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only audit when verification status changes
  IF (TG_OP = 'UPDATE' AND OLD.identity_verification_status IS DISTINCT FROM NEW.identity_verification_status) THEN
    INSERT INTO public.audit_log (
      actor_id, actor_type, action, action_category,
      entity_type, entity_id,
      before_state, after_state,
      correlation_id, result, metadata
    ) VALUES (
      COALESCE(NEW.updated_by, auth.uid()),
      CASE 
        WHEN public.is_staff() THEN 'staff'::audit_actor_type
        ELSE 'customer'::audit_actor_type
      END,
      'customer.identity_status_changed',
      'identity',
      'customer',
      NEW.id,
      jsonb_build_object('status', OLD.identity_verification_status),
      jsonb_build_object('status', NEW.identity_verification_status, 'type', NEW.identity_type),
      gen_random_uuid(),
      'success'::audit_result,
      jsonb_build_object('customer_number', NEW.customer_number, 'attempts', NEW.identity_verification_attempts)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_customers_identity_audit
  AFTER UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.audit_customer_identity_change();

COMMIT;

-- ============================================================================
-- DOWN PATH:
--   DROP TRIGGER trg_customers_identity_audit ON customers;
--   DROP FUNCTION audit_customer_identity_change();
--   ALTER TABLE customers 
--     DROP COLUMN safe_haven_customer_id,
--     DROP COLUMN safe_haven_customer_id_set_at,
--     DROP COLUMN identity_verification_id,
--     DROP COLUMN identity_type,
--     DROP COLUMN identity_verification_status,
--     DROP COLUMN identity_verified_at,
--     DROP COLUMN identity_verification_attempts,
--     DROP COLUMN identity_rejection_reason;
-- ============================================================================
