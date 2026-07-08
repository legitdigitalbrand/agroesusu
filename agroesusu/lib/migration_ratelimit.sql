-- Rate limiting support for money-movement endpoints (withdraw/deposit/
-- group-contribute init). The rate limiter reuses the existing audit_logs
-- table as a request ledger — this index makes those lookups
-- (actor_id + action + recent created_at) fast as volume grows.
--
-- Run this once in the Supabase SQL editor.

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_action_created
  ON audit_logs(actor_id, action, created_at DESC);
