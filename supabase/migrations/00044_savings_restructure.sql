-- ============================================================================
-- Migration 00044: Savings Architecture Restructure
--
-- Corrects the product hierarchy:
--   - Savings Pot is no longer a separate product. It's an optional goal
--     configuration on Flexible Savings.
--   - Fixed Deposit is restored as a customer-facing product.
--   - Goal metadata moves from savings_goals table to savings_accounts columns.
--
-- No data is lost. All existing balances are preserved.
-- ============================================================================

BEGIN;

-- 1. Add goal columns to savings_accounts
ALTER TABLE public.savings_accounts
  ADD COLUMN IF NOT EXISTS goal_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS goal_date timestamptz,
  ADD COLUMN IF NOT EXISTS monthly_target numeric(15,2);

-- Add check constraint: monthly_target must be positive if set
ALTER TABLE public.savings_accounts
  ADD CONSTRAINT chk_sa_monthly_target CHECK (monthly_target IS NULL OR monthly_target > 0);

-- 2. Get the FLEX product ID for migration
DO $$
DECLARE
  flex_product_id uuid;
  custom_pot_product_id uuid;
BEGIN
  SELECT id INTO flex_product_id FROM public.savings_products WHERE product_code = 'FLEX' LIMIT 1;
  SELECT id INTO custom_pot_product_id FROM public.savings_products WHERE product_code = 'CUSTOM-POT' LIMIT 1;

  -- 3. Migrate existing custom_pot accounts → flexible with goal_enabled = true
  IF custom_pot_product_id IS NOT NULL AND flex_product_id IS NOT NULL THEN
    UPDATE public.savings_accounts
    SET
      product_id = flex_product_id,
      goal_enabled = true,
      target_amount = COALESCE(target_amount, sg.target_amount),
      goal_date = sg.target_date,
      monthly_target = sg.monthly_target,
      pot_name = COALESCE(savings_accounts.pot_name, sg.pot_name)
    FROM public.savings_goals sg
    WHERE savings_accounts.product_id = custom_pot_product_id
      AND sg.account_id = savings_accounts.id
      AND sg.status = 'active';

    -- For any custom_pot accounts without a savings_goals row, still convert to flexible
    UPDATE public.savings_accounts
    SET
      product_id = flex_product_id,
      goal_enabled = CASE WHEN target_amount IS NOT NULL AND target_amount > 0 THEN true ELSE false END
    WHERE product_id = custom_pot_product_id;
  END IF;

  -- 4. Deactivate the CUSTOM-POT product
  UPDATE public.savings_products
  SET is_active = false
  WHERE product_code = 'CUSTOM-POT';

  -- 5. Create FD-180 and FD-365 products if they don't exist
  INSERT INTO public.savings_products (
    product_code, product_name, product_type, description,
    interest_method, interest_rate, interest_cadence,
    minimum_balance, minimum_deposit, maximum_deposit,
    withdrawal_allowed, lock_period_days,
    early_withdrawal_penalty_rate, early_withdrawal_allowed,
    term_days, is_active, is_featured, min_kyc_level, metadata
  )
  SELECT
    'FD-180', 'Fixed Deposit (180 Days)', 'fixed_deposit',
    'Lock your money for 180 days and earn a higher interest rate. Early withdrawal incurs a penalty.',
    'flat', 14.0, 'maturity',
    5000.0, 5000.0, 10000000.0,
    true, 180, 2.0, true,
    180, true, false, 'L1',
    '{"badge": "High Yield", "color": "#3B82F6", "term_label": "180 days"}'
  WHERE NOT EXISTS (SELECT 1 FROM public.savings_products WHERE product_code = 'FD-180');

  INSERT INTO public.savings_products (
    product_code, product_name, product_type, description,
    interest_method, interest_rate, interest_cadence,
    minimum_balance, minimum_deposit, maximum_deposit,
    withdrawal_allowed, lock_period_days,
    early_withdrawal_penalty_rate, early_withdrawal_allowed,
    term_days, is_active, is_featured, min_kyc_level, metadata
  )
  SELECT
    'FD-365', 'Fixed Deposit (365 Days)', 'fixed_deposit',
    'Lock your money for 365 days and earn the highest interest rate. Early withdrawal incurs a penalty.',
    'flat', 16.0, 'maturity',
    5000.0, 5000.0, 10000000.0,
    true, 365, 2.0, true,
    365, true, true, 'L1',
    '{"badge": "Highest Yield", "color": "#3B82F6", "term_label": "365 days"}'
  WHERE NOT EXISTS (SELECT 1 FROM public.savings_products WHERE product_code = 'FD-365');

  -- 6. Set term_days on FD-90 if it's null
  UPDATE public.savings_products
  SET term_days = 90
  WHERE product_code = 'FD-90' AND term_days IS NULL;

END $$;

-- 7. Rename target_amount to goal_amount for clarity (keep both for backwards compat)
-- Actually, we'll keep target_amount as the column name since renaming is risky.
-- The code will use target_amount as goal_amount.

COMMIT;
