-- AgroEsusu Phase 2 Migration
-- Run this in: Supabase Dashboard → SQL Editor → New query → paste → Run

-- ============================================
-- 1. SECURITY HARDENING: prevent direct client tampering with balances
-- ============================================
-- RLS only checks ownership (auth.uid() = user_id), not value correctness —
-- an authenticated user could otherwise call the client SDK directly and set
-- their own current_amount to anything. This trigger blocks that: only the
-- service role (server-side admin client, used by our verified deposit/
-- withdrawal routes) can change current_amount. Regular users can still
-- update non-balance fields (name, description, auto_save settings, etc.)
-- via their own session.
CREATE OR REPLACE FUNCTION protect_savings_balance()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.current_amount IS DISTINCT FROM OLD.current_amount
     AND auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'current_amount can only be changed by a verified server-side transaction';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_savings_balance ON savings_accounts;
CREATE TRIGGER trg_protect_savings_balance
  BEFORE UPDATE ON savings_accounts
  FOR EACH ROW EXECUTE FUNCTION protect_savings_balance();

-- Same protection for profile aggregate fields
CREATE OR REPLACE FUNCTION protect_profile_totals()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.total_saved IS DISTINCT FROM OLD.total_saved
      OR NEW.total_withdrawn IS DISTINCT FROM OLD.total_withdrawn
      OR NEW.credit_score IS DISTINCT FROM OLD.credit_score
      OR NEW.kyc_status IS DISTINCT FROM OLD.kyc_status)
     AND auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'This field can only be changed by a verified server-side process';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_profile_totals ON profiles;
CREATE TRIGGER trg_protect_profile_totals
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION protect_profile_totals();

-- ============================================
-- 2. WITHDRAWALS: lock_type soft/hard + transaction type + status
-- ============================================
ALTER TABLE savings_accounts DROP CONSTRAINT IF EXISTS savings_accounts_lock_type_check;
ALTER TABLE savings_accounts ADD CONSTRAINT savings_accounts_lock_type_check
  CHECK (lock_type IN ('none', 'soft', 'hard', 'until_date', 'until_amount'));

ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check
  CHECK (type IN ('deposit', 'withdrawal', 'interest', 'group_contribution', 'round_up'));

ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_status_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_status_check
  CHECK (status IN ('pending', 'completed', 'failed', 'reversed', 'processing'));

-- ============================================
-- 3. ROUND-UP SAVINGS
-- ============================================
ALTER TABLE savings_accounts ADD COLUMN IF NOT EXISTS round_up_enabled BOOLEAN DEFAULT false;
ALTER TABLE savings_accounts ADD COLUMN IF NOT EXISTS round_up_target_id UUID REFERENCES savings_accounts(id) ON DELETE SET NULL;

-- ============================================
-- 4. EMERGENCY FUND GROUPS: requests + votes
-- ============================================
CREATE TABLE IF NOT EXISTS emergency_fund_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES savings_groups(id) ON DELETE CASCADE,
  requester_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'disbursed')),
  resolved_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS emergency_fund_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES emergency_fund_requests(id) ON DELETE CASCADE,
  voter_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  approve BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(request_id, voter_id)
);

CREATE INDEX IF NOT EXISTS idx_efr_group ON emergency_fund_requests(group_id);
CREATE INDEX IF NOT EXISTS idx_efv_request ON emergency_fund_votes(request_id);

ALTER TABLE emergency_fund_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_fund_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "efr_select_all" ON emergency_fund_requests;
CREATE POLICY "efr_select_all" ON emergency_fund_requests FOR SELECT USING (true);
DROP POLICY IF EXISTS "efr_insert_own" ON emergency_fund_requests;
CREATE POLICY "efr_insert_own" ON emergency_fund_requests FOR INSERT WITH CHECK (auth.uid() = requester_id);

DROP POLICY IF EXISTS "efv_select_all" ON emergency_fund_votes;
CREATE POLICY "efv_select_all" ON emergency_fund_votes FOR SELECT USING (true);
DROP POLICY IF EXISTS "efv_insert_own" ON emergency_fund_votes;
CREATE POLICY "efv_insert_own" ON emergency_fund_votes FOR INSERT WITH CHECK (auth.uid() = voter_id);

-- ============================================
-- 5. PEER RATINGS
-- ============================================
CREATE TABLE IF NOT EXISTS member_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES savings_groups(id) ON DELETE CASCADE,
  rater_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ratee_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, rater_id, ratee_id)
);

CREATE INDEX IF NOT EXISTS idx_ratings_ratee ON member_ratings(ratee_id);

ALTER TABLE member_ratings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ratings_select_all" ON member_ratings;
CREATE POLICY "ratings_select_all" ON member_ratings FOR SELECT USING (true);
DROP POLICY IF EXISTS "ratings_insert_own" ON member_ratings;
CREATE POLICY "ratings_insert_own" ON member_ratings FOR INSERT WITH CHECK (auth.uid() = rater_id);
