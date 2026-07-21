-- ============================================
-- AgroEsusu — Savings Product Rename Migration
-- Renames pot types: Flex→AgroFlex, Goal→AgroGoal, Seasonal+Stash→HarvestLock
-- Preserves all existing data and balances.
-- Run in Supabase Dashboard → SQL Editor
-- ============================================

-- Step 1: Drop existing CHECK constraint on savings_accounts.type (if exists)
-- The constraint name may vary — we use DO block to find and drop it
DO $$
BEGIN
  -- Drop any existing type-related CHECK constraints on savings_accounts
  ALTER TABLE savings_accounts DROP CONSTRAINT IF EXISTS savings_accounts_type_check;
  ALTER TABLE savings_accounts DROP CONSTRAINT IF EXISTS savings_accounts_type_check1;
  -- Try common patterns
  EXECUTE format(
    'ALTER TABLE savings_accounts DROP CONSTRAINT IF EXISTS %I',
    (SELECT conname FROM pg_constraint WHERE conrelid = 'savings_accounts'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%type%flex%')
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not drop constraint automatically: %', SQLERRM;
END $$;

-- Step 2: Rename existing pot types in the data
UPDATE savings_accounts SET type = 'agroflex' WHERE type = 'flex';
UPDATE savings_accounts SET type = 'agrogoal' WHERE type = 'goal';
UPDATE savings_accounts SET type = 'harvestlock' WHERE type = 'seasonal';
UPDATE savings_accounts SET type = 'harvestlock' WHERE type = 'stash';

-- Step 3: Also update the icon field if it stores the old type names
UPDATE savings_accounts SET icon = 'agroflex' WHERE icon = 'flex';
UPDATE savings_accounts SET icon = 'agrogoal' WHERE icon = 'goal';
UPDATE savings_accounts SET icon = 'harvestlock' WHERE icon = 'seasonal';
UPDATE savings_accounts SET icon = 'harvestlock' WHERE icon = 'stash';

-- Step 4: Add new CHECK constraint with the renamed types
ALTER TABLE savings_accounts ADD CONSTRAINT savings_accounts_type_check
  CHECK (type IN ('agroflex', 'harvestlock', 'agrogoal'));

-- Step 5: Add harvestlock_duration column for selectable lock terms
ALTER TABLE savings_accounts ADD COLUMN IF NOT EXISTS lock_duration_months INTEGER DEFAULT NULL;
-- Set default durations for migrated harvestlock pots
UPDATE savings_accounts SET lock_duration_months = 3 WHERE type = 'harvestlock' AND lock_duration_months IS NULL AND lock_type = 'none';
UPDATE savings_accounts SET lock_duration_months = 12 WHERE type = 'harvestlock' AND lock_duration_months IS NULL AND lock_type != 'none';

-- Step 6: Add renamed_products_notice flag to track which users have seen the rename notice
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS product_rename_seen BOOLEAN DEFAULT false;

-- ============================================
-- Verification queries (run to verify):
-- SELECT type, count(*) FROM savings_accounts GROUP BY type;
-- SELECT type, lock_duration_months, count(*) FROM savings_accounts WHERE type = 'harvestlock' GROUP BY type, lock_duration_months;
-- ============================================
