-- ═══════════════════════════════════════════════════════════════
-- Migration 00034: Device PINs for fast sign-in
--
-- Stores hashed 4-digit PINs per user+device for the "quick unlock"
-- feature. PINs are device-bound: each device a user authenticates
-- on via Email OTP gets its own PIN entry.
--
-- Security:
--   - PIN is stored as a SHA-256 hash with per-row salt (never plaintext)
--   - failed_attempts counter enforces lockout after 5 tries
--   - locked_at timestamp forces fallback to Email OTP
--   - RLS ensures users can only manage their own device PINs
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS device_pins (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_id   TEXT NOT NULL,
    pin_hash    TEXT NOT NULL,
    pin_salt    TEXT NOT NULL,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_at   TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, device_id)
);

-- Index for fast lookups
CREATE INDEX idx_device_pins_user_device ON device_pins(user_id, device_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_device_pins_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_device_pins_updated
    BEFORE UPDATE ON device_pins
    FOR EACH ROW
    EXECUTE FUNCTION update_device_pins_updated_at();

-- RLS
ALTER TABLE device_pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own device pins"
    ON device_pins FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own device pins"
    ON device_pins FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own device pins"
    ON device_pins FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own device pins"
    ON device_pins FOR DELETE
    USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════
-- Also: update the forgot-password and reset-password routes to
-- be no-ops (password-based auth removed). We handle this in code.
-- ═══════════════════════════════════════════════════════════════
