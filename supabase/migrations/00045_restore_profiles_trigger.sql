-- ============================================================================
-- Migration 00045: Restore profiles auto-creation trigger + backfill
--
-- ROOT CAUSE FIX: Migration 00002 dropped the handle_new_user function and
-- on_auth_user_created trigger that auto-created a profiles row on signup.
-- No subsequent migration recreated them. Users who signed up after the DB
-- reset have NO profiles row, which means:
--   - kyc_tier can never be set (UPDATE on non-existent row = silent no-op)
--   - /api/me returns kyc_level = 0 forever
--   - Onboarding shows BVN form in an infinite loop
--   - Profile editing silently fails
--
-- This migration:
--   1. Recreates the handle_new_user() function
--   2. Recreates the on_auth_user_created trigger
--   3. Backfills profiles rows for existing auth.users who don't have one
--   4. Repairs kyc_tier for customers who verified BVN but are stuck at tier_0
--   5. Activates customer status for customers with verified BVN
--
-- Idempotent: safe to run multiple times.
-- ============================================================================

BEGIN;

-- 1. Recreate the handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    COALESCE(new.raw_user_meta_data->>'phone', new.phone, '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

-- 2. Recreate the trigger (drop first for idempotency)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Backfill: Create profiles rows for existing auth users who don't have one
INSERT INTO public.profiles (id, full_name, email, phone)
SELECT
  au.id,
  COALESCE(au.raw_user_meta_data->>'full_name', ''),
  au.email,
  COALESCE(au.raw_user_meta_data->>'phone', au.phone, '')
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = au.id
)
ON CONFLICT (id) DO NOTHING;

-- 4. Repair: sync kyc_tier for customers who have BVN verified but kyc_tier is tier_0
UPDATE public.profiles p
SET kyc_tier = 'tier_1',
    kyc_verified_at = COALESCE(p.kyc_verified_at, now()),
    updated_at = now()
FROM public.customers c
WHERE c.auth_id = p.id
  AND c.bvn IS NOT NULL
  AND p.kyc_tier = 'tier_0';

-- 5. Activate customer status for customers with BVN who are still 'registered'
UPDATE public.customers
SET status = 'active',
    activation_date = COALESCE(activation_date, now()),
    updated_at = now()
WHERE bvn IS NOT NULL
  AND status = 'registered';

COMMIT;
