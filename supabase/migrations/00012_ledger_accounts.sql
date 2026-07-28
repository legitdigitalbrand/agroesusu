-- ============================================================================
-- Migration 00012: Ledger — Chart of Accounts
-- 
-- The Chart of Accounts defines every account in the platform's accounting system.
-- Each wallet gets its own liability account. System accounts (Safe Haven
-- settlement, fee revenue, etc.) are seeded here.
--
-- Account Types (standard accounting):
--   asset     — things the platform owns (cash at Safe Haven)
--   liability — things the platform owes (customer wallets, escrow)
--   equity    — owner's equity
--   revenue   — income (fees, interest income)
--   expense   — costs (interest paid, operational)
--
-- Normal Balance:
--   asset/expense: debit increases (debit is positive)
--   liability/equity/revenue: credit increases (credit is positive)
--
-- The customer's wallet balance = credit balance of their liability account
-- = credits - debits for that account.
--
-- DOWN PATH: DROP FUNCTION create_wallet_ledger_account;
--           DROP TRIGGER trg_wallet_create_ledger_account;
--           DROP TABLE accounts; DROP TYPE account_type;
-- ============================================================================

BEGIN;

CREATE TYPE account_type AS ENUM (
  'asset',
  'liability',
  'equity',
  'revenue',
  'expense'
);

CREATE TYPE account_category AS ENUM (
  -- System accounts (shared, not per-wallet)
  'safe_haven_settlement',
  'safe_haven_suspense',
  'fee_revenue',
  'interest_expense',
  'interest_revenue',
  'operational_expense',
  'owners_equity',
  'retained_earnings',
  -- Per-entity accounts (one per wallet/customer)
  'customer_wallet',
  'savings_holding',
  'loan_settlement',
  'investment_settlement',
  'escrow',
  -- Future
  'other'
);

CREATE TABLE public.accounts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_code        text NOT NULL UNIQUE,           -- Human-readable code (e.g., '1000', '2000.WAL-2026-000001')
  account_type        account_type NOT NULL,          -- asset, liability, equity, revenue, expense
  account_category    account_category NOT NULL,      -- Functional category
  name                text NOT NULL,                   -- Human-readable name
  description         text,
  
  -- Link to wallet (for per-wallet accounts only)
  owner_wallet_id     uuid REFERENCES public.wallets(id) ON DELETE RESTRICT,
  
  -- Hierarchy (optional — for parent-child relationships)
  parent_account_id   uuid REFERENCES public.accounts(id),
  
  -- Status
  is_system_account   boolean NOT NULL DEFAULT false, -- System accounts can't be deleted
  is_active           boolean NOT NULL DEFAULT true,
  
  -- Metadata
  metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  -- Tracing
  correlation_id      uuid NOT NULL DEFAULT gen_random_uuid(),
  
  -- Standard
  version             integer NOT NULL DEFAULT 1,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid REFERENCES auth.users(id),
  updated_by          uuid REFERENCES auth.users(id),
  
  -- Constraints
  CONSTRAINT chk_version_positive CHECK (version > 0),
  CONSTRAINT chk_code_not_empty CHECK (account_code <> ''),
  CONSTRAINT chk_name_not_empty CHECK (name <> '')
);

-- Indexes
CREATE INDEX idx_accounts_type ON public.accounts(account_type);
CREATE INDEX idx_accounts_category ON public.accounts(account_category);
CREATE INDEX idx_accounts_wallet ON public.accounts(owner_wallet_id) WHERE owner_wallet_id IS NOT NULL;
CREATE INDEX idx_accounts_active ON public.accounts(is_active) WHERE is_active = true;
CREATE INDEX idx_accounts_parent ON public.accounts(parent_account_id) WHERE parent_account_id IS NOT NULL;

-- ============================================================================
-- Seed: System Accounts (Chart of Accounts)
-- ============================================================================

INSERT INTO public.accounts (account_code, account_type, account_category, name, description, is_system_account) VALUES
  -- ASSETS
  ('1000', 'asset', 'safe_haven_settlement', 'Safe Haven Settlement Account', 
   'Cash held at Safe Haven MFB. Increases when customers deposit, decreases when they withdraw.', true),
  ('1001', 'asset', 'safe_haven_suspense', 'Safe Haven Suspense Account',
   'Temporary holding for pending/unconfirmed transactions at Safe Haven.', true),
   
  -- LIABILITIES (customer-facing)
  ('2000', 'liability', 'customer_wallet', 'Customer Wallet Accounts (Parent)',
   'Parent account for all customer wallet liability sub-accounts. Each wallet gets its own child account.', true),
  ('2001', 'liability', 'savings_holding', 'Savings Holding Accounts (Parent)',
   'Parent for savings product holding accounts. (Phase 5+)', true),
  ('2002', 'liability', 'loan_settlement', 'Loan Settlement Accounts (Parent)',
   'Parent for loan settlement accounts. (Phase 6+)', true),
  ('2003', 'liability', 'investment_settlement', 'Investment Settlement Accounts (Parent)',
   'Parent for investment settlement accounts. (Phase 7+)', true),
  ('2004', 'liability', 'escrow', 'Escrow Accounts (Parent)',
   'Parent for escrow accounts. (Future)', true),
   
  -- EQUITY
  ('3000', 'equity', 'owners_equity', 'Owners Equity',
   'Platform owners equity. (Future)', true),
  ('3001', 'equity', 'retained_earnings', 'Retained Earnings',
   'Accumulated platform profits. (Future)', true),
   
  -- REVENUE
  ('4000', 'revenue', 'fee_revenue', 'Fee Revenue',
   'Income from transaction fees, account fees, etc. (Future)', true),
  ('4001', 'revenue', 'interest_revenue', 'Interest Revenue',
   'Income from loan interest. (Future)', true),
   
  -- EXPENSE
  ('5000', 'expense', 'interest_expense', 'Interest Expense',
   'Interest paid to savers. (Future)', true),
  ('5001', 'expense', 'operational_expense', 'Operational Expense',
   'Platform operational expenses. (Future)', true);

-- ============================================================================
-- Auto-create ledger account when a wallet is provisioned
-- 
-- When a wallet's status transitions to 'active' and it doesn't have a
-- ledger account yet, this trigger creates one.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_wallet_ledger_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_id uuid;
  v_account_code text;
BEGIN
  -- Only create when wallet becomes active and has no ledger account
  IF NEW.status = 'active' AND (
    OLD.status IS DISTINCT FROM 'active' OR TG_OP = 'INSERT'
  ) THEN
    -- Check if account already exists for this wallet
    IF NOT EXISTS (
      SELECT 1 FROM public.accounts 
      WHERE owner_wallet_id = NEW.id AND account_category = 'customer_wallet'
    ) THEN
      -- Find the parent account
      SELECT id INTO v_parent_id 
      FROM public.accounts 
      WHERE account_code = '2000' AND account_category = 'customer_wallet';
      
      -- Generate unique account code: 2000.{wallet_number}
      v_account_code := '2000.' || NEW.wallet_number;
      
      INSERT INTO public.accounts (
        account_code, account_type, account_category, name,
        description, owner_wallet_id, parent_account_id,
        is_system_account, is_active, metadata
      ) VALUES (
        v_account_code, 'liability', 'customer_wallet',
        'Wallet: ' || NEW.wallet_number,
        'Customer wallet account for ' || NEW.wallet_number,
        NEW.id, v_parent_id,
        false, true,
        jsonb_build_object('wallet_number', NEW.wallet_number, 'customer_id', NEW.customer_id)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_wallet_create_ledger_account
  AFTER INSERT OR UPDATE OF status ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.create_wallet_ledger_account();

-- ============================================================================
-- Function: Get the ledger account for a wallet
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_wallet_account_id(p_wallet_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.accounts
  WHERE owner_wallet_id = p_wallet_id
    AND account_category = 'customer_wallet'
    AND is_active = true
  LIMIT 1;
$$;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
-- Accounts are readable by staff with wallet.read or super_admin.
-- Service role manages account creation (via trigger).
-- No customer should see the chart of accounts directly.

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY accounts_read_staff
  ON public.accounts FOR SELECT
  TO authenticated
  USING (public.has_permission('wallet.read') OR public.has_role('super_admin'));

COMMIT;

-- ============================================================================
-- DOWN PATH:
--   DROP FUNCTION get_account_balance(uuid);
--   DROP FUNCTION get_wallet_account_id(uuid);
--   DROP FUNCTION create_wallet_ledger_account();
--   DROP TRIGGER trg_wallet_create_ledger_account ON wallets;
--   DROP TABLE accounts;
--   DROP TYPE account_category;
--   DROP TYPE account_type;
-- ============================================================================
