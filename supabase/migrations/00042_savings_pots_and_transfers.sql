-- ============================================================================
-- Migration 00042: Savings Pots (User-Created) + Transfer Tracking
--
-- 1. Add pot_name, pot_icon, pot_color to savings_accounts for user-created pots
-- 2. Add 'custom_pot' to savings_product_type enum
-- 3. Create transfers table for tracking bank-to-bank transfers
-- 4. Seed a "Custom Pot" product for user-created pots
-- ============================================================================

BEGIN;

-- ════════════════════════════════════════════════════════════
-- 1. Add custom pot columns to savings_accounts
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.savings_accounts
  ADD COLUMN IF NOT EXISTS pot_name text,
  ADD COLUMN IF NOT EXISTS pot_icon text DEFAULT 'piggybank',
  ADD COLUMN IF NOT EXISTS pot_color text DEFAULT 'indigo';

-- ════════════════════════════════════════════════════════════
-- 2. Add 'custom_pot' to the product type enum
-- ════════════════════════════════════════════════════════════
ALTER TYPE public.savings_product_type ADD VALUE IF NOT EXISTS 'custom_pot';

-- ════════════════════════════════════════════════════════════
-- 3. Create transfers table
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.transfers (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id           uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  wallet_id             uuid NOT NULL REFERENCES public.wallets(id) ON DELETE RESTRICT,

  -- Transfer details
  reference             text NOT NULL UNIQUE,
  debit_account_number  text NOT NULL,           -- Customer's wallet account number
  beneficiary_bank_code text NOT NULL,
  beneficiary_bank_name text NOT NULL,
  beneficiary_account_number text NOT NULL,
  beneficiary_account_name text NOT NULL,       -- Confirmed via name enquiry

  amount                numeric(15,2) NOT NULL,
  narration             text,
  payment_reference     text,

  -- Status tracking
  status                text NOT NULL DEFAULT 'pending',  -- pending, success, failed
  name_enquiry_session_id text,                           -- sessionId from name enquiry
  provider_response     jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Tracing
  correlation_id        uuid NOT NULL DEFAULT gen_random_uuid(),
  metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Standard
  version               integer NOT NULL DEFAULT 1,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  created_by            uuid REFERENCES auth.users(id),

  CONSTRAINT chk_tr_amount_positive CHECK (amount > 0),
  CONSTRAINT chk_tr_version_positive CHECK (version > 0)
);

CREATE INDEX IF NOT EXISTS idx_tr_customer ON public.transfers(customer_id);
CREATE INDEX IF NOT EXISTS idx_tr_wallet ON public.transfers(wallet_id);
CREATE INDEX IF NOT EXISTS idx_tr_status ON public.transfers(status);
CREATE INDEX IF NOT EXISTS idx_tr_reference ON public.transfers(reference);
CREATE INDEX IF NOT EXISTS idx_tr_created_at ON public.transfers(created_at);

-- RLS for transfers
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY tr_read_self
  ON public.transfers FOR SELECT
  TO authenticated
  USING (
    customer_id IN (
      SELECT c.id FROM public.customers c WHERE c.auth_id = auth.uid()
    )
  );

CREATE POLICY tr_read_staff
  ON public.transfers FOR SELECT
  TO authenticated
  USING (public.has_permission('wallet.read') OR public.has_role('super_admin'));

-- ════════════════════════════════════════════════════════════
-- 4. Seed a "Custom Pot" product for user-created pots
--    This is the product that user-created pots reference.
--    Each pot gets its own terms (lock date, rate) via the terms snapshot.
-- ════════════════════════════════════════════════════════════
INSERT INTO public.savings_products (
  product_code, product_name, product_type, description,
  interest_method, interest_rate, interest_cadence,
  minimum_balance, minimum_deposit, maximum_deposit,
  withdrawal_allowed, lock_period_days, early_withdrawal_penalty_rate, early_withdrawal_allowed,
  term_days, is_active, is_featured, metadata
) VALUES (
  'CUSTOM-POT', 'Custom Savings Pot', 'custom_pot',
  'Create your own savings pot with a custom name, lock period, and target. Perfect for setting aside money for specific agricultural goals.',
  'compound', 4.0000, 'daily',
  0, 100, NULL,
  true, 0, 2.00, true,
  NULL, true, false,
  '{"is_custom": true, "badge": "Custom", "color": "#10B981"}'
)
ON CONFLICT (product_code) DO NOTHING;

COMMIT;
