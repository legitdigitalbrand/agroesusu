-- 00060: provider_fee transaction type
--
-- Safe Haven charges fees + VAT directly against the customer's real DVA
-- on transfers in and out. Those charges were never mirrored into the
-- internal ledger, so wallet balances overstated what the DVA could pay
-- out (root cause of the 2026-09-11 "No sufficient funds" transfer
-- bounces). New `provider_fee` financial transactions book them:
-- D Wallet (customer's claim drops), C Safe Haven 1000 (real money drops).

ALTER TYPE ft_type ADD VALUE IF NOT EXISTS 'provider_fee';
