-- AgroEsusu Database Schema
-- Run this in: Supabase Dashboard → SQL Editor → New query → paste → Run

-- ============================================
-- 1. PROFILES (extends Supabase auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT DEFAULT '',
  tier TEXT DEFAULT 'basic',
  credit_score INTEGER DEFAULT 300,
  kyc_status TEXT DEFAULT 'pending',
  account_status TEXT DEFAULT 'active',
  total_saved DECIMAL(12,2) DEFAULT 0,
  total_withdrawn DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. SAVINGS ACCOUNTS (Flex, Goal, Seasonal, Stash)
-- ============================================
CREATE TABLE IF NOT EXISTS savings_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('flex', 'goal', 'seasonal', 'stash')),
  name TEXT NOT NULL,
  target_amount DECIMAL(12,2) DEFAULT 0,
  current_amount DECIMAL(12,2) DEFAULT 0,
  interest_rate DECIMAL(5,2) DEFAULT 5,
  lock_type TEXT DEFAULT 'none' CHECK (lock_type IN ('none', 'until_date', 'until_amount')),
  unlock_date TIMESTAMPTZ,
  auto_save_amount DECIMAL(12,2) DEFAULT 0,
  auto_save_frequency TEXT DEFAULT 'monthly',
  auto_save_enabled BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'locked', 'completed', 'closed')),
  icon TEXT DEFAULT '🎯',
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. TRANSACTIONS (deposits, withdrawals, interest)
-- ============================================
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID REFERENCES savings_accounts(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'interest', 'group_contribution')),
  amount DECIMAL(12,2) NOT NULL,
  payment_method TEXT DEFAULT 'card',
  payment_reference TEXT,
  paystack_response JSONB,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'reversed')),
  description TEXT,
  fee_amount DECIMAL(12,2) DEFAULT 0,
  completed_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. NOTIFICATIONS (in-app only for MVP)
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  channel TEXT DEFAULT 'in_app',
  title TEXT NOT NULL,
  content TEXT,
  status TEXT DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'archived')),
  sent_date TIMESTAMPTZ DEFAULT NOW(),
  read_date TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. SAVINGS GROUPS (Esusu)
-- ============================================
CREATE TABLE IF NOT EXISTS savings_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type TEXT DEFAULT 'esusu',
  contribution_amount DECIMAL(12,2) NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  member_count INTEGER DEFAULT 1,
  max_members INTEGER DEFAULT 10,
  payout_method TEXT DEFAULT 'rotation' CHECK (payout_method IN ('rotation', 'random', 'need_based')),
  current_cycle INTEGER DEFAULT 1,
  total_cycles INTEGER DEFAULT 10,
  start_date TIMESTAMPTZ DEFAULT NOW(),
  end_date TIMESTAMPTZ,
  status TEXT DEFAULT 'recruiting' CHECK (status IN ('recruiting', 'active', 'paused', 'completed', 'cancelled')),
  description TEXT DEFAULT '',
  total_pool DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. GROUP MEMBERS
-- ============================================
CREATE TABLE IF NOT EXISTS group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES savings_groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  slot_position INTEGER NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'removed', 'left')),
  reliability_rating INTEGER DEFAULT 100,
  has_received_payout BOOLEAN DEFAULT false,
  joined_date TIMESTAMPTZ DEFAULT NOW(),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

-- ============================================
-- 7. GROUP CONTRIBUTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS group_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES savings_groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  cycle_number INTEGER NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  payment_reference TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected', 'late')),
  paid_date TIMESTAMPTZ DEFAULT NOW(),
  verified_date TIMESTAMPTZ,
  verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id, cycle_number)
);

-- ============================================
-- 8. AUDIT LOGS
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT,
  entity_id UUID,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB,
  severity TEXT DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_savings_accounts_user ON savings_accounts(user_id);
CREATE INDEX idx_transactions_user ON transactions(user_id);
CREATE INDEX idx_transactions_account ON transactions(account_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_group_members_group ON group_members(group_id);
CREATE INDEX idx_group_members_user ON group_members(user_id);
CREATE INDEX idx_group_contributions_group ON group_contributions(group_id);
CREATE INDEX idx_group_contributions_user ON group_contributions(user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Profiles: own profile only
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Savings accounts: own accounts only
CREATE POLICY "accounts_select_own" ON savings_accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "accounts_insert_own" ON savings_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "accounts_update_own" ON savings_accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "accounts_delete_own" ON savings_accounts FOR DELETE USING (auth.uid() = user_id);

-- Transactions: own transactions only
CREATE POLICY "tx_select_own" ON transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "tx_insert_own" ON transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tx_update_own" ON transactions FOR UPDATE USING (auth.uid() = user_id);

-- Notifications: own notifications only
CREATE POLICY "notif_select_own" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notif_update_own" ON notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "notif_insert_own" ON notifications FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Groups: visible to all authenticated users (need to see groups to join)
CREATE POLICY "groups_select_all" ON savings_groups FOR SELECT USING (true);
CREATE POLICY "groups_insert_own" ON savings_groups FOR INSERT WITH CHECK (auth.uid() = admin_id);
CREATE POLICY "groups_update_own" ON savings_groups FOR UPDATE USING (auth.uid() = admin_id);

-- Group members: visible to all (transparency for esusu)
CREATE POLICY "members_select_all" ON group_members FOR SELECT USING (true);
CREATE POLICY "members_insert_own" ON group_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "members_update_own" ON group_members FOR UPDATE USING (auth.uid() = user_id);

-- Group contributions: visible to all (transparency)
CREATE POLICY "contrib_select_all" ON group_contributions FOR SELECT USING (true);
CREATE POLICY "contrib_insert_own" ON group_contributions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "contrib_update_own" ON group_contributions FOR UPDATE USING (auth.uid() = user_id);

-- Audit logs: own logs only
CREATE POLICY "audit_select_own" ON audit_logs FOR SELECT USING (auth.uid() = actor_id);

-- ============================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- UPDATED_AT TRIGGERS
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER savings_accounts_updated_at BEFORE UPDATE ON savings_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER transactions_updated_at BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER savings_groups_updated_at BEFORE UPDATE ON savings_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
