-- ============================================================================
-- Migration 00023: Customer Risk Profiles
-- 
-- Tracks customer risk information for the eligibility engine's feedback
-- loop. When a loan defaults, the risk profile is updated, which affects
-- future loan eligibility decisions.
-- ============================================================================

BEGIN;

CREATE TYPE risk_level AS ENUM (
  'low',       -- No defaults, good repayment history
  'medium',    -- Late payments but no defaults
  'high',      -- One or more defaults
  'restricted' -- Multiple defaults — cannot apply for new loans
);

CREATE TABLE public.customer_risk_profiles (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id             uuid NOT NULL UNIQUE REFERENCES public.customers(id) ON DELETE RESTRICT,
  
  -- Risk assessment
  risk_level              risk_level NOT NULL DEFAULT 'low',
  internal_credit_score   integer NOT NULL DEFAULT 500,   -- 300-850 range
  
  -- Loan history
  total_loans             integer NOT NULL DEFAULT 0,
  active_loans            integer NOT NULL DEFAULT 0,
  defaulted_loans         integer NOT NULL DEFAULT 0,
  closed_loans            integer NOT NULL DEFAULT 0,
  
  -- Repayment behavior
  total_repayments        integer NOT NULL DEFAULT 0,
  on_time_repayments      integer NOT NULL DEFAULT 0,
  late_repayments         integer NOT NULL DEFAULT 0,
  total_penalty_paid     numeric(15,2) NOT NULL DEFAULT 0,
  
  -- Last default
  last_default_date       timestamptz,
  last_default_loan_id    uuid REFERENCES public.loans(id),
  
  -- Metadata
  metadata                jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes                   text,
  
  -- Standard
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT chk_crp_score_range CHECK (internal_credit_score >= 300 AND internal_credit_score <= 850)
);

CREATE INDEX idx_crp_customer ON public.customer_risk_profiles(customer_id);
CREATE INDEX idx_crp_risk_level ON public.customer_risk_profiles(risk_level);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.customer_risk_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY crp_read_self
  ON public.customer_risk_profiles FOR SELECT
  TO authenticated
  USING (
    customer_id IN (SELECT c.id FROM public.customers c WHERE c.auth_id = auth.uid())
  );

CREATE POLICY crp_read_staff
  ON public.customer_risk_profiles FOR SELECT
  TO authenticated
  USING (public.has_permission('wallet.read') OR public.has_role('super_admin'));

COMMIT;
