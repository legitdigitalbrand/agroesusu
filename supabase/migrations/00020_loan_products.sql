-- ============================================================================
-- Migration 00020: Loan Products (Product Configuration)
-- 
-- Admin-configurable loan product definitions. All loan parameters (interest
-- rates, savings multipliers, tenure thresholds, penalties) live here.
-- Follows the same configuration-over-code pattern as savings_products.
-- ============================================================================

BEGIN;

CREATE TYPE loan_product_type AS ENUM (
  'salary',         -- Salary Loan — repaid via monthly installments
  'sme',            -- SME Loan — for small businesses
  'agricultural'    -- Agricultural Loan — seasonal, aligned with harvest cycles
);

CREATE TYPE loan_interest_method AS ENUM (
  'flat',               -- Interest = principal × rate × term (simple)
  'reducing_balance'    -- Interest on outstanding balance (amortized)
);

CREATE TABLE public.loan_products (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_code           text NOT NULL UNIQUE,
  product_name           text NOT NULL,
  product_type          loan_product_type NOT NULL,
  description           text,
  
  -- Interest configuration
  interest_method        loan_interest_method NOT NULL DEFAULT 'flat',
  interest_rate          numeric(8,4) NOT NULL,        -- Annual rate (e.g., 15.0000 = 15%)
  
  -- Term options (configurable)
  min_term_months        integer NOT NULL DEFAULT 1,
  max_term_months        integer NOT NULL DEFAULT 12,
  default_term_months    integer NOT NULL DEFAULT 3,
  
  -- Savings-First eligibility rules
  savings_multiplier     numeric(5,2) NOT NULL DEFAULT 3.00,  -- Max loan = multiplier × savings balance
  min_savings_tenure_days integer NOT NULL DEFAULT 90,          -- Must have saved for at least N days
  min_consistency_score  integer NOT NULL DEFAULT 50,          -- 0-100, from savings_history_signals
  min_stability_score    integer NOT NULL DEFAULT 40,          -- 0-100, from savings_history_signals
  min_credit_score       integer NOT NULL DEFAULT 500,         -- Internal credit score (300-850)
  
  -- Amount limits
  min_amount             numeric(15,2) NOT NULL DEFAULT 5000,
  max_amount             numeric(15,2),                          -- Null = no hard cap (savings multiplier is the cap)
  
  -- Fees
  origination_fee_rate   numeric(5,2) NOT NULL DEFAULT 0,     -- % of loan amount
  processing_fee         numeric(15,2) NOT NULL DEFAULT 0,    -- Flat fee
  
  -- Late payment penalties
  late_payment_penalty_rate numeric(5,2) NOT NULL DEFAULT 0,  -- % of installment per week late
  grace_period_days      integer NOT NULL DEFAULT 0,          -- Days after due date before penalty applies
  
  -- Default rules
  max_missed_installments integer NOT NULL DEFAULT 3,          -- N consecutive missed → defaulted
  
  -- Cooperative participation requirement (Phase 7 will supply this)
  requires_cooperative_membership boolean NOT NULL DEFAULT false,
  
  -- Eligibility
  min_kyc_level          text NOT NULL DEFAULT 'L2',
  
  -- Status
  is_active              boolean NOT NULL DEFAULT true,
  is_featured            boolean NOT NULL DEFAULT false,
  
  -- Metadata
  metadata               jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  -- Standard
  version                integer NOT NULL DEFAULT 1,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  created_by             uuid REFERENCES auth.users(id),
  updated_by             uuid REFERENCES auth.users(id),
  
  CONSTRAINT chk_lp_rate_positive CHECK (interest_rate >= 0),
  CONSTRAINT chk_lp_multiplier_positive CHECK (savings_multiplier > 0),
  CONSTRAINT chk_lp_min_amount_positive CHECK (min_amount > 0),
  CONSTRAINT chk_lp_version_positive CHECK (version > 0)
);

CREATE INDEX idx_lp_type ON public.loan_products(product_type);
CREATE INDEX idx_lp_active ON public.loan_products(is_active) WHERE is_active = true;

-- ============================================================================
-- Seed: 2 Concrete Products
-- ============================================================================

INSERT INTO public.loan_products (
  product_code, product_name, product_type, description,
  interest_method, interest_rate,
  min_term_months, max_term_months, default_term_months,
  savings_multiplier, min_savings_tenure_days,
  min_consistency_score, min_stability_score, min_credit_score,
  min_amount, max_amount,
  origination_fee_rate, processing_fee,
  late_payment_penalty_rate, grace_period_days,
  max_missed_installments, requires_cooperative_membership,
  min_kyc_level, is_active, is_featured, metadata
) VALUES
  -- 1. Salary Loan — 3-6 months, 15% flat, 3x savings multiplier
  (
    'SAL', 'Salary Loan', 'salary',
    'Short-term salary-backed loan. Repay in 3-6 monthly installments. Requires consistent savings history.',
    'flat', 15.0000,
    3, 6, 3,
    3.00, 90,
    50, 40, 500,
    5000, 500000,
    1.00, 500,    -- 1% origination fee + ₦500 processing
    2.00, 3,      -- 2% penalty per week late, 3-day grace
    3, false,     -- 3 missed → defaulted, no cooperative requirement
    'L2', true, true,
    '{"badge": "Popular", "color": "#10B981", "repayment_frequency": "monthly"}'
  ),
  -- 2. Agricultural Loan — 6-12 months, 18% reducing balance, aligned with harvest
  (
    'AGR', 'Agricultural Loan', 'agricultural',
    'Seasonal agricultural loan with reducing balance interest. Aligned with harvest cycles. Requires 6 months savings tenure.',
    'reducing_balance', 18.0000,
    6, 12, 6,
    2.50, 180,    -- Lower multiplier (2.5x), longer tenure required (180 days)
    60, 50, 550,  -- Higher thresholds for agri loans
    10000, 2000000,
    1.50, 1000,   -- 1.5% origination + ₦1,000 processing
    1.50, 7,      -- 1.5% penalty per week, 7-day grace (agricultural grace)
    3, true,      -- Requires cooperative membership
    'L3', true, true,
    '{"badge": "Agricultural", "color": "#F59E0B", "repayment_frequency": "monthly", "seasonal": true}'
  );

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.loan_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY lp_read_all
  ON public.loan_products FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY lp_read_staff_all
  ON public.loan_products FOR SELECT
  TO authenticated
  USING (public.has_permission('admin.read') OR public.has_role('super_admin'));

COMMIT;
