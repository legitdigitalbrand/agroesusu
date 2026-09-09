-- ============================================================================
-- 00054: Fix wallet history for sends (single-payout-engine withdrawals)
--
-- SYMPTOM: one transfer showed TWO history rows, both with transaction_type
-- 'unknown' and internal narration ("Withdrawal reservation: WDL-… to …").
--
-- ROOT CAUSES:
--   1. The send flow posts two orchestrator transactions:
--        wallet_withdrawal_reservation  (D wallet, C escrow — wallet-facing)
--        wallet_withdrawal_settlement   (D escrow, C settlement — internal)
--      Both created wallet_transactions rows, so one customer transfer
--      appeared as two debits.
--   2. The internal types were missing from WALLET_TX_TYPE_MAP, so the
--      read-model rows were saved as 'unknown'.
--   3. The UI read a `description` column that does not exist (the column is
--      `narration`), so the fallback label 'unknown' was displayed.
--
-- FIX (code, in this release): settlement leg no longer writes a history row;
-- reservation leg is mapped to 'withdrawal'; narration is customer-facing.
-- FIX (data, this migration): delete the phantom settlement rows and relabel
-- the reservation rows. wallet_transactions is a read model derived from the
-- posted journal entries — deleting phantom rows does not move money.
-- ============================================================================

BEGIN;

-- 1. Remove the phantom settlement-leg rows (escrow → settlement movement
--    that never touched the customer's wallet account).
DELETE FROM public.wallet_transactions wt
  USING public.financial_transactions ft
  WHERE wt.internal_reference = ft.id::text
    AND ft.transaction_type = 'wallet_withdrawal_settlement';

-- 2. Relabel the reservation-leg rows as proper withdrawals with a
--    customer-facing narration ("Transfer to <beneficiary>").
UPDATE public.wallet_transactions wt
SET transaction_type = 'withdrawal',
    narration = CASE
      WHEN COALESCE(wt.metadata->>'beneficiary', '') <> ''
        THEN 'Transfer to ' || (wt.metadata->>'beneficiary')
      ELSE wt.narration
    END
FROM public.financial_transactions ft
WHERE wt.internal_reference = ft.id::text
  AND ft.transaction_type = 'wallet_withdrawal_reservation'
  AND (wt.transaction_type = 'unknown' OR wt.narration LIKE 'Withdrawal reservation%');

-- 3. Populate the counterparty fields on those rows where we have the data,
--    so the UI can show who the money went to.
UPDATE public.wallet_transactions wt
SET counterparty_account_name = COALESCE(wt.counterparty_account_name, wt.metadata->>'beneficiary')
FROM public.financial_transactions ft
WHERE wt.internal_reference = ft.id::text
  AND ft.transaction_type = 'wallet_withdrawal_reservation'
  AND COALESCE(wt.metadata->>'beneficiary', '') <> ''
  AND wt.counterparty_account_name IS NULL;

COMMIT;
