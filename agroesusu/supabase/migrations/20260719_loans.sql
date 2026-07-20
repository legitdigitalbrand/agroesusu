-- ============================================
-- AgroEsusu — Loan Integration Schema
-- Run in Supabase Dashboard → SQL Editor
--
-- IMPORTANT: This feature is built in sandbox/test-mode.
-- The LOANS_LIVE_MODE flag (in src/lib/loans/config.ts) defaults to false.
-- Do NOT enable real disbursement until licensing is confirmed.
-- ============================================

-- ============================================
-- 1. LOANS
-- ============================================
CREATE TABLE IF NOT EXISTS loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Loan terms
  principal DECIMAL(12,2) NOT NULL,
  interest_rate DECIMAL(5,2) NOT NULL,          -- flat % at disbursement
  interest_amount DECIMAL(12,2) NOT NULL,       -- principal * rate / 100
  total_repayable DECIMAL(12,2) NOT NULL,       -- principal + interest_amount
  outstanding_balance DECIMAL(12,2) NOT NULL,    -- remaining, starts at total_repayable
  installment_amount DECIMAL(12,2) NOT NULL,     -- total_repayable / num_installments
  num_installments INTEGER NOT NULL,            -- e.g. 4, 8, 12
  installment_frequency TEXT NOT NULL DEFAULT 'weekly'
    CHECK (installment_frequency IN ('weekly', 'biweekly', 'monthly')),

  -- Tier at time of approval
  tier TEXT NOT NULL CHECK (tier IN ('starter', 'established', 'trusted')),

  -- Schedule
  first_due_date TIMESTAMPTZ NOT NULL,
  next_due_date TIMESTAMPTZ,
  disbursed_date TIMESTAMPTZ,
  completed_date TIMESTAMPTZ,

  -- Disbursement
  disbursement_method TEXT NOT NULL DEFAULT 'paystack_transfer'
    CHECK (disbursement_method IN ('paystack_transfer', 'pot_credit', 'manual')),
  disbursement_reference TEXT,                  -- Paystack transfer reference (AGC_LDB)
  disbursement_account_id UUID REFERENCES savings_accounts(id) ON DELETE SET NULL,

  -- Repayment
  repayment_source TEXT NOT NULL DEFAULT 'auto_deduction'
    CHECK (repayment_source IN ('auto_deduction', 'pot_balance', 'manual')),
  linked_pot_id UUID REFERENCES savings_accounts(id) ON DELETE SET NULL, -- pot for auto-deduction
  esusu_payout_opt_in BOOLEAN DEFAULT false,   -- user explicitly opted into esusu payout interception
  linked_group_id UUID REFERENCES savings_groups(id) ON DELETE SET NULL,

  -- Status lifecycle: pending_review → approved → active → overdue → completed / defaulted / rejected
  status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review', 'approved', 'active', 'overdue', 'completed', 'defaulted', 'rejected')),

  -- Missed payment tracking
  overdue_days INTEGER DEFAULT 0,
  late_fee_amount DECIMAL(12,2) DEFAULT 0,
  late_fee_disclosed BOOLEAN DEFAULT false,    -- was late fee shown in terms before acceptance?
  escalation_level INTEGER DEFAULT 0,          -- 0=none, 1=grace, 2=restricted, 3=manual_review

  -- Admin
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_date TIMESTAMPTZ,
  admin_notes TEXT DEFAULT '',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. LOAN INSTALLMENTS (repayment schedule)
-- ============================================
CREATE TABLE IF NOT EXISTS loan_installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL,
  due_date TIMESTAMPTZ NOT NULL,
  amount_due DECIMAL(12,2) NOT NULL,

  -- Payment tracking
  amount_paid DECIMAL(12,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'partial', 'overdue', 'defaulted')),
  paid_date TIMESTAMPTZ,
  payment_reference TEXT,                       -- Paystack charge/transfer reference (AGC_LRP)
  payment_method TEXT,
  attempts INTEGER DEFAULT 0,                   -- auto-deduction attempt count
  last_attempt_date TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(loan_id, installment_number)
);

-- ============================================
-- 3. LOAN SETTINGS (configurable — not hardcoded)
-- ============================================
CREATE TABLE IF NOT EXISTS loan_settings (
  id UUID PRIMARY KEY DEFAULT 1,                -- singleton row
  live_mode BOOLEAN DEFAULT false,              -- LOANS_LIVE_MODE flag mirror in DB
  late_fee_flat DECIMAL(12,2) DEFAULT 1000,     -- flat late fee after grace period
  grace_period_days INTEGER DEFAULT 3,
  restriction_start_days INTEGER DEFAULT 4,     -- days overdue before new-loan restriction
  manual_review_days INTEGER DEFAULT 14,       -- days overdue before manual review flag
  max_auto_retry_attempts INTEGER DEFAULT 2,    -- auto-deduction retries during grace
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT singleton CHECK (id = 1)
);

-- Seed the singleton config row
INSERT INTO loan_settings (id, live_mode) VALUES (1, false)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 4. LOAN TRANSACTIONS LOG
-- ============================================
CREATE TABLE IF NOT EXISTS loan_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('disbursement', 'repayment', 'late_fee', 'retry', 'adjustment')),
  amount DECIMAL(12,2) NOT NULL,
  reference TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_loans_user ON loans(user_id);
CREATE INDEX idx_loans_status ON loans(status);
CREATE INDEX idx_loans_next_due ON loans(next_due_date) WHERE status IN ('active', 'overdue');
CREATE INDEX idx_loan_installments_loan ON loan_installments(loan_id);
CREATE INDEX idx_loan_installments_status ON loan_installments(status);
CREATE INDEX idx_loan_installments_due ON loan_installments(due_date) WHERE status IN ('pending', 'partial', 'overdue');
CREATE INDEX idx_loan_transactions_loan ON loan_transactions(loan_id);
CREATE INDEX idx_loan_transactions_user ON loan_transactions(user_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_transactions ENABLE ROW LEVEL SECURITY;

-- Loans: user can see their own loans; admins (via service role) see all
CREATE POLICY "loans_select_own" ON loans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "loans_insert_own" ON loans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "loans_update_own" ON loans FOR UPDATE USING (auth.uid() = user_id);

-- Installments: user can see installments for their own loans
CREATE POLICY "installments_select_own" ON loan_installments FOR SELECT
  USING (EXISTS (SELECT 1 FROM loans WHERE loans.id = loan_installments.loan_id AND loans.user_id = auth.uid()));

-- Loan transactions: user can see their own
CREATE POLICY "loan_tx_select_own" ON loan_transactions FOR SELECT USING (auth.uid() = user_id);

-- Loan settings: read-only for all authenticated users (needed for UI display)
CREATE POLICY "loan_settings_select_all" ON loan_settings FOR SELECT USING (true);

-- ============================================
-- TRIGGER: Update updated_at on row change
-- ============================================
CREATE OR REPLACE FUNCTION update_loan_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER loans_updated_at BEFORE UPDATE ON loans
  FOR EACH ROW EXECUTE FUNCTION update_loan_timestamps();

CREATE TRIGGER loan_installments_updated_at BEFORE UPDATE ON loan_installments
  FOR EACH ROW EXECUTE FUNCTION update_loan_timestamps();

-- ============================================
-- TRIGGER: Block non-service-role writes to loan balance fields
-- (Same pattern as savings_accounts — prevents client-side tampering)
-- ============================================
CREATE OR REPLACE FUNCTION protect_loan_balances()
RETURNS TRIGGER AS $$
BEGIN
  -- Only allow balance field changes from service role (which bypasses RLS)
  -- If auth.uid() is not null, a regular user is trying to write
  IF auth.uid() IS NOT NULL THEN
    IF TG_OP = 'UPDATE' THEN
      IF NEW.outstanding_balance <> OLD.outstanding_balance
         OR NEW.status <> OLD.status THEN
        RAISE EXCEPTION 'Loan balance/status can only be modified by the server, not the client.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER protect_loan_fields BEFORE UPDATE ON loans
  FOR EACH ROW EXECUTE FUNCTION protect_loan_balances();
