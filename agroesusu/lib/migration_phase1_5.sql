-- ============================================
-- AgroEsusu Phase 1.5 Migration
-- Features: DVA, Group Invite Links, BVN KYC
-- ============================================
-- Run this in Supabase Dashboard → SQL Editor
-- All columns are additive (nullable) — no data loss

-- Feature 2: Dedicated Virtual Account columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS paystack_customer_code TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS paystack_dva_account_number TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS paystack_dva_bank_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS dva_status TEXT DEFAULT 'pending';

-- Feature 3: Group invite token
ALTER TABLE savings_groups ADD COLUMN IF NOT EXISTS invite_token TEXT UNIQUE;

-- Feature 4: KYC / BVN columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bvn_last_4 TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bvn_hash TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bvn_first_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bvn_last_name TEXT;
-- kyc_status already exists in schema (default 'pending') — update default for new users
ALTER TABLE profiles ALTER COLUMN kyc_status SET DEFAULT 'unverified';

-- Index for invite token lookups
CREATE INDEX IF NOT EXISTS idx_groups_invite_token ON savings_groups(invite_token);

-- Backfill invite tokens for existing groups
UPDATE savings_groups
SET invite_token = substr(md5(random()::text || id::text), 1, 8)
WHERE invite_token IS NULL;
