-- ============================================================================
-- Migration 00022: Loan Eligibility Decisions
-- 
-- Every eligibility decision (automated or admin-overridden) is logged with
-- its full rationale — which factors were checked, their values, thresholds,
-- and whether they passed. No silent approvals or denials.
-- ============================================================================

BEGIN;

CREATE TYPE eligibility_decision AS ENUM (
  'approved',
  'denied',
  'amount_adjusted'    -- Approved but at a lower amount than requested
);

CREATE TYPE eligibility_source AS ENUM (
  'automated',
  'admin_override'
);

CREATE TABLE public.loan_eligibility_decisions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id               uuid REFERENCES public.loans(id) ON DELETE SET NULL,
  customer_id           uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  product_id            uuid NOT NULL REFERENCES public.loan_products(id) ON DELETE RESTRICT,
  
  -- Decision
  decision              eligibility_decision NOT NULL,
  source                eligibility_source NOT NULL DEFAULT 'automated',
  requested_amount      numeric(15,2) NOT NULL,
  approved_amount       numeric(15,2) NOT NULL DEFAULT 0,
  
  -- Structured rationale (the audit trail)
  -- JSON array of: { factor, value, threshold, passed, weight, contribution }
  factors               jsonb NOT NULL DEFAULT '[]'::jsonb,
  
  -- Computed scores at time of decision
  credit_score          integer,
  savings_balance       numeric(15,2),
  max_eligible_amount   numeric(15,2),
  
  -- Admin override
  override_reason       text,
  override_by           uuid REFERENCES auth.users(id),
  
  -- Cooperative participation status
  cooperative_status    text NOT NULL DEFAULT 'not_available', -- not_available, verified, not_member
  
  -- Standard
  decided_at            timestamptz NOT NULL DEFAULT now(),
  created_at            timestamptz NOT NULL DEFAULT now(),
  metadata              jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_led_customer ON public.loan_eligibility_decisions(customer_id);
CREATE INDEX idx_led_product ON public.loan_eligibility_decisions(product_id);
CREATE INDEX idx_led_loan ON public.loan_eligibility_decisions(loan_id) WHERE loan_id IS NOT NULL;
CREATE INDEX idx_led_decision ON public.loan_eligibility_decisions(decision);
CREATE INDEX idx_led_created_at ON public.loan_eligibility_decisions(created_at);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.loan_eligibility_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY led_read_self
  ON public.loan_eligibility_decisions FOR SELECT
  TO authenticated
  USING (
    customer_id IN (SELECT c.id FROM public.customers c WHERE c.auth_id = auth.uid())
  );

CREATE POLICY led_read_staff
  ON public.loan_eligibility_decisions FOR SELECT
  TO authenticated
  USING (public.has_permission('wallet.read') OR public.has_role('super_admin'));

COMMIT;
