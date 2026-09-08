-- 00053 — Realtime wallet history updates
--
-- Adds wallet_transactions to the realtime publication so the frontend can
-- subscribe to INSERT events on its own wallet history (Supabase Realtime
-- enforces RLS: the wallet_tx_read_self / wallet_tx_read_staff SELECT
-- policies gate which rows a subscriber receives).
-- This powers "balance updates the moment money lands" without polling.

ALTER PUBLICATION supabase_realtime ADD TABLE wallet_transactions;
