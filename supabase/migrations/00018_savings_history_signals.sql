-- ============================================================================
-- Migration 00018: Savings History Signals
-- 
-- Pre-computed savings behavior metrics for Phase 6 (Loan Engine) credit
-- scoring. This table is updated periodically (daily) by a scheduled job
-- that computes savings behavior metrics from the Ledger and savings_accounts.
-- 
-- Phase 6 will consume this signal for "up to 3× savings balance" eligibility
-- and internal credit scoring. We don't build scoring logic here — just
-- capture the raw signal.
-- 
-- Why a separate table instead of computing on-the-fly:
--   1. Performance — credit scoring needs fast access, not ledger aggregation
--   2. Historical snapshots — scoring needs time-series behavior, not just current
--   3. Stable interface — Phase 6 doesn't need to understand the Ledger
-- ============================================================================

BEGIN;

CREATE TABLE public.savings_history_signals (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id             uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  
  -- Snapshot date (when this signal was computed)
  snapshot_date           date NOT NULL DEFAULT CURRENT_DATE,
  
  -- Current state
  total_savings_balance   numeric(15,2) NOT NULL DEFAULT 0,  -- Sum across all active savings accounts
  active_account_count    integer NOT NULL DEFAULT 0,
  product_diversity       integer NOT NULL DEFAULT 0,         -- Count of distinct product types
  
  -- Consistency metrics
  first_savings_date      date,                               -- Earliest savings account opened_at
  savings_tenure_days     integer NOT NULL DEFAULT 0,         -- Days since first savings account
  contribution_count_30d  integer NOT NULL DEFAULT 0,         -- Deposits in last 30 days
  contribution_count_90d  integer NOT NULL DEFAULT 0,         -- Deposits in last 90 days
  contribution_regularity numeric(5,2) NOT NULL DEFAULT 0,     -- 0-100 score: how regular are contributions
  
  -- Balance metrics
  avg_balance_30d         numeric(15,2) NOT NULL DEFAULT 0,    -- Average balance over last 30 days
  avg_balance_90d         numeric(15,2) NOT NULL DEFAULT 0,
  min_balance_90d         numeric(15,2) NOT NULL DEFAULT 0,
  max_balance_90d         numeric(15,2) NOT NULL DEFAULT 0,
  
  -- Withdrawal behavior
  withdrawal_count_90d    integer NOT NULL DEFAULT 0,
  withdrawal_frequency    numeric(5,2) NOT NULL DEFAULT 0,    -- Withdrawals per month (avg)
  early_withdrawals_count integer NOT NULL DEFAULT 0,         -- Withdrawals during lock period
  
  -- Interest
  total_interest_earned  numeric(15,2) NOT NULL DEFAULT 0,   -- Cumulative across all accounts
  
  -- Derived scores (raw signals — Phase 6 computes final credit score)
  consistency_score       integer NOT NULL DEFAULT 0,          -- 0-100: regularity of contributions
  stability_score         integer NOT NULL DEFAULT 0,          -- 0-100: balance stability (low withdrawal rate)
  tenure_score            integer NOT NULL DEFAULT 0,          -- 0-100: length of savings history
  
  -- Metadata
  metadata                jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  -- Standard
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  
  -- One signal per customer per day
  CONSTRAINT uq_shs_customer_date UNIQUE (customer_id, snapshot_date)
);

CREATE INDEX idx_shs_customer ON public.savings_history_signals(customer_id);
CREATE INDEX idx_shs_snapshot ON public.savings_history_signals(snapshot_date);
CREATE INDEX idx_shs_customer_snapshot ON public.savings_history_signals(customer_id, snapshot_date);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.savings_history_signals ENABLE ROW LEVEL SECURITY;

-- Customers can see their own signal (for transparency)
CREATE POLICY shs_read_self
  ON public.savings_history_signals FOR SELECT
  TO authenticated
  USING (
    customer_id IN (
      SELECT c.id FROM public.customers c WHERE c.auth_id = auth.uid()
    )
  );

-- Staff with wallet.read can see all (for loan officers reviewing applications)
CREATE POLICY shs_read_staff
  ON public.savings_history_signals FOR SELECT
  TO authenticated
  USING (public.has_permission('wallet.read') OR public.has_role('super_admin'));

COMMIT;
