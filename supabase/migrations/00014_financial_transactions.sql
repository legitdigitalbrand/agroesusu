-- ============================================================================
-- Migration 00014: Financial Transaction Orchestrator (FTO)
-- 
-- The FTO is the ONLY entry point for financial movements in the platform.
-- Every module (Wallet, Savings, Loans, Investments) calls the Orchestrator
-- to initiate financial transactions. The Orchestrator:
--   1. Validates the request
--   2. Creates a financial transaction record (state machine)
--   3. Posts the corresponding journal entry to the Ledger
--   4. Emits domain events
--   5. Records side effects (wallet_transactions read model)
--
-- STATE MACHINE:
--   initiated → validated → posting → posted → completed
--   initiated → failed (validation failed, no ledger impact)
--   posting → failed (posting failed — rare, requires rollback)
--   completed → reversed (a reversal transaction was created)
--
-- No other module writes to journal_entries or journal_lines.
-- The Orchestrator is the gatekeeper.
--
-- DOWN PATH: DROP TABLE financial_transactions;
--           DROP TYPE ft_status; DROP TYPE ft_type;
-- ============================================================================

BEGIN;

-- Financial transaction status (FTO state machine)
CREATE TYPE ft_status AS ENUM (
  'initiated',    -- Request received, validation pending
  'validated',    -- Validation passed, ready to post
  'posting',      -- Journal entry being created
  'posted',       -- Journal entry posted to ledger
  'completed',    -- All side effects done (balance cache, events, read model)
  'failed',       -- Validation or posting failed (no ledger impact)
  'reversed'      -- A reversal transaction was created
);

-- Financial transaction types (extensible — new types added in future phases)
CREATE TYPE ft_type AS ENUM (
  -- Wallet operations (Phase 4)
  'wallet_deposit',           -- Inbound transfer to DVA
  'wallet_withdrawal',        -- Outbound transfer from DVA
  'wallet_transfer',          -- P2P transfer between wallets
  
  -- Savings operations (Phase 5+)
  'savings_contribution',     -- Money into savings
  'savings_withdrawal',       -- Money out of savings
  'savings_interest',         -- Interest paid to saver
  
  -- Loan operations (Phase 6+)
  'loan_disbursement',        -- Loan money sent to customer
  'loan_repayment',           -- Customer repays loan
  'loan_interest',            -- Interest charged on loan
  'loan_penalty',             -- Penalty fee
  
  -- Investment operations (Phase 7+)
  'investment_subscription',  -- Money into investment
  'investment_redemption',   -- Money out of investment
  'investment_returns',       -- Returns paid to investor
  
  -- Fee operations
  'fee_charge',               -- Fee charged to customer
  'fee_reversal',             -- Fee reversed
  
  -- System
  'reversal',                 -- Reversal of any transaction
  'adjustment'                -- Manual adjustment (with approval)
);

-- Source modules that can initiate transactions
CREATE TYPE ft_source_module AS ENUM (
  'wallet',
  'savings',
  'loans',
  'investments',
  'group_savings',
  'orchestrator',    -- For system-initiated (e.g., auto-reversal)
  'admin'            -- Manual admin action (with approval)
);

CREATE TABLE public.financial_transactions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_reference   text NOT NULL UNIQUE,        -- FT-YYYY-NNNNNNNN
  transaction_type        ft_type NOT NULL,
  source_module           ft_source_module NOT NULL,
  
  -- The caller's reference (e.g., savings contribution ID, webhook event ID)
  source_reference        text NOT NULL,
  
  -- State machine
  status                  ft_status NOT NULL DEFAULT 'initiated',
  
  -- Financial details
  amount                  numeric(15,2) NOT NULL,
  currency                text NOT NULL DEFAULT 'NGN',
  description             text NOT NULL,
  
  -- Links
  wallet_id               uuid REFERENCES public.wallets(id),     -- The wallet involved (if any)
  journal_entry_id        uuid REFERENCES public.journal_entries(id),  -- The posted journal entry
  
  -- Idempotency (distinct from Phase 2's Safe Haven idempotency)
  idempotency_key         text NOT NULL,                          -- Caller-generated, prevents duplicate posting
  
  -- Reversal tracking
  reverses                uuid REFERENCES public.financial_transactions(id),
  reversed_by             uuid REFERENCES public.financial_transactions(id),
  reversal_reason         text,
  
  -- Validation
  validation_errors       jsonb,                                 -- Errors if validation failed
  
  -- Tracing
  correlation_id          uuid NOT NULL DEFAULT gen_random_uuid(),
  metadata                jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  -- State machine timestamps
  initiated_at            timestamptz NOT NULL DEFAULT now(),
  validated_at            timestamptz,
  posted_at               timestamptz,
  completed_at            timestamptz,
  failed_at               timestamptz,
  reversed_at             timestamptz,
  
  -- Standard
  version                 integer NOT NULL DEFAULT 1,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  created_by              uuid REFERENCES auth.users(id),
  updated_by              uuid REFERENCES auth.users(id),
  
  -- Constraints
  CONSTRAINT chk_ft_amount_positive CHECK (amount > 0),
  CONSTRAINT chk_ft_version_positive CHECK (version > 0),
  CONSTRAINT chk_ft_ref_format CHECK (transaction_reference ~ '^FT-[0-9]{4}-[0-9]{8}$'),
  CONSTRAINT chk_ft_idempotency_not_empty CHECK (idempotency_key <> '')
);

-- Unique on idempotency key — prevents duplicate posting
CREATE UNIQUE INDEX uq_ft_idempotency ON public.financial_transactions(idempotency_key);

-- Sequence for transaction reference
CREATE SEQUENCE IF NOT EXISTS public.financial_tx_ref_seq;

CREATE OR REPLACE FUNCTION public.generate_ft_reference()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'FT-' || EXTRACT(YEAR FROM now())::text || '-' || 
         lpad(nextval('financial_tx_ref_seq')::text, 8, '0');
$$;

CREATE OR REPLACE FUNCTION public.set_ft_reference()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.transaction_reference IS NULL OR NEW.transaction_reference = '' THEN
    NEW.transaction_reference := public.generate_ft_reference();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ft_set_reference
  BEFORE INSERT ON public.financial_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_ft_reference();

CREATE TRIGGER trg_ft_updated_at
  BEFORE UPDATE ON public.financial_transactions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Indexes
CREATE INDEX idx_ft_status ON public.financial_transactions(status);
CREATE INDEX idx_ft_type ON public.financial_transactions(transaction_type);
CREATE INDEX idx_ft_source_module ON public.financial_transactions(source_module);
CREATE INDEX idx_ft_wallet ON public.financial_transactions(wallet_id) WHERE wallet_id IS NOT NULL;
CREATE INDEX idx_ft_journal ON public.financial_transactions(journal_entry_id) WHERE journal_entry_id IS NOT NULL;
CREATE INDEX idx_ft_reverses ON public.financial_transactions(reverses) WHERE reverses IS NOT NULL;
CREATE INDEX idx_ft_created_at ON public.financial_transactions(created_at);
CREATE INDEX idx_ft_correlation ON public.financial_transactions(correlation_id);
CREATE INDEX idx_ft_source_ref ON public.financial_transactions(source_reference);

-- ============================================================================
-- Add FK from journal_entries to financial_transactions
-- (Was deferred in migration 00013 because financial_transactions didn't exist yet)
-- ============================================================================
DO $$
BEGIN
  -- Add the foreign key constraint
  ALTER TABLE public.journal_entries 
    ADD CONSTRAINT fk_je_transaction 
    FOREIGN KEY (transaction_id) REFERENCES public.financial_transactions(id);
EXCEPTION WHEN duplicate_object THEN
  -- Already exists — skip
  NULL;
END $$;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
-- Customers can read their own transactions (via wallet_id → customer_id join).
-- Staff with wallet.read can read all.
-- Service role handles all writes (Orchestrator uses service role).

ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY ft_read_self
  ON public.financial_transactions FOR SELECT
  TO authenticated
  USING (
    wallet_id IN (
      SELECT w.id FROM public.wallets w
      JOIN public.customers c ON c.id = w.customer_id
      WHERE c.auth_id = auth.uid()
    )
  );

CREATE POLICY ft_read_staff
  ON public.financial_transactions FOR SELECT
  TO authenticated
  USING (public.has_permission('wallet.read') OR public.has_role('super_admin'));

COMMIT;

-- ============================================================================
-- DOWN PATH:
--   DROP TABLE financial_transactions;
--   DROP TYPE ft_source_module;
--   DROP TYPE ft_type;
--   DROP TYPE ft_status;
--   DROP SEQUENCE financial_tx_ref_seq;
--   ALTER TABLE journal_entries DROP CONSTRAINT fk_je_transaction;
-- ============================================================================
