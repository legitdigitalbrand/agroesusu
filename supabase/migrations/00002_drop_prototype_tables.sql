-- ============================================================================
-- Migration 00002: Drop Prototype Tables
-- 
-- Removes all tables from the prototype migration (00001_initial_schema.sql).
-- This clears the slate for the enterprise schema rebuild.
--
-- DOWN PATH: Re-run 00001_initial_schema.sql to restore prototype tables.
-- ============================================================================

BEGIN;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.admin_settings CASCADE;
DROP TABLE IF EXISTS public.kyc_documents CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.loan_repayments CASCADE;
DROP TABLE IF EXISTS public.loans CASCADE;
DROP TABLE IF EXISTS public.loan_documents CASCADE;
DROP TABLE IF EXISTS public.loan_applications CASCADE;
DROP TABLE IF EXISTS public.savings_contributions CASCADE;
DROP TABLE IF EXISTS public.savings_plans CASCADE;
DROP TABLE IF EXISTS public.wallets CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Drop helper functions
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;
DROP FUNCTION IF EXISTS public.generate_reference(text) CASCADE;
DROP FUNCTION IF EXISTS public.handle_updated_at() CASCADE;

-- Drop enum types
DROP TYPE IF EXISTS public.savings_plan_type CASCADE;
DROP TYPE IF EXISTS public.savings_frequency CASCADE;
DROP TYPE IF EXISTS public.savings_status CASCADE;
DROP TYPE IF EXISTS public.contribution_type CASCADE;
DROP TYPE IF EXISTS public.tx_status CASCADE;
DROP TYPE IF EXISTS public.loan_type CASCADE;
DROP TYPE IF EXISTS public.loan_application_status CASCADE;
DROP TYPE IF EXISTS public.loan_status CASCADE;
DROP TYPE IF EXISTS public.repayment_status CASCADE;
DROP TYPE IF EXISTS public.loan_doc_type CASCADE;
DROP TYPE IF EXISTS public.kyc_doc_type CASCADE;
DROP TYPE IF EXISTS public.kyc_verification_status CASCADE;
DROP TYPE IF EXISTS public.kyc_tier CASCADE;
DROP TYPE IF EXISTS public.user_role CASCADE;
DROP TYPE IF EXISTS public.tx_type CASCADE;
DROP TYPE IF EXISTS public.tx_direction CASCADE;
DROP TYPE IF EXISTS public.notification_type CASCADE;

-- Remove the auto-profile-creation trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

COMMIT;

-- ============================================================================
-- Verification: Confirm all prototype tables are dropped
-- ============================================================================
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public';
-- Expected: no rows (all dropped)
