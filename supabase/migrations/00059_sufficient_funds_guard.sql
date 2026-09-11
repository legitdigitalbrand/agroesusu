-- ============================================================================
-- 00059 — SUFFICIENT-FUNDS GUARD AT POSTING TIME
--
-- THE INCIDENT (2026-09-11): a ₦100 savings-pot deposit was posted from a
-- wallet whose ledger balance was ₦0. The journal entry (Debit Wallet,
-- Credit Pot) posted successfully — no balance check existed anywhere — and
-- only the AFTERWARD wallet-cache refresh failed:
--   "new row for relation wallets violates check constraint
--    chk_cached_balance_nonneg"
-- The customer saw a failure, but the debit had already landed in the ledger
-- (wallet at -₦100), the FT was stuck at 'posted', and the pot was credited
-- for money that never existed in the wallet.
--
-- THE FIX (DB level, bulletproof):
--   post_journal_entry() now rejects any posting that would drive a
--   customer-facing LIABILITY account negative, BEFORE the entry is posted.
--   Because the check runs inside the posting transaction, the FT is marked
--   failed cleanly by the Orchestrator and NO money moves — the exact
--   invariant the wallet cache check constraint was trying to express,
--   enforced at the right place and time.
--
--   Affected account categories (customer funds — can never be negative):
--     customer_wallet, savings_holding, loan_settlement,
--     investment_settlement, escrow
--
-- CONCURRENCY: the affected account rows are locked FOR UPDATE before the
-- balance check, so two simultaneous debits of the same account serialize
-- instead of both passing the check (no TOCTOU window).
--
-- DOWN PATH: re-create post_journal_entry from 00013 (without this guard).
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.post_journal_entry(p_entry_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status journal_entry_status;
  v_debit_total numeric(15,2);
  v_credit_total numeric(15,2);
  v_line_count integer;
  v_account record;
BEGIN
  -- 1. Lock the entry and check status
  SELECT status INTO v_status
  FROM public.journal_entries
  WHERE id = p_entry_id
  FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Journal entry % not found', p_entry_id;
  END IF;

  IF v_status <> 'draft' THEN
    RAISE EXCEPTION 'Journal entry % is already % (must be draft to post)', p_entry_id, v_status;
  END IF;

  -- 2. Count lines and check amounts
  SELECT count(*),
         COALESCE(SUM(CASE WHEN entry_type = 'debit' THEN amount ELSE 0 END), 0),
         COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE 0 END), 0)
  INTO v_line_count, v_debit_total, v_credit_total
  FROM public.journal_lines
  WHERE journal_entry_id = p_entry_id;

  -- 3. Validate: at least 2 lines (minimum double-entry)
  IF v_line_count < 2 THEN
    RAISE EXCEPTION 'Cannot post journal entry %: must have at least 2 lines (found %)', p_entry_id, v_line_count;
  END IF;

  -- 4. Validate: zero-sum invariant (debits must equal credits)
  IF v_debit_total <> v_credit_total THEN
    RAISE EXCEPTION 'Cannot post journal entry %: debits (%) do not equal credits (%). Difference: %',
      p_entry_id, v_debit_total, v_credit_total, (v_debit_total - v_credit_total);
  END IF;

  -- 4b. SUFFICIENT-FUNDS GUARD (00059):
  --     Lock every customer-facing liability account this entry touches, then
  --     reject the posting if the projected balance would go negative. The
  --     lock serializes concurrent postings against the same account so the
  --     balance read cannot race another in-flight debit.
  PERFORM 1
  FROM public.accounts a
  JOIN public.journal_lines jl ON jl.account_id = a.id
  WHERE jl.journal_entry_id = p_entry_id
    AND a.account_type = 'liability'
    AND a.account_category IN (
      'customer_wallet', 'savings_holding', 'loan_settlement',
      'investment_settlement', 'escrow'
    )
  ORDER BY a.id
  FOR UPDATE OF a;

  FOR v_account IN
    SELECT jl.account_id,
           a.account_code,
           public.get_account_balance(jl.account_id) AS current_balance,
           SUM(CASE WHEN jl.entry_type = 'credit' THEN jl.amount ELSE -jl.amount END) AS net_delta
    FROM public.journal_lines jl
    JOIN public.accounts a ON a.id = jl.account_id
    WHERE jl.journal_entry_id = p_entry_id
      AND a.account_type = 'liability'
      AND a.account_category IN (
        'customer_wallet', 'savings_holding', 'loan_settlement',
        'investment_settlement', 'escrow'
      )
    GROUP BY jl.account_id, a.account_code
  LOOP
    IF v_account.current_balance + v_account.net_delta < 0 THEN
      RAISE EXCEPTION
        'INSUFFICIENT_FUNDS: posting journal entry % would drive customer account % (current balance %, delta %) negative',
        p_entry_id, v_account.account_code, v_account.current_balance, v_account.net_delta;
    END IF;
  END LOOP;

  -- 5. All checks passed — post the entry
  UPDATE public.journal_entries
  SET status = 'posted', posted_at = now()
  WHERE id = p_entry_id;
END;
$$;

COMMIT;
