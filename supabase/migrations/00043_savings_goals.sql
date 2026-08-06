-- ============================================================================
-- Migration 00043: Savings Goals (Pot Metadata)
--
-- Creates a savings_goals table linked to existing savings_accounts.
-- This extends — NOT replaces — the savings engine. Balance remains the
-- source of truth in savings_accounts. Progress is calculated dynamically.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.savings_goals (
  goal_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id       uuid NOT NULL REFERENCES public.savings_accounts(id) ON DELETE CASCADE,
  pot_name         text NOT NULL,
  target_amount    numeric(15,2) NOT NULL,
  target_date      timestamptz,
  monthly_target   numeric(15,2),
  status           text NOT NULL DEFAULT 'active',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT chk_sg_target_positive CHECK (target_amount > 0),
  CONSTRAINT chk_sg_monthly_positive CHECK (monthly_target IS NULL OR monthly_target > 0),
  CONSTRAINT chk_sg_status_valid CHECK (status IN ('active', 'archived'))
);

-- One active goal per savings account
CREATE UNIQUE INDEX IF NOT EXISTS idx_sg_account_active
  ON public.savings_goals(account_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_sg_account ON public.savings_goals(account_id);
CREATE INDEX IF NOT EXISTS idx_sg_status ON public.savings_goals(status);
CREATE INDEX IF NOT EXISTS idx_sg_created_at ON public.savings_goals(created_at);

-- Updated-at trigger
CREATE OR REPLACE FUNCTION public.handle_sg_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sg_updated_at
  BEFORE UPDATE ON public.savings_goals
  FOR EACH ROW EXECUTE FUNCTION public.handle_sg_updated_at();

-- When pot_name changes on savings_goals, sync to savings_accounts.pot_name
CREATE OR REPLACE FUNCTION public.sync_pot_name_to_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.pot_name IS DISTINCT FROM OLD.pot_name THEN
    UPDATE public.savings_accounts
    SET pot_name = NEW.pot_name
    WHERE id = NEW.account_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sg_sync_pot_name
  AFTER UPDATE OF pot_name ON public.savings_goals
  FOR EACH ROW EXECUTE FUNCTION public.sync_pot_name_to_account();

-- ============================================================================
-- RLS
-- ============================================================================
ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY sg_read_self
  ON public.savings_goals FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT sa.id FROM public.savings_accounts sa
      JOIN public.customers c ON sa.customer_id = c.id
      WHERE c.auth_id = auth.uid()
    )
  );

CREATE POLICY sg_read_staff
  ON public.savings_goals FOR SELECT
  TO authenticated
  USING (public.has_permission('wallet.read') OR public.has_role('super_admin'));

COMMIT;
