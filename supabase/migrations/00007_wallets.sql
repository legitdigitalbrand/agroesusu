-- ============================================================================
-- Migration 00007: Wallet Table (with DVA fields)
-- 
-- Creates the wallets table — the customer's internal financial account.
-- Per Volume 05 Part 5.5: Wallet is NOT a bank account. It's the internal
-- financial account within the platform.
--
-- CRITICAL DESIGN DECISION (Phase 2 constraint):
--   The `cached_balance` field is a READ-THROUGH CACHE from Safe Haven's API.
--   It is NOT the source of truth. The Ledger (Phase 5) will become the
--   authoritative financial source. Phase 2 treats this cache as operational
--   convenience, not as financial truth.
--
-- Wallet lifecycle (from Part 5.5):
--   Created → Pending Activation → Active → Restricted → Frozen → Suspended → Closed → Archived
--
-- DVA (Dedicated Virtual Account) fields store the Safe Haven Sub Account details.
-- Sub Accounts are static (non-expiring) virtual accounts — our DVAs.
--
-- DOWN PATH: DROP TABLE wallets; DROP TYPE wallet_type; DROP TYPE wallet_status;
--           DROP FUNCTION generate_wallet_number(); DROP SEQUENCE wallet_number_seq;
-- ============================================================================

BEGIN;

CREATE TYPE wallet_type AS ENUM (
  'primary',       -- Default wallet for every customer
  'savings',       -- Savings holding account
  'loan',          -- Loan settlement account
  'investment',    -- Investment settlement account
  'escrow',         -- Escrow account
  'business',      -- Future
  'cooperative',   -- Future
  'project'        -- Future
);

CREATE TYPE wallet_status AS ENUM (
  'created',              -- Wallet record created, Safe Haven account not yet provisioned
  'pending_activation',   -- Safe Haven account creation in progress
  'active',               -- Fully active
  'restricted',           -- Specific restrictions applied
  'frozen',               -- All operations blocked
  'suspended',            -- Temporarily suspended
  'closed',               -- Permanently closed
  'archived'             -- Historical
);

-- Sequence for wallet number generation
CREATE SEQUENCE IF NOT EXISTS public.wallet_number_seq;

CREATE OR REPLACE FUNCTION public.generate_wallet_number()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'WAL-' || EXTRACT(YEAR FROM now())::text || '-' || 
         lpad(nextval('wallet_number_seq')::text, 6, '0');
$$;

CREATE TABLE public.wallets (
  -- Identity
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_number         text NOT NULL UNIQUE,    -- WAL-2026-000001
  customer_id           uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  wallet_type           wallet_type NOT NULL DEFAULT 'primary',
  status                wallet_status NOT NULL DEFAULT 'created',
  
  -- DVA (Safe Haven Sub Account) fields
  safe_haven_account_id     text,    -- Safe Haven's account ID
  account_number           text,    -- The DVA 10-digit account number
  account_name             text,    -- The account name as registered with Safe Haven
  bank_name                text,    -- e.g., "Safe Haven MFB"
  bank_code                text,    -- e.g., "999240"
  dva_provisioned_at       timestamptz,
  
  -- BALANCE (CACHE — NOT SOURCE OF TRUTH)
  -- This is a read-through cache from Safe Haven's GET /accounts/{id} response.
  -- The Ledger (Phase 5) will become the authoritative financial source.
  -- Phase 2 must NOT treat this as truth — it's operational convenience.
  cached_balance            numeric(15,2) NOT NULL DEFAULT 0.00,
  cached_available_balance  numeric(15,2) NOT NULL DEFAULT 0.00,
  cached_ledger_balance      numeric(15,2) NOT NULL DEFAULT 0.00,
  cached_balance_updated_at timestamptz,
  
  -- Reserved balance (for pending operations — e.g., withdrawal authorization)
  reserved_balance          numeric(15,2) NOT NULL DEFAULT 0.00,
  
  -- Configurable limits (Phase 2: nullable, set by config engine in Phase 3+)
  max_balance              numeric(15,2),
  daily_funding_limit      numeric(15,2),
  daily_withdrawal_limit   numeric(15,2),
  daily_transfer_limit     numeric(15,2),
  single_transaction_limit numeric(15,2),
  
  -- Restrictions
  debit_restricted         boolean NOT NULL DEFAULT false,
  credit_restricted        boolean NOT NULL DEFAULT false,
  withdrawal_restricted    boolean NOT NULL DEFAULT false,
  transfer_restricted      boolean NOT NULL DEFAULT false,
  restriction_reason        text,
  
  -- Standard metadata (Part 5.2)
  version                  integer NOT NULL DEFAULT 1,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  created_by               uuid REFERENCES auth.users(id),
  updated_by               uuid REFERENCES auth.users(id),
  
  -- Constraints
  CONSTRAINT chk_wallet_number_format CHECK (wallet_number ~ '^WAL-[0-9]{4}-[0-9]{6}$'),
  CONSTRAINT chk_cached_balance_nonneg CHECK (cached_balance >= 0),
  CONSTRAINT chk_reserved_balance_nonneg CHECK (reserved_balance >= 0),
  CONSTRAINT chk_version_positive CHECK (version > 0)
);

-- Auto-generate wallet number
CREATE OR REPLACE FUNCTION public.set_wallet_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.wallet_number IS NULL OR NEW.wallet_number = '' THEN
    NEW.wallet_number := public.generate_wallet_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_wallets_set_number
  BEFORE INSERT ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.set_wallet_number();

CREATE TRIGGER trg_wallets_updated_at
  BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Indexes
CREATE INDEX idx_wallets_customer_id ON public.wallets(customer_id);
CREATE INDEX idx_wallets_wallet_number ON public.wallets(wallet_number);
CREATE INDEX idx_wallets_account_number ON public.wallets(account_number) WHERE account_number IS NOT NULL;
CREATE INDEX idx_wallets_sh_account_id ON public.wallets(safe_haven_account_id) WHERE safe_haven_account_id IS NOT NULL;
CREATE INDEX idx_wallets_status ON public.wallets(status);
CREATE INDEX idx_wallets_type ON public.wallets(wallet_type);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
-- Customers can read their own wallets.
-- Staff with 'wallet.read' can read all wallets.
-- Only system/service_role can write (wallet creation happens through ACL).

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY wallets_read_self
  ON public.wallets FOR SELECT
  TO authenticated
  USING (
    customer_id IN (
      SELECT id FROM public.customers WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY wallets_read_staff
  ON public.wallets FOR SELECT
  TO authenticated
  USING (public.has_permission('wallet.read'));

COMMIT;

-- ============================================================================
-- DOWN PATH:
--   DROP TABLE wallets;
--   DROP FUNCTION set_wallet_number();
--   DROP SEQUENCE wallet_number_seq;
--   DROP FUNCTION generate_wallet_number();
--   DROP TYPE wallet_status;
--   DROP TYPE wallet_type;
-- ============================================================================
