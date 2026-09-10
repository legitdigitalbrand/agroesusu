-- ============================================================================
-- 00055 — Backfill withdrawal_allowed into existing savings terms snapshots
--
-- BUG: openAccount()/createCustomPot() captured a terms snapshot that omitted
-- `withdrawal_allowed` (and the validator treats a missing key as "no
-- withdrawals"), so EVERY savings account — flexible pots and fixed deposits
-- alike — failed withdrawal validation with "Withdrawals are not allowed for
-- this savings product", even when the product itself allowed withdrawals.
--
-- The snapshot builder now includes the field (code fix). This migration
-- repairs accounts opened before the fix by merging the product's current
-- `withdrawal_allowed` value into each existing snapshot (only when the key
-- is missing — we never overwrite an explicitly snapshotted value).
--
-- Emergency withdrawals: the validator now lets `emergency: true` bypass the
-- withdrawal_allowed gate entirely (interest is forfeited instead), which is
-- the intended "early exit with principal returned" behaviour for fixed
-- deposits. No data change needed for that — code-only.
-- ============================================================================

BEGIN;

UPDATE public.savings_accounts AS sa
SET product_terms_snapshot = sa.product_terms_snapshot
      || jsonb_build_object('withdrawal_allowed', sp.withdrawal_allowed),
    updated_at = now()
FROM public.savings_products AS sp
WHERE sp.id = sa.product_id
  AND NOT (sa.product_terms_snapshot ? 'withdrawal_allowed');

-- Sanity: how many snapshots still lack the key after the backfill?
-- (Should be zero rows — only orphaned product_id rows could remain.)
DO $$
DECLARE
  missing_count integer;
BEGIN
  SELECT count(*) INTO missing_count
  FROM public.savings_accounts
  WHERE NOT (product_terms_snapshot ? 'withdrawal_allowed');

  IF missing_count > 0 THEN
    RAISE NOTICE '00055: % account(s) still lack withdrawal_allowed (orphaned product_id?)', missing_count;
  END IF;
END $$;

COMMIT;
