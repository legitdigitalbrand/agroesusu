-- ============================================================================
-- AgroEsusu — Master Schema Migration
-- Generated from the Master Engineering PRD
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

CREATE TYPE savings_plan_type AS ENUM (
  'farm_expansion', 'poultry_feed', 'tractor_purchase', 'seeds',
  'fertilizer', 'harvest_savings', 'school_fees', 'emergency_fund',
  'equipment_purchase', 'livestock_purchase', 'custom'
);

CREATE TYPE savings_frequency AS ENUM ('daily', 'weekly', 'monthly');

CREATE TYPE savings_status AS ENUM ('active', 'paused', 'completed', 'cancelled');

CREATE TYPE contribution_type AS ENUM ('deposit', 'withdrawal', 'interest');

CREATE TYPE tx_status AS ENUM ('pending', 'success', 'failed');

CREATE TYPE loan_type AS ENUM (
  'crop', 'poultry', 'fish_farming', 'equipment',
  'greenhouse', 'livestock', 'farm_expansion', 'working_capital'
);

CREATE TYPE loan_application_status AS ENUM (
  'draft', 'submitted', 'under_review', 'approved', 'rejected'
);

CREATE TYPE loan_status AS ENUM ('active', 'disbursed', 'completed', 'overdue', 'defaulted');

CREATE TYPE repayment_status AS ENUM ('pending', 'paid', 'overdue', 'partial');

CREATE TYPE loan_doc_type AS ENUM (
  'id', 'farm_picture', 'bank_statement',
  'business_registration', 'cooperative_letter'
);

CREATE TYPE kyc_doc_type AS ENUM (
  'id_card', 'utility_bill', 'farm_photo',
  'bank_statement', 'business_registration', 'cooperative_letter'
);

CREATE TYPE kyc_verification_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TYPE kyc_tier AS ENUM ('tier_0', 'tier_1', 'tier_2', 'tier_3');

CREATE TYPE user_role AS ENUM ('user', 'admin');

CREATE TYPE tx_type AS ENUM (
  'funding', 'savings_deposit', 'savings_withdrawal', 'interest_earned',
  'loan_disbursement', 'loan_repayment', 'penalty'
);

CREATE TYPE tx_direction AS ENUM ('credit', 'debit');

CREATE TYPE notification_type AS ENUM (
  'savings_success', 'loan_approved', 'repayment_due',
  'repayment_successful', 'missed_repayment', 'goal_reached',
  'kyc_approved', 'kyc_rejected'
);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Check if current user is an admin (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Generate a unique transaction reference
CREATE OR REPLACE FUNCTION public.generate_reference(prefix text DEFAULT 'AGRO')
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT upper(prefix) || '_' || to_char(now(), 'YYYYMMDDHH24MISS') || '_' || substr(md5(random()::text), 1, 6);
$$;

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Auto-create profile on new auth user signup
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

-- ============================================================================
-- TABLES
-- ============================================================================

-- 1. PROFILES (extends auth.users)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text DEFAULT '',
  email text,
  phone text DEFAULT '',
  bvn text,
  nin text,
  residential_address text,
  state text,
  lga text,
  occupation text,
  farm_type text,
  farm_size numeric,
  years_farming int,
  primary_produce text,
  expected_harvest text,
  annual_revenue numeric,
  business_name text,
  business_type text,
  business_registration_number text,
  nok_name text,
  nok_phone text,
  nok_relationship text,
  transaction_pin text,
  kyc_tier kyc_tier DEFAULT 'tier_0',
  kyc_verified_at timestamptz,
  role user_role DEFAULT 'user',
  two_factor_enabled boolean DEFAULT false,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. WALLETS
CREATE TABLE public.wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  safe_haven_customer_id text,
  account_number text,
  account_name text,
  bank_name text,
  balance numeric(18,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id)
);

-- 3. SAVINGS PLANS
CREATE TABLE public.savings_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  plan_type savings_plan_type DEFAULT 'custom',
  goal_amount numeric(18,2) NOT NULL CHECK (goal_amount > 0),
  target_date date,
  current_balance numeric(18,2) DEFAULT 0,
  savings_frequency savings_frequency DEFAULT 'monthly',
  contribution_amount numeric(18,2) DEFAULT 0,
  auto_debit_enabled boolean DEFAULT false,
  interest_rate numeric(5,2) DEFAULT 0,
  interest_earned numeric(18,2) DEFAULT 0,
  status savings_status DEFAULT 'active',
  safe_haven_account_number text,
  early_withdrawal_penalty numeric(5,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4. SAVINGS CONTRIBUTIONS
CREATE TABLE public.savings_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  savings_plan_id uuid NOT NULL REFERENCES public.savings_plans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount numeric(18,2) NOT NULL CHECK (amount != 0),
  type contribution_type NOT NULL,
  status tx_status DEFAULT 'pending',
  safe_haven_reference text,
  created_at timestamptz DEFAULT now()
);

-- 5. LOAN APPLICATIONS
CREATE TABLE public.loan_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  loan_type loan_type NOT NULL,
  requested_amount numeric(18,2) NOT NULL CHECK (requested_amount > 0),
  purpose text NOT NULL,
  repayment_duration_months int NOT NULL CHECK (repayment_duration_months > 0),
  farm_size numeric,
  business_type text,
  years_operating int,
  expected_harvest text,
  annual_revenue numeric,
  status loan_application_status DEFAULT 'draft',
  interest_rate numeric(5,2),
  monthly_repayment numeric(18,2),
  total_repayable numeric(18,2),
  reviewed_by uuid REFERENCES public.profiles(id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 6. LOAN DOCUMENTS
CREATE TABLE public.loan_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_application_id uuid NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  doc_type loan_doc_type NOT NULL,
  file_url text NOT NULL,
  file_name text,
  file_size bigint,
  created_at timestamptz DEFAULT now()
);

-- 7. LOANS (created when application is approved)
CREATE TABLE public.loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_application_id uuid NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  principal_amount numeric(18,2) NOT NULL,
  interest_rate numeric(5,2) NOT NULL,
  total_repayable numeric(18,2) NOT NULL,
  outstanding_balance numeric(18,2) NOT NULL,
  monthly_repayment numeric(18,2) NOT NULL,
  duration_months int NOT NULL,
  status loan_status DEFAULT 'active',
  disbursement_date timestamptz,
  maturity_date date,
  safe_haven_disbursement_ref text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 8. LOAN REPAYMENTS (schedule + payment history)
CREATE TABLE public.loan_repayments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  installment_number int NOT NULL,
  amount_due numeric(18,2) NOT NULL,
  amount_paid numeric(18,2) DEFAULT 0,
  due_date date NOT NULL,
  paid_date timestamptz,
  status repayment_status DEFAULT 'pending',
  safe_haven_reference text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 9. TRANSACTIONS (all financial movements)
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  wallet_id uuid REFERENCES public.wallets(id) ON DELETE SET NULL,
  savings_plan_id uuid REFERENCES public.savings_plans(id) ON DELETE SET NULL,
  loan_id uuid REFERENCES public.loans(id) ON DELETE SET NULL,
  type tx_type NOT NULL,
  amount numeric(18,2) NOT NULL CHECK (amount > 0),
  direction tx_direction NOT NULL,
  status tx_status DEFAULT 'pending',
  description text,
  reference text UNIQUE DEFAULT public.generate_reference(),
  safe_haven_reference text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- 10. NOTIFICATIONS
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  read boolean DEFAULT false,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- 11. KYC DOCUMENTS
CREATE TABLE public.kyc_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  doc_type kyc_doc_type NOT NULL,
  file_url text NOT NULL,
  file_name text,
  status kyc_verification_status DEFAULT 'pending',
  verified_by uuid REFERENCES public.profiles(id),
  verified_at timestamptz,
  rejection_reason text,
  created_at timestamptz DEFAULT now()
);

-- 12. AUDIT LOGS
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  old_value jsonb,
  new_value jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- 13. ADMIN SETTINGS
CREATE TABLE public.admin_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL DEFAULT '{}',
  description text,
  updated_by uuid REFERENCES public.profiles(id),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_wallets_user_id ON public.wallets(user_id);
CREATE INDEX idx_savings_plans_user_id ON public.savings_plans(user_id);
CREATE INDEX idx_savings_plans_status ON public.savings_plans(status);
CREATE INDEX idx_savings_contributions_plan_id ON public.savings_contributions(savings_plan_id);
CREATE INDEX idx_savings_contributions_user_id ON public.savings_contributions(user_id);
CREATE INDEX idx_loan_applications_user_id ON public.loan_applications(user_id);
CREATE INDEX idx_loan_applications_status ON public.loan_applications(status);
CREATE INDEX idx_loan_documents_app_id ON public.loan_documents(loan_application_id);
CREATE INDEX idx_loans_user_id ON public.loans(user_id);
CREATE INDEX idx_loans_status ON public.loans(status);
CREATE INDEX idx_loan_repayments_loan_id ON public.loan_repayments(loan_id);
CREATE INDEX idx_loan_repayments_user_id ON public.loan_repayments(user_id);
CREATE INDEX idx_loan_repayments_status ON public.loan_repayments(status);
CREATE INDEX idx_loan_repayments_due_date ON public.loan_repayments(due_date);
CREATE INDEX idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX idx_transactions_type ON public.transactions(type);
CREATE INDEX idx_transactions_status ON public.transactions(status);
CREATE INDEX idx_transactions_reference ON public.transactions(reference);
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_read ON public.notifications(read);
CREATE INDEX idx_kyc_documents_user_id ON public.kyc_documents(user_id);
CREATE INDEX idx_kyc_documents_status ON public.kyc_documents(status);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER wallets_updated_at BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER savings_plans_updated_at BEFORE UPDATE ON public.savings_plans
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER loan_applications_updated_at BEFORE UPDATE ON public.loan_applications
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER loans_updated_at BEFORE UPDATE ON public.loans
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER loan_repayments_updated_at BEFORE UPDATE ON public.loan_repayments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER admin_settings_updated_at BEFORE UPDATE ON public.admin_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Auto-create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_admin());
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- Wallets
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own wallet" ON public.wallets
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Users can insert own wallet" ON public.wallets
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own wallet" ON public.wallets
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Savings Plans
ALTER TABLE public.savings_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own savings" ON public.savings_plans
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid());

-- Savings Contributions
ALTER TABLE public.savings_contributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own contributions" ON public.savings_contributions
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid());

-- Loan Applications
ALTER TABLE public.loan_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own applications" ON public.loan_applications
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid());

-- Loan Documents
ALTER TABLE public.loan_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own loan docs" ON public.loan_documents
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.loan_applications
      WHERE public.loan_applications.id = public.loan_documents.loan_application_id
      AND (public.loan_applications.user_id = auth.uid() OR public.is_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.loan_applications
      WHERE public.loan_applications.id = public.loan_documents.loan_application_id
      AND public.loan_applications.user_id = auth.uid()
    )
  );

-- Loans
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own loans" ON public.loans
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Admins can manage loans" ON public.loans
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Loan Repayments
ALTER TABLE public.loan_repayments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own repayments" ON public.loan_repayments
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Users can update own repayments" ON public.loan_repayments
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins can manage repayments" ON public.loan_repayments
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Transactions
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own transactions" ON public.transactions
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Users can insert own transactions" ON public.transactions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own transactions" ON public.transactions
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own notifications" ON public.notifications
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- KYC Documents
ALTER TABLE public.kyc_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own KYC" ON public.kyc_documents
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid());

-- Audit Logs (admin-only read, system write)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view audit logs" ON public.audit_logs
  FOR SELECT TO authenticated USING (public.is_admin());

-- Admin Settings (admin-only)
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage settings" ON public.admin_settings
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================================
-- SEED DATA — DEFAULT ADMIN SETTINGS
-- ============================================================================

INSERT INTO public.admin_settings (key, value, description) VALUES
  ('base_interest_rate', '12.5', 'Default annual interest rate for agricultural loans (%)'),
  ('max_loan_amount', '5000000', 'Maximum loan amount in NGN'),
  ('min_loan_amount', '50000', 'Minimum loan amount in NGN'),
  ('max_loan_duration_months', '24', 'Maximum loan repayment duration in months'),
  ('min_loan_duration_months', '3', 'Minimum loan repayment duration in months'),
  ('savings_interest_rate', '6.0', 'Default annual interest rate for savings plans (%)'),
  ('early_withdrawal_penalty', '20.0', 'Default early withdrawal penalty (%)'),
  ('auto_debit_enabled', 'true', 'Whether auto-debit is available globally')
ON CONFLICT (key) DO NOTHING;
