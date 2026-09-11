-- ============================================================================
-- 00058 — AgroPocket rebrand: update seeded brand text in live data
--
-- Part of the AgriQCap → AgroPocket production rebrand (2026-09-11).
-- This migration updates BRAND TEXT ONLY — no table, column, ID, reference,
-- or financial data is touched. Historical migrations 00024/00029 are left
-- untouched as an accurate audit trail.
-- ============================================================================

BEGIN;

-- 1. Cooperative name (seeded by 00024, visible in cooperative screens)
UPDATE public.cooperatives
SET name = 'AgroPocket Farmers Cooperative',
    description = 'A cooperative for agricultural savings and lending, serving smallholder farmers across Nigeria.'
WHERE name = 'Agriqcap Farmers Cooperative';

-- 2. Investment product name/description (seeded by 00029, visible in the
--    investment product catalogue). Product code 'INV-0003' and all financial
--    terms (rate, min/max, tenor, risk) are unchanged.
UPDATE public.investment_products
SET product_name = 'Cooperative Growth Fund — AgroPocket',
    description = 'Invest in the AgroPocket Farmers Cooperative growth fund. Returns are based on the cooperative''s collective profitability from lending operations and group savings activities. Profit-sharing model — returns fluctuate with cooperative performance.'
WHERE product_code = 'INV-0003'
  AND product_name = 'Cooperative Growth Fund — Agriqcap';

COMMIT;
