-- ============================================================================
-- Migration 00016: Savings Products (Product Configuration)
-- 
-- Admin-configurable product definitions. All product parameters (interest
-- rates, min balances, withdrawal rules, penalties) live here — no code
-- deploy required to launch a new product variant.
-- 
-- Config changes do NOT retroactively affect existing accounts:
--   savings_accounts references the product config at time of opening
--   (via product_id + a snapshot of the key terms in metadata).
-- ============================================================================

BEGIN;

-- Product types
CREATE TYPE savings_product_type AS ENUM (
  'flexible',           -- Flexible Savings — deposit/withdraw anytime
  'fixed_deposit',      -- Fixed Deposit — locked for a term, higher interest
  'target',             -- Target Savings — save toward a goal, restricted withdrawals
  'business',           -- Business Savings — for SMEs, higher minimums
  'cooperative',        -- Cooperative Savings — group pool
  'group',              -- Group Savings (basic pool — governance in Phase 7)
  'esusu'               -- Esusu (basic rotational — governance in Phase 7)
);

-- Interest calculation method
CREATE TYPE interest_method AS ENUM (
  'flat',               -- Simple interest: principal × rate × time
  'compound',           -- Compound interest: principal × (1 + rate)^periods - principal
  'tiered'              -- Tiered rates by balance (future — config in interest_tiers JSONB)
);

-- Interest accrual cadence
CREATE TYPE interest_cadence AS ENUM (
  'daily',              -- Accrue daily
  'monthly',            -- Accrue monthly
  'maturity'            -- Accrue only at maturity (fixed deposit)
);

CREATE TABLE public.savings_products (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_code         text NOT NULL UNIQUE,           -- e.g., 'FLEX', 'FD-90', 'TARGET'
  product_name         text NOT NULL,
  product_type        savings_product_type NOT NULL,
  description         text,
  
  -- Interest configuration
  interest_method      interest_method NOT NULL DEFAULT 'flat',
  interest_rate        numeric(8,4) NOT NULL DEFAULT 0, -- Annual rate (e.g., 5.0000 = 5%)
  interest_cadence     interest_cadence NOT NULL DEFAULT 'daily',
  
  -- Tiered interest config (for future — stored as JSONB array of {min_balance, rate})
  interest_tiers       jsonb NOT NULL DEFAULT '[]'::jsonb,
  
  -- Balance rules
  minimum_balance      numeric(15,2) NOT NULL DEFAULT 0,
  minimum_deposit      numeric(15,2) NOT NULL DEFAULT 100,  -- Min per deposit
  maximum_deposit      numeric(15,2),                        -- Null = no limit
  
  -- Withdrawal rules
  withdrawal_allowed   boolean NOT NULL DEFAULT true,
  lock_period_days     integer NOT NULL DEFAULT 0,           -- 0 = no lock (flexible)
  max_withdrawals_per_month integer,                          -- Null = unlimited
  early_withdrawal_penalty_rate numeric(5,2) NOT NULL DEFAULT 0, -- % penalty on early withdrawal
  early_withdrawal_allowed boolean NOT NULL DEFAULT true,
  
  -- Term (for fixed deposits)
  term_days            integer,                              -- Null = no fixed term
  
  -- Group/Esusu-specific (basic — governance in Phase 7)
  min_group_size       integer,                              -- For group/esusu products
  max_group_size       integer,
  contribution_frequency text,                               -- 'daily', 'weekly', 'monthly'
  
  -- Eligibility
  min_kyc_level        text NOT NULL DEFAULT 'L1',           -- Minimum KYC tier required
  min_tenure_months    integer NOT NULL DEFAULT 0,            -- Min membership tenure
  
  -- Status
  is_active            boolean NOT NULL DEFAULT true,
  is_featured          boolean NOT NULL DEFAULT false,
  
  -- Metadata
  metadata             jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  -- Tracing
  correlation_id       uuid NOT NULL DEFAULT gen_random_uuid(),
  
  -- Standard
  version              integer NOT NULL DEFAULT 1,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  created_by           uuid REFERENCES auth.users(id),
  updated_by           uuid REFERENCES auth.users(id),
  
  CONSTRAINT chk_sp_rate_positive CHECK (interest_rate >= 0),
  CONSTRAINT chk_sp_min_deposit_positive CHECK (minimum_deposit > 0),
  CONSTRAINT chk_sp_version_positive CHECK (version > 0),
  CONSTRAINT chk_sp_code_not_empty CHECK (product_code <> ''),
  CONSTRAINT chk_sp_name_not_empty CHECK (product_name <> '')
);

CREATE INDEX idx_sp_type ON public.savings_products(product_type);
CREATE INDEX idx_sp_active ON public.savings_products(is_active) WHERE is_active = true;
CREATE INDEX idx_sp_featured ON public.savings_products(is_featured) WHERE is_featured = true;

-- ============================================================================
-- Seed: 3 Concrete Products
-- ============================================================================

INSERT INTO public.savings_products (
  product_code, product_name, product_type, description,
  interest_method, interest_rate, interest_cadence,
  minimum_balance, minimum_deposit, maximum_deposit,
  withdrawal_allowed, lock_period_days, early_withdrawal_penalty_rate, early_withdrawal_allowed,
  is_active, is_featured, metadata
) VALUES
  -- 1. Flexible Savings — deposit/withdraw anytime, low interest
  (
    'FLEX', 'Flexible Savings', 'flexible',
    'Save at your own pace. Deposit and withdraw anytime. Earn daily interest on your balance.',
    'compound', 4.0000, 'daily',
    0, 100, NULL,                         -- No minimum balance, min ₦100 deposit, no max
    true, 0, 0, true,                      -- Withdrawals allowed, no lock, no penalty
    true, true,
    '{"badge": "Popular", "color": "#10B981"}'
  ),
  -- 2. Fixed Deposit — 90-day lock, higher interest, penalty for early withdrawal
  (
    'FD-90', 'Fixed Deposit (90 Days)', 'fixed_deposit',
    'Lock your money for 90 days and earn a higher interest rate. Early withdrawal incurs a penalty.',
    'flat', 12.0000, 'maturity',
    5000, 5000, 10000000,                   -- Min ₦5,000 balance, min ₦5,000 deposit, max ₦10M
    true, 90, 2.00, true,                   -- Withdrawals allowed (with penalty), 90-day lock, 2% penalty
    true, true,
    '{"badge": "High Yield", "color": "#3B82F6", "term_label": "90 days"}'
  ),
  -- 3. Esusu (Basic) — group contribution pool, governance in Phase 7
  (
    'ESUSU-BASIC', 'Esusu Savings (Basic)', 'esusu',
    'Contribute to a shared savings pool with your group. Basic contribution mechanics — full governance coming soon.',
    'flat', 0.0000, 'maturity',
    0, 100, NULL,                            -- No minimum balance, min ₦100 per contribution
    false, 30, 0, false,                     -- No withdrawals during cycle, 30-day lock, no early withdrawal
    true, true,
    '{"badge": "Group", "color": "#F59E0B", "min_group_size": 2, "max_group_size": 10, "contribution_frequency": "daily"}'
  );

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
-- Products are readable by all authenticated users (customers browse products).
-- Only staff with admin permissions can create/edit products.

ALTER TABLE public.savings_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY sp_read_all
  ON public.savings_products FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY sp_read_staff_all
  ON public.savings_products FOR SELECT
  TO authenticated
  USING (public.has_permission('admin.read') OR public.has_role('super_admin'));

COMMIT;
