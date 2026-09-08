-- ============================================================================
-- 00052: Fix journal entry posting (draft → posted)
--
-- ROOT CAUSE (first live deposit, 2026-09-08):
--   post_journal_entry() sets `posted_at = now()` when transitioning an entry
--   from draft → posted, but the enforce_je_status_transition() trigger raised
--   on ANY posted_at change — the two were written together in 00013 and
--   contradict each other, making posting structurally impossible. The first
--   real deposit webhook (₦100 to DVA 5019410362) reached the ledger and
--   failed with "Journal entries are immutable once created".
--
-- FIX:
--   1. Allow posted_at to be set exactly once — at the draft → posted
--      transition. It remains immutable in every other state.
--   2. Clean up orphaned DRAFT journal entries (and their lines) left by
--      failed posting attempts. Draft entries have no financial effect
--      (balances derive from posted entries only), but their lines are
--      INSERT-only guarded and the fk_je_transaction FK (RESTRICT) blocks
--      the orchestrator's idempotent retry from deleting the failed FT rows.
--      The line-guard triggers are disabled ONLY for the duration of this
--      transaction, scoped to draft-orphan cleanup, then re-enabled.
-- ============================================================================

BEGIN;

-- 1. Trigger: allow posted_at to change ONLY on draft → posted
CREATE OR REPLACE FUNCTION public.enforce_je_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow status column changes (and updated_at via trigger)
  -- Check if any column other than status, updated_at, version, reversed_by, reversed_at is changed
  -- posted_at is allowed to be set exactly once, at the draft → posted
  -- transition (the post_journal_entry() RPC sets it there).
  IF NEW.description IS DISTINCT FROM OLD.description
     OR NEW.entry_type IS DISTINCT FROM OLD.entry_type
     OR NEW.transaction_id IS DISTINCT FROM OLD.transaction_id
     OR NEW.source_module IS DISTINCT FROM OLD.source_module
     OR NEW.reverses IS DISTINCT FROM OLD.reverses
     OR NEW.reversal_reason IS DISTINCT FROM OLD.reversal_reason
     OR NEW.correlation_id IS DISTINCT FROM OLD.correlation_id
     OR NEW.metadata IS DISTINCT FROM OLD.metadata
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR (NEW.posted_at IS DISTINCT FROM OLD.posted_at
         AND NOT (OLD.status = 'draft' AND NEW.status = 'posted')) THEN
    RAISE EXCEPTION 'Journal entries are immutable once created. Only status, reversed_by, and reversed_at can change.';
  END IF;

  -- Enforce valid status transitions
  IF NEW.status = OLD.status THEN
    -- Status unchanged — allow (e.g., just updating reversed_by)
    RETURN NEW;
  END IF;

  IF OLD.status = 'draft' AND NEW.status = 'posted' THEN
    RETURN NEW;
  ELSIF OLD.status = 'posted' AND NEW.status = 'reversed' THEN
    RETURN NEW;
  ELSE
    RAISE EXCEPTION 'Invalid journal entry status transition: % → %. Allowed: draft→posted, posted→reversed.', OLD.status, NEW.status;
  END IF;
END;
$$;

-- 2. Orphaned-draft cleanup (no financial effect — balances come from
--    posted entries only). Guard triggers are disabled only inside this
--    transaction and re-enabled before COMMIT.
ALTER TABLE public.journal_lines DISABLE TRIGGER trg_journal_lines_no_modify;
ALTER TABLE public.journal_lines DISABLE TRIGGER trg_journal_lines_check_draft;
ALTER TABLE public.journal_entries DISABLE TRIGGER trg_journal_entries_no_modify;

DELETE FROM public.journal_lines
WHERE journal_entry_id IN (
  SELECT je.id
  FROM public.journal_entries je
  JOIN public.financial_transactions ft ON ft.id = je.transaction_id
  WHERE je.status = 'draft'
    AND ft.status = 'failed'
);

DELETE FROM public.journal_entries
WHERE status = 'draft'
  AND transaction_id IN (
    SELECT id FROM public.financial_transactions WHERE status = 'failed'
  );

ALTER TABLE public.journal_lines ENABLE TRIGGER trg_journal_lines_no_modify;
ALTER TABLE public.journal_lines ENABLE TRIGGER trg_journal_lines_check_draft;
ALTER TABLE public.journal_entries ENABLE TRIGGER trg_journal_entries_no_modify;

COMMIT;
