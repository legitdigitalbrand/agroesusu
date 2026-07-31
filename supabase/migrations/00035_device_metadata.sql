-- ═══════════════════════════════════════════════════════════════
-- Migration 00035: Add device metadata to device_pins
--
-- Extends the device_pins table with device tracking metadata:
--   - device_name: human-readable device label (e.g. "Chrome on macOS")
--   - user_agent: raw browser user agent string
--   - last_used_at: last successful PIN verification
--
-- This makes device_pins function as a trusted-device registry:
--   each row = one trusted device with a PIN for a user.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE device_pins
    ADD COLUMN IF NOT EXISTS device_name TEXT,
    ADD COLUMN IF NOT EXISTS user_agent TEXT,
    ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;
