-- ============================================================================
-- Migration 00010: Wallet Transactions (Transaction History Read Model)
-- 
-- Append-only, chronological record of movements per wallet.
-- Populated from:
--   1. Processed Phase 2 inbound events (Safe Haven webhooks)
--   2. Outbound operations initiated by our system (future phases)
--
-- CRITICAL DESIGN DECISION:
--   This table is the READ MODEL for transaction history. It is NOT the Ledger.
--   The Ledger (Phase 5) will be the authoritative financial record.
--   This read model is eventually consistent with Safe Haven, not with the Ledger yet.
--   When Phase 5 arrives, the Orchestrator will post to both the Ledger AND this table.
--
-- Transaction Status Lifecycle:
--   pending → confirmed   (Safe Haven confirmed the transaction)
--   pending → failed      (transaction failed, no money moved)
--   confirmed → (reversal) — a NEW transaction is created with reversal_of pointing to the original
--   The original transaction is NEVER modified. Reversals are new rows.
--
-- Balance cache authority:
--   cached_balance on wallets = SUM of confirmed transactions (credits - debits)
--   This is computed by refresh_wallet_balance_cache() function.
--   Safe Haven's reported balance is reconciled against this, not vice versa.
--
-- DOWN PATH: DROP TABLE wallet_transactions; DROP TYPE wallet_tx_direction;
--           DROP TYPE wallet_tx_status; DROP TYPE wallet_tx_source;
--           DROP FUNCTION refresh_wallet_balance_cache();
-- ============================================================================

BEGIN;

CREATE TYPE wallet_tx_direction AS ENUM (
  'credit',    -- Money flowing INTO the wallet (deposit, transfer received)
  'debit'      -- Money flowing OUT of the wallet (withdrawal, transfer sent)
);

CREATE TYPE wallet_tx_status AS ENUM (
  'pending',     -- Initiated but not yet confirmed by Safe Haven
  'confirmed',   -- Confirmed by Safe Haven (webhook received or status check)
  'failed',      -- Transaction failed, no money moved
  'reversed'     -- Reversed (a reversal transaction exists referencing this one)
);

CREATE TYPE wallet_tx_source AS ENUM (
  'safe_haven_webhook',        -- Created from a processed inbound webhook event
  'internal_operation',        -- Created by our system (e.g., fee deduction — future phase)
  'reconciliation_adjustment', -- Created during reconciliation (manual, with approval)
  'system_initialization'     -- System-created (e.g., opening balance — future)
);

CREATE TYPE wallet_tx_type AS ENUM (
  'deposit',           -- Cash deposit into DVA
  'transfer_in',       -- Incoming bank transfer
  'transfer_out',      -- Outgoing bank transfer
  'withdrawal',         -- Cash withdrawal
  'fee',               -- Fee charge (future)
  'interest',          -- Interest payment (future)
  'penalty',           -- Penalty charge (future)
  'loan_disbursement', -- Loan disbursement (future)
  'loan_repayment',    -- Loan repayment (future)
  'reversal',          -- Reversal of a previous transaction
  'adjustment',        -- Manual adjustment (with approval)
  'unknown'            -- Unrecognized type (logged for investigation)
);

CREATE TABLE public.wallet_transactions (
  -- Identity
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_reference   text NOT NULL UNIQUE,    -- Our internal reference (WTX-YYYY-NNNNNNNN)
  external_reference      text,                     -- Safe Haven's transaction/session ID
  wallet_id               uuid NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  
  -- Movement details
  direction               wallet_tx_direction NOT NULL,
  amount                  numeric(15,2) NOT NULL,
  currency                text NOT NULL DEFAULT 'NGN',
  transaction_type        wallet_tx_type NOT NULL DEFAULT 'unknown',
  narration               text,
  
  -- Source tracking
  source                  wallet_tx_source NOT NULL DEFAULT 'safe_haven_webhook',
  source_event_id         uuid REFERENCES public.inbound_events(id),  -- Correlation to Phase 2 landing table
  internal_reference      text,    -- Reference to internal operation (e.g., FTO ID in Phase 5)
  
  -- Counterparty (for transfers)
  counterparty_account_number  text,
  counterparty_account_name    text,
  counterparty_bank_code       text,
  counterparty_bank_name       text,
  
  -- Status lifecycle
  status                  wallet_tx_status NOT NULL DEFAULT 'pending',
  pending_at              timestamptz NOT NULL DEFAULT now(),
  confirmed_at            timestamptz,
  failed_at               timestamptz,
  failure_reason          text,
  
  -- Reversal tracking
  reversal_of            uuid REFERENCES public.wallet_transactions(id),  -- If this is a reversal, points to original
  reversed_by            uuid REFERENCES public.wallet_transactions(id),  -- If this was reversed, points to the reversal
  
  -- Metadata
  metadata               jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  -- Tracing
  correlation_id         uuid NOT NULL DEFAULT gen_random_uuid(),
  
  -- Standard metadata (Part 5.2)
  version                integer NOT NULL DEFAULT 1,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  created_by             uuid REFERENCES auth.users(id),
  updated_by             uuid REFERENCES auth.users(id),
  
  -- Constraints
  CONSTRAINT chk_amount_positive CHECK (amount > 0),
  CONSTRAINT chk_version_positive CHECK (version > 0),
  CONSTRAINT chk_tx_ref_format CHECK (transaction_reference ~ '^WTX-[0-9]{4}-[0-9]{8}$')
);

-- Sequence for transaction reference generation
CREATE SEQUENCE IF NOT EXISTS public.wallet_tx_ref_seq;

CREATE OR REPLACE FUNCTION public.generate_tx_reference()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'WTX-' || EXTRACT(YEAR FROM now())::text || '-' || 
         lpad(nextval('wallet_tx_ref_seq')::text, 8, '0');
$$;

-- Auto-generate transaction reference if not provided
CREATE OR REPLACE FUNCTION public.set_tx_reference()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.transaction_reference IS NULL OR NEW.transaction_reference = '' THEN
    NEW.transaction_reference := public.generate_tx_reference();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_wallet_tx_set_reference
  BEFORE INSERT ON public.wallet_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_tx_reference();

CREATE TRIGGER trg_wallet_tx_updated_at
  BEFORE UPDATE ON public.wallet_transactions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Indexes
CREATE INDEX idx_wallet_tx_wallet_id ON public.wallet_transactions(wallet_id);
CREATE INDEX idx_wallet_tx_status ON public.wallet_transactions(status);
CREATE INDEX idx_wallet_tx_direction ON public.wallet_transactions(direction);
CREATE INDEX idx_wallet_tx_created_at ON public.wallet_transactions(created_at);
CREATE INDEX idx_wallet_tx_source_event ON public.wallet_transactions(source_event_id) WHERE source_event_id IS NOT NULL;
CREATE INDEX idx_wallet_tx_external_ref ON public.wallet_transactions(external_reference) WHERE external_reference IS NOT NULL;
CREATE INDEX idx_wallet_tx_correlation ON public.wallet_transactions(correlation_id);
CREATE INDEX idx_wallet_tx_type ON public.wallet_transactions(transaction_type);
CREATE INDEX idx_wallet_tx_reversal_of ON public.wallet_transactions(reversal_of) WHERE reversal_of IS NOT NULL;

-- Unique constraint: one transaction per inbound event (prevents duplicate processing)
CREATE UNIQUE INDEX uq_wallet_tx_per_event 
  ON public.wallet_transactions(source_event_id) 
  WHERE source_event_id IS NOT NULL;

-- ============================================================================
-- BALANCE CACHE REFRESH FUNCTION
-- 
-- This is the ONLY sanctioned way to update the wallet balance cache.
-- It computes the balance as SUM(confirmed credits) - SUM(confirmed debits).
-- 
-- SECURITY: SECURITY DEFINER — callable from RLS context.
-- USAGE: Called ONLY from:
--   1. The event processor (after creating a new confirmed transaction)
--   2. The reconciliation process (NEVER to auto-correct — only after manual flag resolution)
--   3. Phase 5 Orchestrator (future)
--
-- NO other code path should update wallet.cached_balance directly.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.refresh_wallet_balance_cache(p_wallet_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_confirmed_balance  numeric(15,2);
  v_reserved           numeric(15,2);
  v_available          numeric(15,2);
BEGIN
  -- Sum of all confirmed transactions (credits positive, debits negative)
  SELECT 
    COALESCE(SUM(
      CASE 
        WHEN direction = 'credit' THEN amount
        WHEN direction = 'debit' THEN -amount
        ELSE 0
      END
    ), 0)
  INTO v_confirmed_balance
  FROM public.wallet_transactions
  WHERE wallet_id = p_wallet_id
    AND status = 'confirmed';
  
  -- Get current reserved balance
  SELECT COALESCE(reserved_balance, 0)
  INTO v_reserved
  FROM public.wallets
  WHERE id = p_wallet_id;
  
  -- Available = confirmed balance - reserved
  v_available := v_confirmed_balance - v_reserved;
  
  -- Update the cache
  UPDATE public.wallets
  SET 
    cached_balance = v_confirmed_balance,
    cached_available_balance = v_available,
    cached_ledger_balance = v_confirmed_balance,
    cached_balance_updated_at = now(),
    version = version + 1
  WHERE id = p_wallet_id;
END;
$$;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
-- Customers can read their own wallet transactions.
-- Staff with 'wallet.read' can read all wallet transactions.
-- Writes happen via service_role (event processor, reconciliation).

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY wallet_tx_read_self
  ON public.wallet_transactions FOR SELECT
  TO authenticated
  USING (
    wallet_id IN (
      SELECT w.id FROM public.wallets w
      JOIN public.customers c ON c.id = w.customer_id
      WHERE c.auth_id = auth.uid()
    )
  );

CREATE POLICY wallet_tx_read_staff
  ON public.wallet_transactions FOR SELECT
  TO authenticated
  USING (public.has_permission('wallet.read'));

COMMIT;

-- ============================================================================
-- DOWN PATH:
--   DROP TABLE wallet_transactions;
--   DROP FUNCTION set_tx_reference();
--   DROP FUNCTION refresh_wallet_balance_cache();
--   DROP FUNCTION generate_tx_reference();
--   DROP SEQUENCE wallet_tx_ref_seq;
--   DROP TYPE wallet_tx_type;
--   DROP TYPE wallet_tx_source;
--   DROP TYPE wallet_tx_status;
--   DROP TYPE wallet_tx_direction;
-- ============================================================================
