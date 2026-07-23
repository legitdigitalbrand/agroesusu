-- Agroesusu Supabase Initial Schema Migration
-- Migration: 00001_initial_schema
-- Created at: 2026-07-22

-- Enable uuid-ossp if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 1. PROFILES TABLE
-- ==========================================
CREATE TABLE public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name text,
    phone text,
    email text,
    bvn_verified boolean DEFAULT false,
    kyc_tier text DEFAULT 'tier_0' CHECK (kyc_tier IN ('tier_0','tier_1','tier_2','tier_3')),
    farm_type text CHECK (farm_type IN ('crop','livestock','mixed','agro_processing','input_dealer')),
    state text,
    lga text,
    farm_size numeric,
    years_farming int,
    primary_produce text,
    monthly_income_estimate numeric,
    credit_score int,
    pre_qualified_amount numeric,
    transaction_pin text,
    referral_code text UNIQUE,
    referred_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    role text DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at timestamptz DEFAULT now()
);

-- ==========================================
-- 2. WALLETS TABLE
-- ==========================================
CREATE TABLE public.wallets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    safe_haven_account_number text,
    safe_haven_account_name text,
    bank_name text,
    balance_cached numeric DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

-- ==========================================
-- 3. WALLET_TRANSACTIONS TABLE
-- ==========================================
CREATE TABLE public.wallet_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id uuid REFERENCES public.wallets(id) ON DELETE CASCADE,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    type text CHECK (type IN ('fund', 'withdraw', 'transfer_in', 'transfer_out', 'bill_pay', 'repay', 'loan_disbursement')),
    amount numeric NOT NULL,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
    safe_haven_reference text,
    counterparty jsonb,
    created_at timestamptz DEFAULT now()
);

-- ==========================================
-- 4. LOANS TABLE
-- ==========================================
CREATE TABLE public.loans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    purpose text,
    amount_requested numeric NOT NULL,
    amount_approved numeric,
    tenor_days int NOT NULL,
    monthly_rate numeric NOT NULL,
    status text DEFAULT 'pending_review' CHECK (status IN (
        'pending_review', 'scoring', 'auto_approved', 'auto_declined',
        'manual_review', 'disbursed', 'repaying', 'closed', 'defaulted'
    )),
    disbursed_at timestamptz,
    closed_at timestamptz,
    created_at timestamptz DEFAULT now()
);

-- ==========================================
-- 5. LOAN_EVENTS TABLE (IMMUTABLE AUDIT TRAIL)
-- ==========================================
CREATE TABLE public.loan_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id uuid REFERENCES public.loans(id) ON DELETE CASCADE,
    event_type text NOT NULL,
    payload_json jsonb,
    created_at timestamptz DEFAULT now()
);

-- ==========================================
-- 6. LOAN_REPAYMENT_SCHEDULE TABLE
-- ==========================================
CREATE TABLE public.loan_repayment_schedule (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id uuid REFERENCES public.loans(id) ON DELETE CASCADE,
    due_date date NOT NULL,
    amount_due numeric NOT NULL,
    amount_paid numeric DEFAULT 0,
    status text DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'paid', 'partial', 'overdue')),
    created_at timestamptz DEFAULT now()
);

-- ==========================================
-- 7. SAVINGS_CIRCLES TABLE
-- ==========================================
CREATE TABLE public.savings_circles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    name text NOT NULL,
    contribution_amount numeric NOT NULL,
    frequency text CHECK (frequency IN ('daily', 'weekly', 'monthly')),
    max_members int DEFAULT 20,
    start_date date,
    current_payout_index int DEFAULT 0,
    status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    created_at timestamptz DEFAULT now()
);

-- ==========================================
-- 8. SAVINGS_CIRCLE_MEMBERS TABLE
-- ==========================================
CREATE TABLE public.savings_circle_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_id uuid REFERENCES public.savings_circles(id) ON DELETE CASCADE,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    payout_position int NOT NULL,
    total_contributed numeric DEFAULT 0,
    received_payout boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    UNIQUE(circle_id, user_id)
);

-- ==========================================
-- 9. FIXED_DEPOSITS TABLE
-- ==========================================
CREATE TABLE public.fixed_deposits (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    principal numeric NOT NULL,
    interest_rate numeric NOT NULL,
    term_days int NOT NULL,
    maturity_date date NOT NULL,
    status text DEFAULT 'active' CHECK (status IN ('active', 'matured', 'withdrawn')),
    created_at timestamptz DEFAULT now()
);

-- ==========================================
-- 10. BILL_PAYMENTS TABLE
-- ==========================================
CREATE TABLE public.bill_payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    category text NOT NULL,
    vendor text NOT NULL,
    amount numeric NOT NULL,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
    reference text,
    created_at timestamptz DEFAULT now()
);

-- ==========================================
-- 11. REFERRALS TABLE
-- ==========================================
CREATE TABLE public.referrals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    referee_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    bonus_amount numeric DEFAULT 0,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'qualified', 'paid')),
    created_at timestamptz DEFAULT now()
);

-- ==========================================
-- 12. CARDS TABLE
-- ==========================================
CREATE TABLE public.cards (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    card_type text CHECK (card_type IN ('virtual', 'physical')),
    last_four text,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'frozen', 'cancelled')),
    created_at timestamptz DEFAULT now()
);

-- ==========================================
-- 13. NOTIFICATIONS TABLE
-- ==========================================
CREATE TABLE public.notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id text,
    title text NOT NULL,
    body text,
    read boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

-- ==========================================
-- 14. KYC_DOCUMENTS TABLE
-- ==========================================
CREATE TABLE public.kyc_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    doc_type text CHECK (doc_type IN ('selfie', 'id_card', 'utility_bill', 'farm_proof')),
    storage_path text,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at timestamptz DEFAULT now()
);

-- ==========================================
-- 15. ADMIN_REVIEW_QUEUE TABLE
-- ==========================================
CREATE TABLE public.admin_review_queue (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    related_type text NOT NULL,
    related_id uuid,
    reason text,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at timestamptz,
    created_at timestamptz DEFAULT now()
);

-- ==========================================
-- 16. CREDIT_SCORING_RUNS TABLE
-- ==========================================
CREATE TABLE public.credit_scoring_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    score int NOT NULL,
    decision text NOT NULL,
    inputs_json jsonb,
    created_at timestamptz DEFAULT now()
);

-- ==========================================
-- INDEXES
-- ==========================================
CREATE INDEX idx_wallet_transactions_user_id ON public.wallet_transactions(user_id);
CREATE INDEX idx_wallet_transactions_wallet_id ON public.wallet_transactions(wallet_id);
CREATE INDEX idx_loans_user_id ON public.loans(user_id);
CREATE INDEX idx_loans_status ON public.loans(status);
CREATE INDEX idx_loan_events_loan_id ON public.loan_events(loan_id);
CREATE INDEX idx_loan_repayment_schedule_loan_id ON public.loan_repayment_schedule(loan_id);
CREATE INDEX idx_savings_circle_members_circle_id ON public.savings_circle_members(circle_id);
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_bill_payments_user_id ON public.bill_payments(user_id);
CREATE INDEX idx_credit_scoring_runs_user_id ON public.credit_scoring_runs(user_id);
CREATE INDEX idx_fixed_deposits_user_id ON public.fixed_deposits(user_id);
CREATE INDEX idx_referrals_referrer_id ON public.referrals(referrer_id);

-- ==========================================
-- HELPER FUNCTIONS & TRIGGERS
-- ==========================================

-- 1. Helper function to check if the current user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Block immutable table updates/deletes
CREATE OR REPLACE FUNCTION public.block_immutable_update_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Updates and deletes are not allowed on this table.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER block_loan_events_update_delete
BEFORE UPDATE OR DELETE ON public.loan_events
FOR EACH ROW EXECUTE FUNCTION public.block_immutable_update_delete();

-- 3. Automatic Profile Creation Trigger & Function (for new auth.users)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  new_referral_code text;
BEGIN
  -- Generate a unique referral code
  new_referral_code := 'AGRO' || UPPER(SUBSTRING(MD5(RANDOM()::text || new.id::text) FROM 1 FOR 8));

  INSERT INTO public.profiles (
    id,
    full_name,
    email,
    phone,
    referral_code,
    role
  )
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    COALESCE(new.phone, new.raw_user_meta_data->>'phone', ''),
    new_referral_code,
    'user'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==========================================
-- ROW LEVEL SECURITY POLICIES
-- ==========================================

-- Profiles Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own profile" ON public.profiles FOR ALL TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "Admins have full access to profiles" ON public.profiles FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Wallets Policies
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own wallet" ON public.wallets FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins have full access to wallets" ON public.wallets FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Wallet Transactions Policies
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own transactions" ON public.wallet_transactions FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins have full access to transactions" ON public.wallet_transactions FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Loans Policies
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own loans" ON public.loans FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins have full access to loans" ON public.loans FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Loan Events Policies (read-only for users)
ALTER TABLE public.loan_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own loan events" ON public.loan_events FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.loans WHERE public.loans.id = public.loan_events.loan_id AND public.loans.user_id = auth.uid()));
CREATE POLICY "Admins have full access to loan events" ON public.loan_events FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Loan Repayment Schedule Policies
ALTER TABLE public.loan_repayment_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own repayment schedules" ON public.loan_repayment_schedule FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.loans WHERE public.loans.id = public.loan_repayment_schedule.loan_id AND public.loans.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.loans WHERE public.loans.id = public.loan_repayment_schedule.loan_id AND public.loans.user_id = auth.uid()));
CREATE POLICY "Admins have full access to repayment schedules" ON public.loan_repayment_schedule FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Savings Circles Policies
ALTER TABLE public.savings_circles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners can manage their savings circles" ON public.savings_circles FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Admins have full access to savings circles" ON public.savings_circles FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Savings Circle Members Policies
ALTER TABLE public.savings_circle_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can manage their membership" ON public.savings_circle_members FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins have full access to savings circle members" ON public.savings_circle_members FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Fixed Deposits Policies
ALTER TABLE public.fixed_deposits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own fixed deposits" ON public.fixed_deposits FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins have full access to fixed deposits" ON public.fixed_deposits FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Bill Payments Policies
ALTER TABLE public.bill_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own bill payments" ON public.bill_payments FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins have full access to bill payments" ON public.bill_payments FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Referrals Policies
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view and manage their own referrals" ON public.referrals FOR ALL TO authenticated USING (referrer_id = auth.uid() OR referee_id = auth.uid()) WITH CHECK (referrer_id = auth.uid() OR referee_id = auth.uid());
CREATE POLICY "Admins have full access to referrals" ON public.referrals FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Cards Policies
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own cards" ON public.cards FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins have full access to cards" ON public.cards FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Notifications Policies
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own notifications" ON public.notifications FOR ALL TO authenticated USING (user_id = auth.uid()::text) WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "Admins have full access to notifications" ON public.notifications FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- KYC Documents Policies
ALTER TABLE public.kyc_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own KYC documents" ON public.kyc_documents FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins have full access to KYC documents" ON public.kyc_documents FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Admin Review Queue Policies
ALTER TABLE public.admin_review_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins have full access to review queue" ON public.admin_review_queue FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Credit Scoring Runs Policies
ALTER TABLE public.credit_scoring_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own scoring runs" ON public.credit_scoring_runs FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins have full access to scoring runs" ON public.credit_scoring_runs FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
