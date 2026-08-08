-- ============================================================================
-- Migration 00043: Fraud Flags
--
-- Fraud detection and risk monitoring for the Operations Platform.
-- Flags are raised automatically (by transaction monitoring) or manually
-- (by staff). Each flag has a severity, status lifecycle, and resolution.
-- ============================================================================

BEGIN;

CREATE TYPE fraud_flag_status AS ENUM (
  'open',           -- Active flag, needs investigation
  'investigating',  -- Staff is reviewing
  'confirmed',      -- Confirmed fraud
  'false_positive', -- Investigated, not fraud
  'resolved'        -- Action taken, flag closed
);

CREATE TYPE fraud_flag_severity AS ENUM (
  'low',
  'medium',
  'high',
  'critical'
);

CREATE TYPE fraud_flag_type AS ENUM (
  'unusual_transaction_volume',
  'multiple_failed_logins',
  'velocity_check',
  'duplicate_bvn',
  'suspicious_withdrawal_pattern',
  'unusual_login_location',
  'chargeback_dispute',
  'manual_review',
  'kyc_discrepancy',
  'unusual_transfer_pattern',
  'staff_flagged',
  'system_alert'
);

CREATE TABLE public.fraud_flags (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_id         text NOT NULL UNIQUE DEFAULT ('FLG-' || upper(substr(md5(random()::text), 1, 8))),

  customer_id     uuid REFERENCES public.customers(id) ON DELETE CASCADE,
  customer_name   text,
  customer_email  text,

  flag_type       fraud_flag_type NOT NULL,
  severity        fraud_flag_severity NOT NULL DEFAULT 'medium',
  status          fraud_flag_status NOT NULL DEFAULT 'open',

  title           text NOT NULL,
  description     text NOT NULL,

  -- Related entities (nullable — a flag may or may not link to a transaction)
  transaction_id  uuid REFERENCES public.financial_transactions(id) ON DELETE SET NULL,
  wallet_id       uuid REFERENCES public.wallets(id) ON DELETE SET NULL,
  loan_id         uuid REFERENCES public.loans(id) ON DELETE SET NULL,

  -- Detection metadata
  detected_by     text NOT NULL DEFAULT 'system',  -- 'system' or staff name
  detection_data  jsonb DEFAULT '{}'::jsonb,       -- e.g., velocity metrics, IP addresses

  -- Resolution
  assigned_to     uuid REFERENCES auth.users(id),
  assigned_name  text,
  resolved_by     uuid REFERENCES auth.users(id),
  resolved_name   text,
  resolution_note text,
  resolved_at     timestamptz,

  -- Auto-action taken (e.g., wallet frozen, account suspended)
  auto_action     text,  -- 'wallet_frozen', 'account_suspended', 'loan_blocked', null

  metadata        jsonb DEFAULT '{}'::jsonb,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ff_customer ON public.fraud_flags(customer_id);
CREATE INDEX idx_ff_status ON public.fraud_flags(status);
CREATE INDEX idx_ff_severity ON public.fraud_flags(severity);
CREATE INDEX idx_ff_type ON public.fraud_flags(flag_type);
CREATE INDEX idx_ff_assigned ON public.fraud_flags(assigned_to);
CREATE INDEX idx_ff_created ON public.fraud_flags(created_at);

-- RLS
ALTER TABLE public.fraud_flags ENABLE ROW LEVEL SECURITY;

-- Staff can read all flags
CREATE POLICY ff_staff_read ON public.fraud_flags
  FOR SELECT TO authenticated
  USING (public.has_role('super_admin') OR public.has_permission('wallet.read'));

-- Staff can write flags
CREATE POLICY ff_staff_write ON public.fraud_flags
  FOR ALL TO authenticated
  USING (public.has_role('super_admin') OR public.has_permission('wallet.read'))
  WITH CHECK (public.has_role('super_admin') OR public.has_permission('wallet.read'));

-- Customers can read their own flags (for transparency)
CREATE POLICY ff_customer_read ON public.fraud_flags
  FOR SELECT TO authenticated
  USING (customer_id IN (SELECT c.id FROM public.customers c WHERE c.auth_id = auth.uid()));

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_fraud_flags_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_fraud_flags_updated
  BEFORE UPDATE ON public.fraud_flags
  FOR EACH ROW
  EXECUTE FUNCTION update_fraud_flags_updated_at();

COMMIT;
