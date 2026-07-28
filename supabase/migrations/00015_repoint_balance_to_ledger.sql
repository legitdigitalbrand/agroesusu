-- ============================================================================
-- Migration 00015: Re-point wallet balance cache to Ledger
-- 
-- Phase 3 computed wallet balance from wallet_transactions (credits - debits).
-- Phase 4 changes the authority: balance is now computed from the Ledger
-- (journal_lines for the wallet's liability account).
-- 
-- This migration replaces refresh_wallet_balance_cache() to read from
-- get_account_balance() instead of wallet_transactions.
--
-- The wallet_transactions table remains as a READ MODEL — it's still populated
-- (now by the Orchestrator, not the event processor directly) — but it's no
-- longer the source of truth for balance computation.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.refresh_wallet_balance_cache(p_wallet_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_id    uuid;
  v_ledger_balance numeric(15,2);
  v_reserved      numeric(15,2);
  v_available     numeric(15,2);
BEGIN
  -- 1. Get the wallet's ledger account
  v_account_id := public.get_wallet_account_id(p_wallet_id);
  
  IF v_account_id IS NULL THEN
    -- No ledger account yet — balance stays at 0
    -- This happens for wallets that haven't been activated yet
    UPDATE public.wallets
    SET 
      cached_balance = 0,
      cached_available_balance = 0,
      cached_ledger_balance = 0,
      cached_balance_updated_at = now(),
      version = version + 1
    WHERE id = p_wallet_id;
    RETURN;
  END IF;
  
  -- 2. Get the ledger-derived balance for this account
  v_ledger_balance := public.get_account_balance(v_account_id);
  
  -- 3. Get current reserved balance
  SELECT COALESCE(reserved_balance, 0)
  INTO v_reserved
  FROM public.wallets
  WHERE id = p_wallet_id;
  
  -- 4. Available = ledger balance - reserved
  v_available := v_ledger_balance - v_reserved;
  
  -- 5. Update the cache
  UPDATE public.wallets
  SET 
    cached_balance = v_ledger_balance,
    cached_available_balance = v_available,
    cached_ledger_balance = v_ledger_balance,
    cached_balance_updated_at = now(),
    version = version + 1
  WHERE id = p_wallet_id;
END;
$$;

COMMIT;
