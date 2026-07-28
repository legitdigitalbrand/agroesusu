-- ============================================================================
-- Migration 00030: Investment Transactions & Valuations
-- 
-- Tracks individual investment transactions (subscriptions, redemptions,
-- returns payouts, management fees) and periodic NAV valuations for
-- unitized products.
-- ============================================================================

BEGIN;

-- ============================================================================
-- Investment Transactions (read model, populated by Orchestrator)
-- ============================================================================
CREATE TYPE investment_tx_type AS ENUM (
  'subscription',        -- Customer invests money
  'redemption',         -- Customer withdraws investment
  'returns_payout',     -- Returns paid out to customer
  'returns_reinvest',   -- Returns reinvested (auto-reinvest)
  'management_fee',    -- Management fee charged
  'early_exit_fee',    -- Early exit fee charged
  'top_up',             -- Additional investment
  'principal_return'   -- Principal returned at maturity
);

CREATE TABLE public.investment_transactions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investment_account_id uuid NOT NULL REFERENCES public.investment_accounts(id) ON DELETE CASCADE,
  customer_id           uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,

  transaction_type      investment_tx_type NOT NULL,
  amount               numeric(15,2) NOT NULL,
  units                numeric(18,4),               -- For unitized: units bought/sold
  nav_at_transaction   numeric(15,4),               -- NAV at time of transaction

  -- Links
  financial_transaction_id uuid REFERENCES public.financial_transactions(id),
  source_reference     text,

  -- Status
  status               text NOT NULL DEFAULT 'completed',

  -- Metadata
  metadata             jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Standard
  created_at           timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT chk_itx_amount_positive CHECK (amount >= 0)
);

CREATE INDEX idx_itx_account ON public.investment_transactions(investment_account_id);
CREATE INDEX idx_itx_customer ON public.investment_transactions(customer_id);
CREATE INDEX idx_itx_type ON public.investment_transactions(transaction_type);
CREATE INDEX idx_itx_created ON public.investment_transactions(created_at);

-- ============================================================================
-- Investment NAV History (for unitized products — tracks NAV over time)
-- ============================================================================
CREATE TABLE public.investment_nav_history (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id            uuid NOT NULL REFERENCES public.investment_products(id) ON DELETE CASCADE,
  
  nav_date              date NOT NULL,
  nav_per_unit          numeric(15,4) NOT NULL,
  total_aum             numeric(15,2) NOT NULL,      -- Total assets under management
  total_units_outstanding numeric(18,4) NOT NULL,
  
  -- Valuation metadata
  valuation_method      text NOT NULL DEFAULT 'mark_to_market',
  valuation_notes      text,
  
  created_at            timestamptz NOT NULL DEFAULT now(),
  created_by            uuid REFERENCES auth.users(id),
  
  UNIQUE (product_id, nav_date),
  CONSTRAINT chk_nav_positive CHECK (nav_per_unit > 0),
  CONSTRAINT chk_aum_positive CHECK (total_aum >= 0),
  CONSTRAINT chk_units_positive CHECK (total_units_outstanding >= 0)
);

CREATE INDEX idx_nav_product ON public.investment_nav_history(product_id);
CREATE INDEX idx_nav_date ON public.investment_nav_history(nav_date);

-- ============================================================================
-- Risk Disclosure Acceptance Log (per standing instructions — permanent)
-- 
-- Every risk disclosure acceptance is permanently stored. Even if the
-- product's disclosure text changes (versioned), the original acceptance
-- record preserves the exact text and version the customer agreed to.
-- ============================================================================
CREATE TABLE public.risk_disclosure_acceptances (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investment_account_id uuid REFERENCES public.investment_accounts(id) ON DELETE CASCADE,
  customer_id           uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  product_id            uuid NOT NULL REFERENCES public.investment_products(id) ON DELETE RESTRICT,
  
  -- What was accepted
  disclosure_text       text NOT NULL,               -- Full text of disclosure at time of acceptance
  disclosure_version    text NOT NULL,                -- Version of disclosure text
  product_name         text NOT NULL,                -- Product name at time of acceptance
  risk_level           text NOT NULL,                -- Risk level at time of acceptance
  
  -- When and how
  accepted_at          timestamptz NOT NULL DEFAULT now(),
  ip_address           text,
  user_agent           text,
  
  -- Audit
  created_at           timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT chk_rda_text_not_empty CHECK (disclosure_text <> ''),
  CONSTRAINT chk_rda_version_not_empty CHECK (disclosure_version <> '')
);

CREATE INDEX idx_rda_customer ON public.risk_disclosure_acceptances(customer_id);
CREATE INDEX idx_rda_product ON public.risk_disclosure_acceptances(product_id);
CREATE INDEX idx_rda_account ON public.risk_disclosure_acceptances(investment_account_id) WHERE investment_account_id IS NOT NULL;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.investment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investment_nav_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_disclosure_acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY itx_read_self
  ON public.investment_transactions FOR SELECT TO authenticated
  USING (customer_id IN (SELECT c.id FROM public.customers c WHERE c.auth_id = auth.uid()));

CREATE POLICY itx_read_staff
  ON public.investment_transactions FOR SELECT TO authenticated
  USING (public.has_permission('wallet.read') OR public.has_role('super_admin'));

CREATE POLICY nav_read_all
  ON public.investment_nav_history FOR SELECT TO authenticated
  USING (true);

CREATE POLICY rda_read_self
  ON public.risk_disclosure_acceptances FOR SELECT TO authenticated
  USING (customer_id IN (SELECT c.id FROM public.customers c WHERE c.auth_id = auth.uid()));

CREATE POLICY rda_read_staff
  ON public.risk_disclosure_acceptances FOR SELECT TO authenticated
  USING (public.has_permission('audit.read') OR public.has_role('super_admin'));

COMMIT;

-- ============================================================================
-- DOWN PATH:
--   DROP TABLE risk_disclosure_acceptances;
--   DROP TABLE investment_nav_history;
--   DROP TABLE investment_transactions;
--   DROP TYPE investment_tx_type;
-- ============================================================================
