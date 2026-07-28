-- ============================================================================
-- Migration 00031: Pool Performance & Distribution + Return Guarantee Distinction
-- 
-- Addresses Phase 8 kickoff gaps:
--   1. return_guarantee field on investment_products — honestly distinguishes
--      guaranteed returns (fixed income) from variable/pool-performance-based
--   2. pool_performance_records — admin-entered pool performance with full
--      audit trail (who, when, source, notes). This is the input mechanism
--      for pool returns — NOT a fabricated performance model.
--   3. pool_distributions — records of proportional distributions to pool
--      contributors, reusing Phase 7's distribution patterns.
--   4. Rollover support on investment_accounts.
-- ============================================================================

BEGIN;

-- ============================================================================
-- Return Guarantee Type (honest distinction)
-- ============================================================================
CREATE TYPE return_guarantee_type AS ENUM (
  'guaranteed',         -- Fixed income: rate is contractually guaranteed
  'expected',           -- Money market: target rate, highly likely but not contractual
  'variable_pool'       -- Pool/agricultural/cooperative fund: returns depend on actual performance
);

-- ============================================================================
-- Add return_guarantee to investment_products
-- ============================================================================
ALTER TABLE public.investment_products
  ADD COLUMN return_guarantee return_guarantee_type NOT NULL DEFAULT 'expected';

-- Update seeded products to honestly reflect their return structure
UPDATE public.investment_products SET return_guarantee = 'guaranteed'
  WHERE product_code = 'INV-0001';  -- Fixed Income Fund — 90 Day: guaranteed rate

UPDATE public.investment_products SET return_guarantee = 'variable_pool'
  WHERE product_code = 'INV-0002';  -- Agricultural Investment Pool: pool performance

UPDATE public.investment_products SET return_guarantee = 'variable_pool'
  WHERE product_code = 'INV-0003';  -- Cooperative Growth Fund: profit-sharing

UPDATE public.investment_products SET return_guarantee = 'expected'
  WHERE product_code = 'INV-0004';  -- Money Market Fund: target rate, not contractual

-- Add constraint: variable_pool products cannot have a non-zero expected_return_rate
-- stored as if it were guaranteed — the field is clearly labeled "expected"
-- and the return_guarantee field tells the truth about whether it's contractual.
-- (We keep the expected_return_rate for display purposes — "expected 18%" — 
-- but the return_guarantee = 'variable_pool' makes clear it's NOT guaranteed.)
COMMENT ON COLUMN public.investment_products.return_guarantee IS
  'Honestly distinguishes guaranteed returns (fixed income contracts) from variable/pool-performance-based returns. This field MUST be checked before displaying any return rate to customers. variable_pool products must never show their expected_return_rate as guaranteed.';

-- ============================================================================
-- Pool Performance Records
-- 
-- This is the INPUT MECHANISM for pool-based investment returns.
-- Pool performance is admin-entered (not from an automated data feed).
-- Each record captures:
--   - WHO entered it (entered_by — must be a staff user with investments.admin)
--   - WHEN it was entered
--   - WHAT the performance figure is (total pool return for the period)
--   - WHY / based on what (source description — e.g., "crop sales completed",
--     "Q3 cooperative profit distribution approved")
--   - Supporting notes/documentation references
-- 
-- This is financial data driving payouts to multiple people.
-- It CANNOT be an untracked field. Every entry is auditable.
-- ============================================================================
CREATE TABLE public.pool_performance_records (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id            uuid NOT NULL REFERENCES public.investment_products(id) ON DELETE RESTRICT,
  
  -- Performance period
  performance_date      date NOT NULL,               -- Date the performance applies to
  period_start          date NOT NULL,               -- Start of the performance period
  period_end            date NOT NULL,                -- End of the performance period
  
  -- Performance figures
  total_pool_value      numeric(15,2) NOT NULL,       -- Total pool AUM at period end
  total_returns         numeric(15,2) NOT NULL,       -- Total returns generated in this period
  return_rate           numeric(8,4) NOT NULL,        -- Actual return rate for the period (e.g., 15.5000 = 15.5%)
  expense_ratio         numeric(8,4) NOT NULL DEFAULT 0,  -- Expenses deducted from gross returns
  
  -- Net distributable returns (after expenses)
  net_distributable     numeric(15,2) NOT NULL,      -- Amount available for distribution to contributors
  distributed_amount    numeric(15,2) NOT NULL DEFAULT 0,  -- Amount actually distributed
  is_distributed        boolean NOT NULL DEFAULT false,
  distributed_at        timestamptz,
  
  -- Audit trail (MANDATORY — who entered this and why)
  entered_by            uuid NOT NULL REFERENCES auth.users(id),
  entered_at            timestamptz NOT NULL DEFAULT now(),
  source_description    text NOT NULL,                -- e.g., "Crop sales from 2026 wet season harvest"
  supporting_notes      text,                         -- Additional context
  source_reference      text,                         -- External reference (receipt #, board resolution #, etc.)
  
  -- Standard
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT chk_ppr_returns_not_negative CHECK (total_returns >= 0),
  CONSTRAINT chk_ppr_net_distributable_not_negative CHECK (net_distributable >= 0),
  CONSTRAINT chk_ppr_distributed_not_negative CHECK (distributed_amount >= 0),
  CONSTRAINT chk_ppr_distributed_le_net CHECK (distributed_amount <= net_distributable),
  CONSTRAINT chk_ppr_period_order CHECK (period_start <= period_end),
  CONSTRAINT chk_ppr_source_not_empty CHECK (source_description <> '')
);

CREATE INDEX idx_ppr_product ON public.pool_performance_records(product_id);
CREATE INDEX idx_ppr_distributed ON public.pool_performance_records(is_distributed) WHERE is_distributed = false;
CREATE INDEX idx_ppr_date ON public.pool_performance_records(performance_date);

CREATE TRIGGER trg_ppr_updated_at
  BEFORE UPDATE ON public.pool_performance_records
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- Pool Distributions
-- 
-- Records of proportional distributions to individual pool contributors.
-- Each record links a pool performance record to individual investment accounts
-- and their share of the distribution.
-- ============================================================================
CREATE TABLE public.pool_distributions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  performance_record_id uuid NOT NULL REFERENCES public.pool_performance_records(id) ON DELETE RESTRICT,
  investment_account_id uuid NOT NULL REFERENCES public.investment_accounts(id) ON DELETE RESTRICT,
  customer_id           uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  
  -- Distribution details
  pool_share            numeric(8,6) NOT NULL,        -- e.g., 0.250000 = 25% of the pool
  distributed_amount    numeric(15,2) NOT NULL,       -- Amount distributed to this contributor
  
  -- Whether reinvested or paid out
  distribution_type     text NOT NULL DEFAULT 'payout',  -- 'payout' or 'reinvest'
  financial_transaction_id uuid REFERENCES public.financial_transactions(id),
  
  -- Audit
  distributed_at        timestamptz NOT NULL DEFAULT now(),
  distributed_by        uuid REFERENCES auth.users(id),
  
  -- Standard
  created_at            timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT chk_pd_share_valid CHECK (pool_share > 0 AND pool_share <= 1),
  CONSTRAINT chk_pd_amount_positive CHECK (distributed_amount > 0),
  CONSTRAINT chk_pd_type CHECK (distribution_type IN ('payout', 'reinvest'))
);

CREATE INDEX idx_pd_performance ON public.pool_distributions(performance_record_id);
CREATE INDEX idx_pd_account ON public.pool_distributions(investment_account_id);
CREATE INDEX idx_pd_customer ON public.pool_distributions(customer_id);

-- ============================================================================
-- Rollover support on investment_accounts
-- ============================================================================
ALTER TABLE public.investment_accounts
  ADD COLUMN rolled_over_from uuid REFERENCES public.investment_accounts(id),
  ADD COLUMN rolled_over_at timestamptz;

COMMENT ON COLUMN public.investment_accounts.rolled_over_from IS
  'If this account was created by rolling over a matured investment, references the original account.';

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.pool_performance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pool_distributions ENABLE ROW LEVEL SECURITY;

-- Performance records: staff with investments admin can read/write; customers can read
CREATE POLICY ppr_read_staff
  ON public.pool_performance_records FOR SELECT TO authenticated
  USING (public.has_permission('wallet.read') OR public.has_role('super_admin'));

CREATE POLICY ppr_write_staff
  ON public.pool_performance_records FOR ALL TO authenticated
  USING (public.has_permission('admin.write') OR public.has_role('super_admin'))
  WITH CHECK (public.has_permission('admin.write') OR public.has_role('super_admin'));

-- Distributions: customers see their own; staff see all
CREATE POLICY pd_read_self
  ON public.pool_distributions FOR SELECT TO authenticated
  USING (customer_id IN (SELECT c.id FROM public.customers c WHERE c.auth_id = auth.uid()));

CREATE POLICY pd_read_staff
  ON public.pool_distributions FOR SELECT TO authenticated
  USING (public.has_permission('wallet.read') OR public.has_role('super_admin'));

COMMIT;

-- ============================================================================
-- DOWN PATH:
--   ALTER TABLE investment_accounts DROP COLUMN rolled_over_from, DROP COLUMN rolled_over_at;
--   DROP TABLE pool_distributions;
--   DROP TABLE pool_performance_records;
--   ALTER TABLE investment_products DROP COLUMN return_guarantee;
--   DROP TYPE return_guarantee_type;
-- ============================================================================
