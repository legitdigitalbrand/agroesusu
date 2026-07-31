-- ═══════════════════════════════════════════════════════════════
-- Migration 00037: Safe Haven Provisioning Tables
--
-- Tracks the customer's Safe Haven identity verification and
-- sub-account (DVA) provisioning lifecycle.
-- ═══════════════════════════════════════════════════════════════

-- Identity verification attempts (BVN/NIN)
CREATE TABLE IF NOT EXISTS public.safe_haven_identity_verifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id     UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    identity_id     TEXT NOT NULL,  -- Safe Haven's identity ID
    type            TEXT NOT NULL CHECK (type IN ('BVN', 'NIN')),
    number          TEXT NOT NULL,  -- The BVN or NIN number
    status          TEXT NOT NULL DEFAULT 'otp_sent' CHECK (status IN ('otp_sent', 'verified', 'failed', 'expired')),
    verified_data   JSONB,          -- Data returned by Safe Haven on success
    initiated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    verified_at     TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ,    -- OTP expiry
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sh_identity_verifications_customer ON safe_haven_identity_verifications(customer_id);
CREATE INDEX idx_sh_identity_verifications_identity_id ON safe_haven_identity_verifications(identity_id);

-- Safe Haven sub-accounts (DVA)
CREATE TABLE IF NOT EXISTS public.safe_haven_accounts (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id             UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    safe_haven_account_id   TEXT NOT NULL,  -- Safe Haven's account ID
    account_number          TEXT NOT NULL,  -- The DVA account number
    account_name            TEXT NOT NULL,
    bank_name               TEXT NOT NULL DEFAULT 'Safe Haven MFB',
    bank_code               TEXT NOT NULL DEFAULT '999240',
    status                  TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'restricted', 'frozen', 'closed')),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(customer_id)  -- One Safe Haven account per customer (idempotent)
);

CREATE INDEX idx_safe_haven_accounts_customer ON safe_haven_accounts(customer_id);
CREATE INDEX idx_safe_haven_accounts_number ON safe_haven_accounts(account_number);

-- RLS
ALTER TABLE safe_haven_identity_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE safe_haven_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own identity verifications"
    ON safe_haven_identity_verifications FOR SELECT
    USING (auth.uid() = (SELECT auth_id FROM customers WHERE id = customer_id));

CREATE POLICY "Users can insert own identity verifications"
    ON safe_haven_identity_verifications FOR INSERT
    WITH CHECK (auth.uid() = (SELECT auth_id FROM customers WHERE id = customer_id));

CREATE POLICY "Users can update own identity verifications"
    ON safe_haven_identity_verifications FOR UPDATE
    USING (auth.uid() = (SELECT auth_id FROM customers WHERE id = customer_id));

CREATE POLICY "Users can read own safe haven accounts"
    ON safe_haven_accounts FOR SELECT
    USING (auth.uid() = (SELECT auth_id FROM customers WHERE id = customer_id));

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_safe_haven_tables_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sh_identity_verifications_updated
    BEFORE UPDATE ON safe_haven_identity_verifications
    FOR EACH ROW
    EXECUTE FUNCTION update_safe_haven_tables_updated_at();

CREATE TRIGGER trg_safe_haven_accounts_updated
    BEFORE UPDATE ON safe_haven_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_safe_haven_tables_updated_at();
