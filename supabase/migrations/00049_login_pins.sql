-- ============================================================================
-- 00049 — Login PIN system
--
-- A user-configurable 4-digit login PIN, required after password sign-in
-- (and before any protected page loads) when the user has one set up.
--
-- Security properties:
--   * pin_hash is a salted scrypt hash — the plaintext PIN is NEVER stored.
--   * login_pins is service-role-only: NO RLS policies are created, so
--     anon/authenticated clients can neither read nor write it. All PIN
--     verification happens in API routes using the service client.
--   * profiles.has_login_pin is the only user-readable signal (needed by the
--     middleware to decide whether to gate the request), and can only be
--     written by the service role (profiles RLS already blocks user writes).
--   * failed_attempts / locked_until give server-side brute-force lockout.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.login_pins (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    pin_hash        TEXT NOT NULL,          -- salted scrypt hash, never plaintext
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until    TIMESTAMPTZ,
    last_used_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_login_pins_user ON public.login_pins(user_id);

-- Enable RLS with NO policies: service role bypasses RLS; every other role
-- is denied. The PIN hash is never exposed to client SDKs.
ALTER TABLE public.login_pins ENABLE ROW LEVEL SECURITY;

-- profiles.has_login_pin — user-readable boolean the middleware uses to
-- decide whether the PIN gate applies. Users can read profiles (own row) but
-- cannot update it (profiles RLS allows no user UPDATE).
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS has_login_pin BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON TABLE public.login_pins IS 'Hashed login PINs — service-role-only access; verification happens server-side in API routes.';

-- ============================================================================
-- Sensitive profile columns must only be writable by the SERVICE ROLE.
--
-- RLS on profiles allows users to UPDATE their own row, which previously made
-- kyc_tier (and now has_login_pin) directly client-flippable with the Supabase
-- browser SDK — a privilege escalation that bypassed every tier gate and the
-- PIN gate. This trigger silently reverts sensitive-column changes made by
-- any role other than service_role / supabase_admin / postgres.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.protect_sensitive_profile_columns()
RETURNS TRIGGER AS $$
BEGIN
    IF current_setting('role', true) NOT IN ('service_role', 'supabase_admin', 'postgres') THEN
        -- KYC tier/verified-at: gate funding, verification and PIN logic.
        IF NEW.kyc_tier IS DISTINCT FROM OLD.kyc_tier THEN
            NEW.kyc_tier := OLD.kyc_tier;
        END IF;
        IF NEW.kyc_verified_at IS DISTINCT FROM OLD.kyc_verified_at THEN
            NEW.kyc_verified_at := OLD.kyc_verified_at;
        END IF;
        -- Login PIN flag: only the PIN API routes (service client) may change it.
        IF NEW.has_login_pin IS DISTINCT FROM OLD.has_login_pin THEN
            NEW.has_login_pin := OLD.has_login_pin;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS protect_sensitive_profile_columns ON public.profiles;
CREATE TRIGGER protect_sensitive_profile_columns
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_sensitive_profile_columns();
