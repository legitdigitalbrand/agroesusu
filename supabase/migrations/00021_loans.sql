-- ============================================================================
-- Migration 00021: Loans & Repayment Schedule
-- 
-- The Loan Aggregate: application → approval/denial → disbursement → active →
-- closed/defaulted. Each loan gets its own asset ledger account under
-- parent 1002 (Loan Receivables).
-- ============================================================================

BEGIN;

CREATE TYPE loan_status AS ENUM (
  'applied',      -- Application submitted, awaiting eligibility check
  'approved',     -- Eligibility passed, awaiting disbursement
  'denied',       -- Eligibility failed (or admin denied)
  'disbursed',    -- Funds disbursed to wallet, repayment active
  'active',       -- Same as disbursed (alias for clarity in API)
  'closed',       -- Fully repaid
  'defaulted',    -- Defaulted (N consecutive missed installments)
  'restructured', -- Terms modified (original preserved)
  'written_off'   -- Written off as bad debt (future)
);

CREATE TYPE installment_status AS ENUM (
  'pending',    -- Not yet due
  'due',        -- Due date reached, not paid
  'paid',       -- Fully paid
  'late',       -- Past due date, not paid
  'defaulted',  -- Loan defaulted, installment will not be collected
  'partial'     -- Partially paid
);

CREATE TABLE public.loans (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_number           text NOT NULL UNIQUE,           -- LN-YYYY-NNNNNNNN
  customer_id           uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  wallet_id             uuid NOT NULL REFERENCES public.wallets(id) ON DELETE RESTRICT,
  product_id            uuid NOT NULL REFERENCES public.loan_products(id) ON DELETE RESTRICT,
  
  -- Amounts
  requested_amount      numeric(15,2) NOT NULL,
  approved_amount       numeric(15,2),                   -- May differ from requested
  principal_amount      numeric(15,2),                   -- = approved_amount (after fees deducted or included)
  total_interest        numeric(15,2) NOT NULL DEFAULT 0,
  total_payable         numeric(15,2) NOT NULL DEFAULT 0, -- Principal + interest
  
  -- Terms (snapshot from product at time of approval)
  product_terms_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  interest_rate         numeric(8,4) NOT NULL DEFAULT 0,
  interest_method       loan_interest_method NOT NULL DEFAULT 'flat',
  term_months           integer NOT NULL DEFAULT 3,
  
  -- Fees
  origination_fee       numeric(15,2) NOT NULL DEFAULT 0,
  processing_fee        numeric(15,2) NOT NULL DEFAULT 0,
  
  -- Lifecycle
  status                loan_status NOT NULL DEFAULT 'applied',
  applied_at            timestamptz NOT NULL DEFAULT now(),
  approved_at           timestamptz,
  denied_at             timestamptz,
  disbursed_at          timestamptz,
  closed_at             timestamptz,
  defaulted_at          timestamptz,
  
  -- Repayment tracking
  total_repaid          numeric(15,2) NOT NULL DEFAULT 0,
  total_interest_paid   numeric(15,2) NOT NULL DEFAULT 0,
  total_penalty_charged numeric(15,2) NOT NULL DEFAULT 0,
  next_due_date         timestamptz,
  last_repayment_at     timestamptz,
  
  -- Linked records
  eligibility_decision_id uuid,                           -- FK to loan_eligibility_decisions
  disbursement_ft_id    uuid,                             -- Financial transaction ID
  
  -- Digital agreement
  agreement_accepted_at  timestamptz,                    -- Mandatory before disbursement
  agreement_accepted_ip   text,
  
  -- Tracing
  correlation_id        uuid NOT NULL DEFAULT gen_random_uuid(),
  metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  -- Standard
  version               integer NOT NULL DEFAULT 1,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  created_by            uuid REFERENCES auth.users(id),
  updated_by            uuid REFERENCES auth.users(id),
  
  CONSTRAINT chk_l_version_positive CHECK (version > 0),
  CONSTRAINT chk_l_ref_format CHECK (loan_number ~ '^LN-[0-9]{4}-[0-9]{8}$'),
  CONSTRAINT chk_l_requested_positive CHECK (requested_amount > 0)
);

CREATE SEQUENCE IF NOT EXISTS public.loan_ref_seq;

CREATE OR REPLACE FUNCTION public.generate_loan_reference()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'LN-' || EXTRACT(YEAR FROM now())::text || '-' || 
         lpad(nextval('loan_ref_seq')::text, 8, '0');
$$;

CREATE OR REPLACE FUNCTION public.set_loan_reference()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.loan_number IS NULL OR NEW.loan_number = '' THEN
    NEW.loan_number := public.generate_loan_reference();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_loan_set_reference
  BEFORE INSERT ON public.loans
  FOR EACH ROW EXECUTE FUNCTION public.set_loan_reference();

CREATE TRIGGER trg_loan_updated_at
  BEFORE UPDATE ON public.loans
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX idx_loans_customer ON public.loans(customer_id);
CREATE INDEX idx_loans_wallet ON public.loans(wallet_id);
CREATE INDEX idx_loans_product ON public.loans(product_id);
CREATE INDEX idx_loans_status ON public.loans(status);
CREATE INDEX idx_loans_next_due ON public.loans(next_due_date) WHERE status IN ('disbursed', 'active');
CREATE INDEX idx_loans_created_at ON public.loans(created_at);

-- ============================================================================
-- Auto-create ledger account for loans
-- 
-- When a loan is disbursed (status → disbursed), create a child asset
-- account under parent 1002 (Loan Receivables).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_loan_ledger_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_id uuid;
  v_account_code text;
BEGIN
  IF NEW.status IN ('disbursed', 'active') AND (
    OLD.status IS DISTINCT FROM 'disbursed' AND OLD.status IS DISTINCT FROM 'active'
    OR TG_OP = 'INSERT'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.accounts 
      WHERE metadata->>'loan_id' = NEW.id::text
        AND account_category = 'other'
    ) THEN
      SELECT id INTO v_parent_id 
      FROM public.accounts 
      WHERE account_code = '1002';
      
      v_account_code := '1002.' || NEW.loan_number;
      
      INSERT INTO public.accounts (
        account_code, account_type, account_category, name,
        description, parent_account_id,
        is_system_account, is_active, metadata
      ) VALUES (
        v_account_code, 'asset', 'other',
        'Loan: ' || NEW.loan_number,
        'Loan receivable for ' || NEW.loan_number,
        v_parent_id,
        false, true,
        jsonb_build_object('loan_id', NEW.id::text, 'customer_id', NEW.customer_id::text, 'product_id', NEW.product_id::text)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_loan_create_ledger_account
  AFTER INSERT OR UPDATE OF status ON public.loans
  FOR EACH ROW EXECUTE FUNCTION public.create_loan_ledger_account();

-- ============================================================================
-- Function: Get the ledger account for a loan
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_loan_account_id(p_loan_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.accounts
  WHERE metadata->>'loan_id' = p_loan_id::text
    AND account_category = 'other'
    AND account_type = 'asset'
    AND is_active = true
  LIMIT 1;
$$;

-- ============================================================================
-- Repayment Schedule
-- ============================================================================
CREATE TABLE public.loan_repayment_schedule (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id               uuid NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  installment_number    integer NOT NULL,
  
  due_date              date NOT NULL,
  
  -- Amounts
  principal_amount      numeric(15,2) NOT NULL,
  interest_amount       numeric(15,2) NOT NULL,
  total_amount          numeric(15,2) NOT NULL,           -- Principal + interest
  
  -- Payment tracking
  amount_paid           numeric(15,2) NOT NULL DEFAULT 0,
  principal_paid        numeric(15,2) NOT NULL DEFAULT 0,
  interest_paid         numeric(15,2) NOT NULL DEFAULT 0,
  penalty_charged      numeric(15,2) NOT NULL DEFAULT 0,
  
  -- Status
  status                installment_status NOT NULL DEFAULT 'pending',
  paid_at               timestamptz,
  days_late             integer NOT NULL DEFAULT 0,
  
  -- Standard
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT chk_rps_amounts_positive CHECK (principal_amount > 0 AND total_amount > 0),
  CONSTRAINT chk_rps_installment_positive CHECK (installment_number > 0),
  UNIQUE (loan_id, installment_number)
);

CREATE INDEX idx_rps_loan ON public.loan_repayment_schedule(loan_id);
CREATE INDEX idx_rps_status ON public.loan_repayment_schedule(status);
CREATE INDEX idx_rps_due_date ON public.loan_repayment_schedule(due_date) WHERE status IN ('pending', 'due', 'late', 'partial');

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_repayment_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY loans_read_self
  ON public.loans FOR SELECT
  TO authenticated
  USING (
    customer_id IN (SELECT c.id FROM public.customers c WHERE c.auth_id = auth.uid())
  );

CREATE POLICY loans_read_staff
  ON public.loans FOR SELECT
  TO authenticated
  USING (public.has_permission('wallet.read') OR public.has_role('super_admin'));

CREATE POLICY rps_read_self
  ON public.loan_repayment_schedule FOR SELECT
  TO authenticated
  USING (
    loan_id IN (
      SELECT l.id FROM public.loans l
      WHERE l.customer_id IN (SELECT c.id FROM public.customers c WHERE c.auth_id = auth.uid())
    )
  );

CREATE POLICY rps_read_staff
  ON public.loan_repayment_schedule FOR SELECT
  TO authenticated
  USING (
    loan_id IN (
      SELECT l.id FROM public.loans l WHERE public.has_permission('wallet.read') OR public.has_role('super_admin')
    )
  );

COMMIT;
