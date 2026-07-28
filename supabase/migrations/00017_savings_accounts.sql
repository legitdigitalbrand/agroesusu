-- ============================================================================
-- Migration 00017: Savings Accounts
-- 
-- A customer's instance of a savings product. Each account:
--   - References the product config (product_id)
--   - Has its own ledger account (under parent 2001 — Savings Holding)
--   - Tracks lifecycle status (pending → active → matured → withdrawn/closed)
--   - Captures a snapshot of key product terms at opening (so config changes
--     don't retroactively affect existing accounts)
-- ============================================================================

BEGIN;

CREATE TYPE savings_account_status AS ENUM (
  'pending',      -- Account created but not yet funded (no first deposit)
  'active',       -- Account is active, receiving deposits
  'matured',      -- Fixed deposit has reached maturity (ready for withdrawal/rollover)
  'withdrawn',    -- Account fully withdrawn (balance = 0, account closed)
  'closed',       -- Account closed by customer or admin
  'dormant'       -- No activity for extended period (future)
);

CREATE TABLE public.savings_accounts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_number        text NOT NULL UNIQUE,           -- SAV-YYYY-NNNNNNNN
  customer_id           uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  wallet_id             uuid NOT NULL REFERENCES public.wallets(id) ON DELETE RESTRICT,
  product_id            uuid NOT NULL REFERENCES public.savings_products(id) ON DELETE RESTRICT,
  
  -- Lifecycle
  status                savings_account_status NOT NULL DEFAULT 'pending',
  opened_at             timestamptz,
  maturity_date         timestamptz,                     -- For fixed deposits
  closed_at             timestamptz,
  
  -- Term snapshot (captured at opening — config changes don't affect existing accounts)
  product_terms_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Contains: {interest_rate, interest_method, interest_cadence, lock_period_days,
  --            early_withdrawal_penalty_rate, minimum_balance, term_days}
  
  -- Interest tracking
  total_interest_earned numeric(15,2) NOT NULL DEFAULT 0,  -- Cumulative interest posted
  last_interest_accrued_at timestamptz,                    -- Last accrual timestamp
  next_accrual_at       timestamptz,                        -- Next scheduled accrual
  
  -- Group/Esusu-specific
  group_id              uuid,                               -- Links to group (Phase 7)
  
  -- Target savings
  target_amount         numeric(15,2),                      -- Goal amount (for Target Savings)
  
  -- Tracing
  correlation_id        uuid NOT NULL DEFAULT gen_random_uuid(),
  metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  -- Standard
  version               integer NOT NULL DEFAULT 1,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  created_by            uuid REFERENCES auth.users(id),
  updated_by            uuid REFERENCES auth.users(id),
  
  CONSTRAINT chk_sa_version_positive CHECK (version > 0),
  CONSTRAINT chk_sa_ref_format CHECK (account_number ~ '^SAV-[0-9]{4}-[0-9]{8}$'),
  CONSTRAINT chk_sa_target_positive CHECK (target_amount IS NULL OR target_amount > 0)
);

CREATE SEQUENCE IF NOT EXISTS public.savings_account_ref_seq;

CREATE OR REPLACE FUNCTION public.generate_sa_reference()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'SAV-' || EXTRACT(YEAR FROM now())::text || '-' || 
         lpad(nextval('savings_account_ref_seq')::text, 8, '0');
$$;

CREATE OR REPLACE FUNCTION public.set_sa_reference()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.account_number IS NULL OR NEW.account_number = '' THEN
    NEW.account_number := public.generate_sa_reference();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sa_set_reference
  BEFORE INSERT ON public.savings_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_sa_reference();

CREATE TRIGGER trg_sa_updated_at
  BEFORE UPDATE ON public.savings_accounts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Indexes
CREATE INDEX idx_sa_customer ON public.savings_accounts(customer_id);
CREATE INDEX idx_sa_wallet ON public.savings_accounts(wallet_id);
CREATE INDEX idx_sa_product ON public.savings_accounts(product_id);
CREATE INDEX idx_sa_status ON public.savings_accounts(status);
CREATE INDEX idx_sa_group ON public.savings_accounts(group_id) WHERE group_id IS NOT NULL;
CREATE INDEX idx_sa_maturity ON public.savings_accounts(maturity_date) WHERE maturity_date IS NOT NULL;
CREATE INDEX idx_sa_next_accrual ON public.savings_accounts(next_accrual_at) WHERE next_accrual_at IS NOT NULL AND status = 'active';
CREATE INDEX idx_sa_created_at ON public.savings_accounts(created_at);

-- ============================================================================
-- Auto-create ledger account for savings accounts
-- 
-- When a savings account's status transitions to 'active', this trigger
-- creates a child liability account under parent 2001 (Savings Holding).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_savings_ledger_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_id uuid;
  v_account_code text;
BEGIN
  IF NEW.status = 'active' AND (
    OLD.status IS DISTINCT FROM 'active' OR TG_OP = 'INSERT'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.accounts 
      WHERE metadata->>'savings_account_id' = NEW.id::text
        AND account_category = 'savings_holding'
    ) THEN
      SELECT id INTO v_parent_id 
      FROM public.accounts 
      WHERE account_code = '2001' AND account_category = 'savings_holding';
      
      v_account_code := '2001.' || NEW.account_number;
      
      INSERT INTO public.accounts (
        account_code, account_type, account_category, name,
        description, parent_account_id,
        is_system_account, is_active, metadata
      ) VALUES (
        v_account_code, 'liability', 'savings_holding',
        'Savings: ' || NEW.account_number,
        'Savings holding account for ' || NEW.account_number,
        v_parent_id,
        false, true,
        jsonb_build_object('savings_account_id', NEW.id::text, 'customer_id', NEW.customer_id::text, 'product_id', NEW.product_id::text)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sa_create_ledger_account
  AFTER INSERT OR UPDATE OF status ON public.savings_accounts
  FOR EACH ROW EXECUTE FUNCTION public.create_savings_ledger_account();

-- ============================================================================
-- Function: Get the ledger account for a savings account
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_savings_account_id(p_savings_account_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.accounts
  WHERE metadata->>'savings_account_id' = p_savings_account_id::text
    AND account_category = 'savings_holding'
    AND is_active = true
  LIMIT 1;
$$;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.savings_accounts ENABLE ROW LEVEL SECURITY;

-- Customers can see their own savings accounts
CREATE POLICY sa_read_self
  ON public.savings_accounts FOR SELECT
  TO authenticated
  USING (
    customer_id IN (
      SELECT c.id FROM public.customers c WHERE c.auth_id = auth.uid()
    )
  );

-- Staff with wallet.read can see all
CREATE POLICY sa_read_staff
  ON public.savings_accounts FOR SELECT
  TO authenticated
  USING (public.has_permission('wallet.read') OR public.has_role('super_admin'));

COMMIT;
