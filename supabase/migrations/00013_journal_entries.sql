-- ============================================================================
-- Migration 00013: Ledger — Journal Entries & Journal Lines
-- 
-- The core of the double-entry accounting system.
--
-- IMMUTABILITY RULES (enforced at DB level):
--   1. Journal lines are INSERT-only. No UPDATE, no DELETE. Ever.
--   2. Journal entries can only transition: draft → posted → reversed.
--      No other status changes allowed.
--   3. Lines can only be INSERTed when the parent entry is 'draft'.
--   4. The post_journal_entry() function validates zero-sum before posting.
--   5. Once posted, the entry's lines cannot be modified (they're locked).
--
-- ZERO-SUM INVARIANT (enforced at DB level):
--   The post_journal_entry() function checks that SUM(debits) = SUM(credits)
--   for all lines belonging to the entry. If not, it raises an exception
--   and the entry stays as 'draft' (not posted, not included in balances).
--
-- REVERSAL MECHANISM:
--   Reversals create a NEW journal entry with opposite debits/credits.
--   The original entry is marked as 'reversed' (not deleted, not modified).
--   The reversal entry references the original via 'reverses' column.
--   The original references the reversal via 'reversed_by' column.
--   Net effect on balance: zero (original + reversal = 0).
--
-- DOWN PATH: DROP FUNCTION reverse_journal_entry;
--           DROP FUNCTION post_journal_entry;
--           DROP TRIGGER trg_journal_lines_no_modify;
--           DROP TRIGGER trg_journal_lines_check_draft;
--           DROP TRIGGER trg_journal_entries_no_modify;
--           DROP TABLE journal_lines;
--           DROP TABLE journal_entries;
--           DROP TYPE journal_entry_status;
--           DROP TYPE journal_entry_type;
--           DROP TYPE entry_type;
-- ============================================================================

BEGIN;

-- Entry types (debit or credit)
CREATE TYPE entry_type AS ENUM ('debit', 'credit');

-- Journal entry status lifecycle: draft → posted → reversed
CREATE TYPE journal_entry_status AS ENUM (
  'draft',     -- Lines being added, not yet validated
  'posted',    -- Validated (zero-sum confirmed), lines are immutable
  'reversed'   -- A reversal entry has been posted referencing this one
);

-- What kind of journal entry this is
CREATE TYPE journal_entry_type AS ENUM (
  'standard',    -- Normal double-entry posting
  'reversal',    -- Reverses a previous entry (opposite debits/credits)
  'adjustment',  -- Manual adjustment (with approval, creates audit trail)
  'opening',     -- Opening balance entry (system initialization)
  'closing'      -- Period closing entry (future)
);

-- ============================================================================
-- JOURNAL ENTRIES
-- ============================================================================

CREATE TABLE public.journal_entries (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_reference     text NOT NULL UNIQUE,           -- JE-YYYY-NNNNNNNN
  entry_type          journal_entry_type NOT NULL DEFAULT 'standard',
  status              journal_entry_status NOT NULL DEFAULT 'draft',
  
  -- Description / metadata
  description         text NOT NULL,
  transaction_id      uuid,                           -- FK to financial_transactions (FTO) — added in migration 00014
  source_module       text NOT NULL DEFAULT 'orchestrator',  -- Which module initiated this
  
  -- Reversal tracking
  reverses            uuid REFERENCES public.journal_entries(id),  -- If this is a reversal, points to original
  reversed_by         uuid REFERENCES public.journal_entries(id),  -- If this was reversed, points to the reversal
  reversal_reason     text,
  
  -- Tracing
  correlation_id      uuid NOT NULL DEFAULT gen_random_uuid(),
  metadata           jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  -- Timestamps
  posted_at           timestamptz,                     -- When status changed to 'posted'
  reversed_at         timestamptz,                    -- When marked as 'reversed'
  
  -- Standard
  version             integer NOT NULL DEFAULT 1,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid REFERENCES auth.users(id),
  updated_by          uuid REFERENCES auth.users(id),
  
  CONSTRAINT chk_je_version_positive CHECK (version > 0),
  CONSTRAINT chk_je_ref_format CHECK (entry_reference ~ '^JE-[0-9]{4}-[0-9]{8}$')
);

-- Sequence for entry reference generation
CREATE SEQUENCE IF NOT EXISTS public.journal_entry_ref_seq;

CREATE OR REPLACE FUNCTION public.generate_je_reference()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'JE-' || EXTRACT(YEAR FROM now())::text || '-' || 
         lpad(nextval('journal_entry_ref_seq')::text, 8, '0');
$$;

CREATE OR REPLACE FUNCTION public.set_je_reference()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.entry_reference IS NULL OR NEW.entry_reference = '' THEN
    NEW.entry_reference := public.generate_je_reference();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_je_set_reference
  BEFORE INSERT ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_je_reference();

CREATE TRIGGER trg_je_updated_at
  BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Indexes
CREATE INDEX idx_je_status ON public.journal_entries(status);
CREATE INDEX idx_je_transaction ON public.journal_entries(transaction_id) WHERE transaction_id IS NOT NULL;
CREATE INDEX idx_je_reverses ON public.journal_entries(reverses) WHERE reverses IS NOT NULL;
CREATE INDEX idx_je_reversed_by ON public.journal_entries(reversed_by) WHERE reversed_by IS NOT NULL;
CREATE INDEX idx_je_created_at ON public.journal_entries(created_at);
CREATE INDEX idx_je_correlation ON public.journal_entries(correlation_id);
CREATE INDEX idx_je_source_module ON public.journal_entries(source_module);

-- ============================================================================
-- JOURNAL LINES
-- ============================================================================

CREATE TABLE public.journal_lines (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id    uuid NOT NULL REFERENCES public.journal_entries(id) ON DELETE RESTRICT,
  account_id          uuid NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  entry_type          entry_type NOT NULL,           -- 'debit' or 'credit'
  amount              numeric(15,2) NOT NULL,
  description         text,
  line_order          integer NOT NULL,               -- Order within the entry (for readability)
  
  -- Standard
  created_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid REFERENCES auth.users(id),
  
  -- Constraints
  CONSTRAINT chk_jl_amount_positive CHECK (amount > 0),
  CONSTRAINT chk_jl_order_positive CHECK (line_order > 0)
);

-- Indexes
CREATE INDEX idx_jl_entry ON public.journal_lines(journal_entry_id);
CREATE INDEX idx_jl_account ON public.journal_lines(account_id);
CREATE INDEX idx_jl_entry_type ON public.journal_lines(entry_type);
CREATE INDEX idx_jl_created_at ON public.journal_lines(created_at);

-- ============================================================================
-- IMMUTABILITY TRIGGERS
-- ============================================================================

-- 1. Journal lines: INSERT-only. No UPDATE, no DELETE. EVER.
CREATE OR REPLACE FUNCTION public.prevent_journal_line_modify()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Journal lines are INSERT-only. UPDATE and DELETE are not allowed. Use a reversing entry to correct.';
END;
$$;

CREATE TRIGGER trg_journal_lines_no_modify
  BEFORE UPDATE OR DELETE ON public.journal_lines
  FOR EACH ROW EXECUTE FUNCTION public.prevent_journal_line_modify();

-- 2. Journal lines: can only be INSERTed when parent entry is 'draft'
CREATE OR REPLACE FUNCTION public.check_line_parent_draft()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status journal_entry_status;
BEGIN
  SELECT status INTO v_status FROM public.journal_entries WHERE id = NEW.journal_entry_id;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Parent journal entry not found';
  END IF;
  IF v_status <> 'draft' THEN
    RAISE EXCEPTION 'Cannot add lines to a % journal entry. Lines can only be added to draft entries.', v_status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_journal_lines_check_draft
  BEFORE INSERT ON public.journal_lines
  FOR EACH ROW EXECUTE FUNCTION public.check_line_parent_draft();

-- 3. Journal entries: only allow status transitions draft→posted→reversed
CREATE OR REPLACE FUNCTION public.enforce_je_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow status column changes (and updated_at via trigger)
  -- Check if any column other than status, updated_at, version, reversed_by, reversed_at is changed
  IF NEW.description IS DISTINCT FROM OLD.description 
     OR NEW.entry_type IS DISTINCT FROM OLD.entry_type
     OR NEW.transaction_id IS DISTINCT FROM OLD.transaction_id
     OR NEW.source_module IS DISTINCT FROM OLD.source_module
     OR NEW.reverses IS DISTINCT FROM OLD.reverses
     OR NEW.reversal_reason IS DISTINCT FROM OLD.reversal_reason
     OR NEW.correlation_id IS DISTINCT FROM OLD.correlation_id
     OR NEW.metadata IS DISTINCT FROM OLD.metadata
     OR NEW.posted_at IS DISTINCT FROM OLD.posted_at
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
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

CREATE TRIGGER trg_journal_entries_no_modify
  BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.enforce_je_status_transition();

-- ============================================================================
-- POST JOURNAL ENTRY FUNCTION
-- 
-- This is the ONLY way to transition a journal entry from 'draft' to 'posted'.
-- It validates:
--   1. The entry exists and is in 'draft' status
--   2. At least 2 lines exist (minimum for double-entry)
--   3. SUM(debits) = SUM(credits) (zero-sum invariant)
--   4. All amounts are positive
--
-- If validation passes: status → 'posted', posted_at = now()
-- If validation fails: raises exception, entry stays 'draft'
-- ============================================================================

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
  
  -- 5. All checks passed — post the entry
  UPDATE public.journal_entries
  SET status = 'posted', posted_at = now()
  WHERE id = p_entry_id;
END;
$$;

-- ============================================================================
-- REVERSE JOURNAL ENTRY FUNCTION
-- 
-- Creates a new journal entry that reverses the original.
-- - Copies all lines from the original but swaps debit ↔ credit
-- - Posts the new entry (validates zero-sum)
-- - Marks the original as 'reversed'
-- - Links both entries via reverses/reversed_by
-- 
-- The original entry's lines are NOT modified (immutability preserved).
-- The net balance effect: original + reversal = 0.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reverse_journal_entry(
  p_original_id uuid,
  p_reason text,
  p_created_by uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_original_status journal_entry_status;
  v_reversal_id uuid;
  v_reversal_ref text;
  v_original_ref text;
BEGIN
  -- 1. Lock and check the original
  SELECT status, entry_reference INTO v_original_status, v_original_ref
  FROM public.journal_entries
  WHERE id = p_original_id
  FOR UPDATE;
  
  IF v_original_status IS NULL THEN
    RAISE EXCEPTION 'Journal entry % not found', p_original_id;
  END IF;
  
  IF v_original_status <> 'posted' THEN
    RAISE EXCEPTION 'Can only reverse posted entries. Entry % is %', p_original_id, v_original_status;
  END IF;
  
  -- Check if already reversed
  IF EXISTS (SELECT 1 FROM public.journal_entries WHERE reverses = p_original_id) THEN
    RAISE EXCEPTION 'Journal entry % has already been reversed', p_original_id;
  END IF;
  
  -- 2. Create the reversal entry (draft status)
  v_reversal_ref := public.generate_je_reference();
  
  INSERT INTO public.journal_entries (
    entry_reference, entry_type, status, description,
    source_module, reverses, reversal_reason, created_by
  ) VALUES (
    v_reversal_ref, 'reversal', 'draft',
    'REVERSAL of ' || v_original_ref || ': ' || p_reason,
    'orchestrator', p_original_id, p_reason, p_created_by
  )
  RETURNING id INTO v_reversal_id;
  
  -- 3. Copy lines with swapped entry_type (debit↔credit)
  INSERT INTO public.journal_lines (journal_entry_id, account_id, entry_type, amount, description, line_order, created_by)
  SELECT 
    v_reversal_id, 
    account_id,
    CASE WHEN entry_type = 'debit' THEN 'credit'::entry_type ELSE 'debit'::entry_type END,
    amount,
    'REVERSAL: ' || COALESCE(description, ''),
    line_order,
    p_created_by
  FROM public.journal_lines
  WHERE journal_entry_id = p_original_id
  ORDER BY line_order;
  
  -- 4. Post the reversal entry (validates zero-sum internally)
  PERFORM public.post_journal_entry(v_reversal_id);
  
  -- 5. Mark original as reversed
  UPDATE public.journal_entries
  SET status = 'reversed', reversed_by = v_reversal_id, reversed_at = now()
  WHERE id = p_original_id;
  
  RETURN v_reversal_id;
END;
$$;

-- ============================================================================
-- Function: Get the balance of an account from journal lines
-- 
-- For asset/expense accounts: balance = debits - credits
-- For liability/equity/revenue accounts: balance = credits - debits
-- 
-- Only includes lines from 'posted' and 'reversed' entries.
-- 'draft' entries are not included (not yet posted).
-- 'reversed' entries ARE included (their lines are valid, and the reversal
--   entry's opposite lines cancel them out).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_account_balance(p_account_id uuid)
RETURNS numeric(15,2)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(
    CASE
      WHEN a.account_type IN ('asset', 'expense') THEN
        CASE WHEN jl.entry_type = 'debit' THEN jl.amount ELSE -jl.amount END
      ELSE
        CASE WHEN jl.entry_type = 'credit' THEN jl.amount ELSE -jl.amount END
    END
  ), 0)
  FROM public.journal_lines jl
  JOIN public.journal_entries je ON jl.journal_entry_id = je.id
  JOIN public.accounts a ON jl.account_id = a.id
  WHERE jl.account_id = p_account_id
    AND je.status IN ('posted', 'reversed')
    AND a.id = p_account_id;
$$;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
-- Journal entries and lines are readable by staff with audit.read.
-- Service role handles all writes (via post/reverse functions).

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY je_read_staff
  ON public.journal_entries FOR SELECT
  TO authenticated
  USING (public.has_permission('audit.read') OR public.has_role('super_admin'));

CREATE POLICY jl_read_staff
  ON public.journal_lines FOR SELECT
  TO authenticated
  USING (public.has_permission('audit.read') OR public.has_role('super_admin'));

COMMIT;

-- ============================================================================
-- DOWN PATH:
--   DROP FUNCTION reverse_journal_entry;
--   DROP FUNCTION post_journal_entry;
--   DROP FUNCTION enforce_je_status_transition;
--   DROP FUNCTION check_line_parent_draft;
--   DROP FUNCTION prevent_journal_line_modify;
--   DROP FUNCTION set_je_reference;
--   DROP FUNCTION generate_je_reference;
--   DROP TRIGGER trg_journal_entries_no_modify ON journal_entries;
--   DROP TRIGGER trg_journal_lines_check_draft ON journal_lines;
--   DROP TRIGGER trg_journal_lines_no_modify ON journal_lines;
--   DROP TRIGGER trg_je_set_reference ON journal_entries;
--   DROP TRIGGER trg_je_updated_at ON journal_entries;
--   DROP SEQUENCE journal_entry_ref_seq;
--   DROP TABLE journal_lines;
--   DROP TABLE journal_entries;
--   DROP TYPE journal_entry_type;
--   DROP TYPE journal_entry_status;
--   DROP TYPE entry_type;
-- ============================================================================
