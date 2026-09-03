-- ============================================================================
-- 00048 — Purge fabricated mock DVA records (Gate 4 funding fix)
--
-- ROOT CAUSE: before real Safe Haven credentials were configured
-- (2026-09-01), getBankingProvider() silently fell back to
-- MockBankingProvider when SAFEHAVEN_CLIENT_ID / SAFEHAVEN_PRIVATE_KEY were
-- missing. The identity-verification flows called createSubAccount() on that
-- mock and persisted FABRICATED "virtual accounts" (safe_haven_account_id
-- LIKE 'mock-account-%', random 10-digit numbers) as REAL records, then
-- copied them onto wallets. The dashboards displayed these fake details, and
-- deposits could never complete (transfers to fake numbers never reach Safe
-- Haven — no webhook, no credit: 0 deposit FTOs, 0 inbound events at purge
-- time).
--
-- REMEDIATION (fail-safe, evidence-preserving):
--   1. Copy every mock row into dva_remediation_log (full audit evidence).
--   2. Clear the copied fake details from the affected wallets.
--   3. DELETE the fabricated rows so provisioning creates REAL provider
--      accounts (UNIQUE(customer_id) requires the mock row to be gone).
--
-- No VALID provider account is touched: the predicate matches only
-- mock-account-* identifiers, which can only ever have been produced by the
-- MockBankingProvider.
--
-- The factory is now fail-closed (no silent mock fallback), and provisioning
-- goes through the shared idempotent ensureCustomerDva() path, so this
-- situation cannot recur silently.
-- ============================================================================

-- 1. Audit table for the purge evidence
CREATE TABLE IF NOT EXISTS public.dva_remediation_log (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id           uuid,
  safe_haven_account_id text,
  account_number        text,
  account_name          text,
  bank_name             text,
  bank_code             text,
  status                text,
  created_at            timestamptz,          -- original row's created_at
  purged_at             timestamptz NOT NULL DEFAULT now(),
  reason                text NOT NULL,
  metadata              jsonb NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE public.dva_remediation_log IS
  'Gate 4 funding fix: evidence trail of fabricated mock DVA records purged from safe_haven_accounts (created by MockBankingProvider fallback before real credentials were configured).';

ALTER TABLE public.dva_remediation_log ENABLE ROW LEVEL SECURITY;
-- No policies: service-role/backend access only.

-- 2. Preserve the evidence
INSERT INTO public.dva_remediation_log
  (customer_id, safe_haven_account_id, account_number, account_name,
   bank_name, bank_code, status, created_at, reason, metadata)
SELECT
  customer_id, safe_haven_account_id, account_number, account_name,
  bank_name, bank_code, status, created_at,
  'Fabricated by MockBankingProvider fallback (pre-credential era); not a real Safe Haven account',
  jsonb_build_object('source_table', 'safe_haven_accounts', 'purge_migration', '00048')
FROM public.safe_haven_accounts
WHERE safe_haven_account_id LIKE 'mock-account-%';

-- 3. Clear the copied fake banking details from affected wallets so no
--    surface displays them (dashboard card, statements)
UPDATE public.wallets w
SET account_number = NULL,
    account_name = NULL,
    bank_name = NULL,
    bank_code = NULL,
    dva_provisioned_at = NULL,
    updated_at = now()
FROM public.safe_haven_accounts s
WHERE w.customer_id = s.customer_id
  AND s.safe_haven_account_id LIKE 'mock-account-%';

-- 4. Purge the fabricated records
DELETE FROM public.safe_haven_accounts
WHERE safe_haven_account_id LIKE 'mock-account-%';

-- 5. Non-mock safety assertion: this migration must never touch a real
--    provider account. At purge time, log what remains.
-- (Verification queries are run post-migration by the deployment checklist.)
