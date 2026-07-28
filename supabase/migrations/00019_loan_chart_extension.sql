-- ============================================================================
-- Migration 00019: Loan Chart of Accounts Extension
-- 
-- Adds the Loan Receivables asset account to the chart of accounts.
-- Each loan will get its own child asset account under this parent.
-- 
-- Accounting model:
--   Disbursement:  Debit Loan Receivable (1002.{loan}), Credit Wallet (2000.{wallet})
--   Repayment:     Debit Wallet (2000.{wallet}), Credit Loan Receivable (1002.{loan})
--   Interest:      Debit Wallet (2000.{wallet}), Credit Interest Revenue (4001)
--   Penalty:       Debit Loan Receivable (1002.{loan}), Credit Fee Revenue (4000)
-- ============================================================================

BEGIN;

-- Add Loan Receivables parent account (asset)
INSERT INTO public.accounts (account_code, account_type, account_category, name, description, is_system_account)
VALUES (
  '1002', 'asset', 'other', 'Loan Receivables (Parent)',
  'Parent account for all loan receivable sub-accounts. Each loan gets its own child account. Increases when loans are disbursed, decreases when repaid.',
  true
)
ON CONFLICT (account_code) DO NOTHING;

COMMIT;
