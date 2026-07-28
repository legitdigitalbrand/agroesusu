-- ============================================================================
-- Migration 00029: Investment Products & Accounts
-- 
-- Investment & Wealth Management Domain (Volume 04 Part 4.10).
-- 
-- Key principles:
--   - Investments are DISTINCT from savings (separate module, shared infrastructure)
--   - All subscriptions/redemptions go through the Orchestrator
--   - Mandatory, permanently stored digital risk disclosure acceptance BEFORE subscription
--   - Products are admin-configurable (no hardcoded business rules)
--   - Unitized investments: each product has a NAV (net asset value) per unit
--   - Agricultural Investment Pools and Cooperative Growth Funds reuse the pool pattern
-- 
-- DOWN PATH: See end of file
-- ============================================================================

BEGIN;

-- ============================================================================
-- Investment Products (admin-configurable)
-- ============================================================================
CREATE TYPE investment_type AS ENUM (
  'fixed_income',      -- Fixed return, defined tenure (e.g., 90-day treasury bill equivalent)
  'unitized',           -- Unitized fund, NAV fluctuates (e.g., agricultural pool)
  'cooperative_fund',   -- Cooperative growth fund, profit-sharing
  'money_market',       -- Short-term, low-risk liquid fund
  'agricultural_pool'   -- Agricultural investment pool (crop cycles, livestock, etc.)
);

CREATE TYPE investment_status AS ENUM (
  'pending',            -- Account created, awaiting activation/funding
  'active',             -- Invested, accruing returns
  'matured',            -- Tenure ended, awaiting redemption
  'redeemed',           -- Fully redeemed
  'closed',             -- Closed (early exit, admin action)
  'suspended'           -- Temporarily suspended (admin action)
);

CREATE TYPE product_status AS ENUM (
  'draft',
  'active',
  'suspended',
  'retired'
);

CREATE TABLE public.investment_products (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_code          text NOT NULL UNIQUE,
  product_name          text NOT NULL,
  investment_type       investment_type NOT NULL,
  description           text,

  -- Financial terms
  expected_return_rate  numeric(8,4) NOT NULL,      -- Expected annual return (e.g., 12.5000 = 12.5%)
  return_type           text NOT NULL DEFAULT 'flat', -- 'flat' or 'compound'
  min_investment        numeric(15,2) NOT NULL DEFAULT 1000,
  max_investment        numeric(15,2),                -- NULL = no max
  min_tenure_days       integer NOT NULL DEFAULT 30,
  max_tenure_days       integer,                     -- NULL = no max (open-ended)
  nav_per_unit          numeric(15,4),               -- For unitized: initial NAV per unit
  total_units_available numeric(18,4),               -- For unitized: total units issued
  units_issued          numeric(18,4) NOT NULL DEFAULT 0,

  -- Risk
  risk_level            text NOT NULL DEFAULT 'moderate', -- 'low', 'moderate', 'high', 'very_high'
  risk_score            integer NOT NULL DEFAULT 5,    -- 1-10 scale

  -- Fees
  management_fee_rate   numeric(8,4) NOT NULL DEFAULT 0,  -- Annual % charged on AUM
  early_exit_fee_rate   numeric(8,4) NOT NULL DEFAULT 0,  -- % charged on early redemption
  early_exit_lock_days  integer NOT NULL DEFAULT 0,      -- Days before early exit allowed (0 = immediate)

  -- Features
  allows_early_redemption boolean NOT NULL DEFAULT true,
  allows_partial_redemption boolean NOT NULL DEFAULT true,
  allows_top_up          boolean NOT NULL DEFAULT false,
  auto_reinvest          boolean NOT NULL DEFAULT false,
  cooperative_required   boolean NOT NULL DEFAULT false, -- Requires cooperative membership

  -- Risk disclosure (mandatory per standing instructions)
  risk_disclosure_text   text NOT NULL,              -- Full risk disclosure text
  risk_disclosure_version text NOT NULL DEFAULT '1.0', -- Version for tracking changes

  -- Admin
  is_active             boolean NOT NULL DEFAULT true,
  status                product_status NOT NULL DEFAULT 'draft',
  config                jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Standard
  version               integer NOT NULL DEFAULT 1,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  created_by            uuid REFERENCES auth.users(id),
  updated_by            uuid REFERENCES auth.users(id),

  CONSTRAINT chk_ip_name_not_empty CHECK (product_name <> ''),
  CONSTRAINT chk_ip_return_positive CHECK (expected_return_rate >= 0),
  CONSTRAINT chk_ip_min_positive CHECK (min_investment > 0),
  CONSTRAINT chk_ip_risk_level CHECK (risk_level IN ('low', 'moderate', 'high', 'very_high')),
  CONSTRAINT chk_ip_risk_score CHECK (risk_score >= 1 AND risk_score <= 10),
  CONSTRAINT chk_ip_version_positive CHECK (version > 0),
  CONSTRAINT chk_ip_disclosure_not_empty CHECK (risk_disclosure_text <> '')
);

CREATE INDEX idx_ip_type ON public.investment_products(investment_type);
CREATE INDEX idx_ip_active ON public.investment_products(is_active) WHERE is_active = true;
CREATE INDEX idx_ip_status ON public.investment_products(status);

CREATE SEQUENCE IF NOT EXISTS public.investment_product_ref_seq;

CREATE OR REPLACE FUNCTION public.generate_investment_product_code()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'INV-' || lpad(nextval('investment_product_ref_seq')::text, 4, '0');
$$;

CREATE OR REPLACE FUNCTION public.set_investment_product_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.product_code IS NULL OR NEW.product_code = '' THEN
    NEW.product_code := public.generate_investment_product_code();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ip_set_code
  BEFORE INSERT ON public.investment_products
  FOR EACH ROW EXECUTE FUNCTION public.set_investment_product_code();

CREATE TRIGGER trg_ip_updated_at
  BEFORE UPDATE ON public.investment_products
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- Investment Accounts (customer instances of investment products)
-- ============================================================================
CREATE TABLE public.investment_accounts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_number        text NOT NULL UNIQUE,
  product_id            uuid NOT NULL REFERENCES public.investment_products(id) ON DELETE RESTRICT,
  customer_id           uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,

  -- Investment details
  principal_amount      numeric(15,2) NOT NULL,        -- Amount invested
  current_value         numeric(15,2) NOT NULL,       -- Current valuation (principal + returns)
  units_held            numeric(18,4),                 -- For unitized: units held
  purchase_nav          numeric(15,4),                 -- NAV at subscription time
  current_nav           numeric(15,4),                 -- Latest NAV (for unitized)

  -- Tenure
  tenure_days           integer,                       -- NULL = open-ended
  start_date            timestamptz,
  maturity_date         timestamptz,                   -- NULL = open-ended
  last_valuation_date   timestamptz,

  -- Returns
  returns_earned        numeric(15,2) NOT NULL DEFAULT 0,
  returns_paid_out      numeric(15,2) NOT NULL DEFAULT 0,

  -- Status
  status                investment_status NOT NULL DEFAULT 'pending',

  -- Terms snapshot (captured at subscription — config changes don't affect existing accounts)
  terms_snapshot        jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Risk disclosure acceptance (MANDATORY, permanently stored per standing instructions)
  risk_disclosure_accepted boolean NOT NULL DEFAULT false,
  risk_disclosure_accepted_at timestamptz,
  risk_disclosure_version   text NOT NULL DEFAULT '',  -- Version of disclosure text accepted
  risk_disclosure_ip_address text,                     -- IP address of acceptance (audit trail)
  risk_disclosure_user_agent  text,                    -- User agent (audit trail)

  -- Metadata
  metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Standard
  version               integer NOT NULL DEFAULT 1,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  created_by            uuid REFERENCES auth.users(id),
  updated_by            uuid REFERENCES auth.users(id),

  CONSTRAINT chk_ia_version_positive CHECK (version > 0),
  CONSTRAINT chk_ia_principal_positive CHECK (principal_amount > 0),
  CONSTRAINT chk_ia_current_value_positive CHECK (current_value >= 0),
  CONSTRAINT chk_ia_disclosure_accepted CHECK (
    status = 'pending' OR risk_disclosure_accepted = true
  )
);

CREATE INDEX idx_ia_customer ON public.investment_accounts(customer_id);
CREATE INDEX idx_ia_product ON public.investment_accounts(product_id);
CREATE INDEX idx_ia_status ON public.investment_accounts(status);

CREATE SEQUENCE IF NOT EXISTS public.investment_account_ref_seq;

CREATE OR REPLACE FUNCTION public.generate_investment_account_number()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'INV-ACC-' || lpad(nextval('investment_account_ref_seq')::text, 6, '0');
$$;

CREATE OR REPLACE FUNCTION public.set_investment_account_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.account_number IS NULL OR NEW.account_number = '' THEN
    NEW.account_number := public.generate_investment_account_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ia_set_number
  BEFORE INSERT ON public.investment_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_investment_account_number();

CREATE TRIGGER trg_ia_updated_at
  BEFORE UPDATE ON public.investment_accounts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- Auto-create ledger account when investment account is activated
-- Uses parent 2003 (Investment Settlement Accounts)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_investment_ledger_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_id uuid;
  v_account_code text;
BEGIN
  -- Only create when investment account becomes active
  IF NEW.status = 'active' AND (
    OLD.status IS DISTINCT FROM 'active' OR TG_OP = 'INSERT'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.accounts
      WHERE metadata->>'investment_account_id' = NEW.id::text
        AND account_category = 'investment_settlement'
    ) THEN
      SELECT id INTO v_parent_id
      FROM public.accounts
      WHERE account_code = '2003' AND account_category = 'investment_settlement';

      v_account_code := '2003.' || NEW.account_number;

      INSERT INTO public.accounts (
        account_code, account_type, account_category, name,
        description, parent_account_id,
        is_system_account, is_active, metadata
      ) VALUES (
        v_account_code, 'liability', 'investment_settlement',
        'Investment: ' || NEW.account_number,
        'Investment settlement account for ' || NEW.account_number,
        v_parent_id,
        false, true,
        jsonb_build_object('investment_account_id', NEW.id, 'customer_id', NEW.customer_id)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_investment_create_ledger_account
  AFTER INSERT OR UPDATE OF status ON public.investment_accounts
  FOR EACH ROW EXECUTE FUNCTION public.create_investment_ledger_account();

-- ============================================================================
-- Function: Get the ledger account for an investment account
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_investment_account_id(p_investment_account_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.accounts
  WHERE metadata->>'investment_account_id' = p_investment_account_id::text
    AND account_category = 'investment_settlement'
    AND is_active = true
  LIMIT 1;
$$;

-- ============================================================================
-- Seed: Investment Products
-- ============================================================================
INSERT INTO public.investment_products (
  product_code, product_name, investment_type, description,
  expected_return_rate, return_type,
  min_investment, max_investment,
  min_tenure_days, max_tenure_days,
  risk_level, risk_score,
  management_fee_rate, early_exit_fee_rate, early_exit_lock_days,
  allows_early_redemption, allows_partial_redemption, allows_top_up, auto_reinvest,
  cooperative_required,
  risk_disclosure_text, risk_disclosure_version,
  is_active, status, config
) VALUES
  -- Fixed Income: 90-day treasury equivalent
  ('INV-0001', 'Fixed Income Fund — 90 Day', 'fixed_income',
   'Short-term fixed income investment with guaranteed returns. Ideal for capital preservation while earning competitive yields over 90 days.',
   12.0000, 'flat',
   5000.00, 500000.00,
   90, 90,
   'low', 2,
   0.5000, 2.0000, 30,
   true, true, false, false,
   false,
   'By subscribing to this Fixed Income Fund, you acknowledge that: (1) Your principal is protected but returns are not guaranteed beyond the stated expected rate; (2) Early redemption before maturity is subject to a 2% exit fee; (3) The platform acts as an intermediary and does not guarantee investment performance; (4) Investment products are NOT deposits and are NOT insured by NDIC; (5) Past performance does not guarantee future results. You accept these risks by proceeding with your subscription.',
   '1.0',
   true, 'active',
   '{"category": "treasury_equivalent", "payout_frequency": "at_maturity"}'::jsonb),

  -- Agricultural Investment Pool: seasonal crop cycle
  ('INV-0002', 'Agricultural Investment Pool — Maize Cycle', 'agricultural_pool',
   'Invest in smallholder farmer cooperatives growing maize during the current planting season. Returns are generated from crop sales at harvest. Unitized — your share of the pool is proportional to your investment.',
   18.0000, 'compound',
   10000.00, 1000000.00,
   180, 180,
   'high', 7,
   1.5000, 5.0000, 60,
   true, true, true, false,
   true,
   'IMPORTANT — AGRICULTURAL INVESTMENT RISK DISCLOSURE: By subscribing to this Agricultural Investment Pool, you acknowledge that: (1) Agricultural investments are subject to weather risks, pest outbreaks, market price volatility, and supply chain disruptions; (2) The expected 18% return is NOT guaranteed — actual returns may be higher or lower depending on crop yields and market prices; (3) Your principal is at risk — crop failure could result in partial or total loss of invested capital; (4) Investment products are NOT deposits and are NOT insured by NDIC; (5) Early redemption is subject to a 5% exit fee and may not be available during the planting season; (6) The platform acts as an intermediary facilitating investments in agricultural cooperatives and does not guarantee returns; (7) This investment requires cooperative membership. You accept ALL of these risks by proceeding with your subscription.',
   '1.0',
   true, 'active',
   '{"category": "crop_cycle", "crop_type": "maize", "season": "2026_wet", "payout_frequency": "at_harvest"}'::jsonb),

  -- Cooperative Growth Fund: profit-sharing, requires coop membership
  ('INV-0003', 'Cooperative Growth Fund — AgroEsusu', 'cooperative_fund',
   'Invest in the AgroEsusu Farmers Cooperative growth fund. Returns are based on the cooperative''s collective profitability from lending operations and group savings activities. Profit-sharing model — returns fluctuate with cooperative performance.',
   15.0000, 'compound',
   5000.00, 500000.00,
   365, NULL,
   'moderate', 5,
   1.0000, 3.0000, 90,
   true, true, true, true,
   true,
   'COOPERATIVE GROWTH FUND RISK DISCLOSURE: By subscribing to this Cooperative Growth Fund, you acknowledge that: (1) Returns are based on cooperative profitability and are NOT guaranteed; (2) The cooperative''s lending operations carry default risk — loan defaults reduce the fund''s returns; (3) Your principal is at risk — poor cooperative performance could result in reduced returns or loss; (4) This is an open-ended investment with no fixed maturity — you may redeem at any time after the 90-day lock period subject to exit fees; (5) Auto-reinvestment is enabled by default — returns are reinvested unless you opt out; (6) This investment requires cooperative membership; (7) Investment products are NOT deposits and are NOT insured by NDIC. You accept ALL of these risks by proceeding with your subscription.',
   '1.0',
   true, 'active',
   '{"category": "profit_sharing", "auto_reinvest_default": true, "payout_frequency": "quarterly"}'::jsonb),

  -- Money Market: short-term, low-risk, liquid
  ('INV-0004', 'Money Market Fund — AgroLiquid', 'money_market',
   'A low-risk, highly liquid money market fund. Ideal for parking funds while earning modest returns. No lock period — redeem anytime. NAV is stable and designed to preserve capital.',
   8.0000, 'compound',
   1000.00, NULL,
   1, NULL,
   'low', 1,
   0.2500, 0, 0,
   true, true, true, true,
   false,
   'MONEY MARKET FUND RISK DISCLOSURE: By subscribing to this Money Market Fund, you acknowledge that: (1) While designed for capital preservation, money market funds are NOT bank deposits and are NOT insured by NDIC; (2) The fund invests in short-term debt instruments which carry minimal but non-zero default risk; (3) The 8% expected return is not guaranteed and may fluctuate with market conditions; (4) The fund manager (platform) charges a 0.25% annual management fee; (5) Redemptions are typically processed within 1 business day but may be delayed in extreme market conditions. You accept these risks by proceeding with your subscription.',
   '1.0',
   true, 'active',
   '{"category": "money_market", "nav_stability": "high", "redemption_settlement": "T+1"}'::jsonb)
ON CONFLICT (product_code) DO NOTHING;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.investment_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investment_accounts ENABLE ROW LEVEL SECURITY;

-- Products: visible to all authenticated users (marketing/discovery)
CREATE POLICY ip_read_all
  ON public.investment_products FOR SELECT TO authenticated
  USING (is_active = true AND status = 'active');

CREATE POLICY ip_read_staff_all
  ON public.investment_products FOR SELECT TO authenticated
  USING (public.has_permission('admin.read') OR public.has_role('super_admin'));

-- Accounts: customers see only their own; staff see all
CREATE POLICY ia_read_self
  ON public.investment_accounts FOR SELECT TO authenticated
  USING (customer_id IN (SELECT c.id FROM public.customers c WHERE c.auth_id = auth.uid()));

CREATE POLICY ia_read_staff
  ON public.investment_accounts FOR SELECT TO authenticated
  USING (public.has_permission('wallet.read') OR public.has_role('super_admin'));

COMMIT;

-- ============================================================================
-- DOWN PATH:
--   DROP FUNCTION get_investment_account_id(uuid);
--   DROP FUNCTION create_investment_ledger_account();
--   DROP TRIGGER trg_investment_create_ledger_account ON investment_accounts;
--   DROP TRIGGER trg_ia_updated_at ON investment_accounts;
--   DROP TRIGGER trg_ia_set_number ON investment_accounts;
--   DROP FUNCTION set_investment_account_number();
--   DROP FUNCTION generate_investment_account_number();
--   DROP TRIGGER trg_ip_updated_at ON investment_products;
--   DROP TRIGGER trg_ip_set_code ON investment_products;
--   DROP FUNCTION set_investment_product_code();
--   DROP FUNCTION generate_investment_product_code();
--   DROP TABLE investment_accounts;
--   DROP TABLE investment_products;
--   DROP TYPE investment_status;
--   DROP TYPE product_status;
--   DROP TYPE investment_type;
-- ============================================================================
