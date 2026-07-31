-- ════════════════════════════════════════════════════════════
-- Migration 00036 — Missing RPC Functions
--
-- Adds 4 stored procedures called by domain modules but missing
-- from previous migrations. All functions are SECURITY DEFINER
-- to allow authenticated users to perform atomic updates that
-- RLS would otherwise block.
-- ════════════════════════════════════════════════════════════

-- 1. get_wallet_confirmed_balance(p_wallet_id)
--    Returns confirmed balance: SUM(credits) - SUM(debits) for confirmed transactions
CREATE OR REPLACE FUNCTION public.get_wallet_confirmed_balance(p_wallet_id UUID)
RETURNS NUMERIC(15,2)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance NUMERIC(15,2);
BEGIN
  SELECT COALESCE(
    SUM(CASE WHEN direction = 'credit' THEN amount ELSE -amount END), 0
  )
  INTO v_balance
  FROM public.wallet_transactions
  WHERE wallet_id = p_wallet_id AND status = 'confirmed';

  RETURN v_balance;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_wallet_confirmed_balance(UUID) TO authenticated;

-- 2. increment_candidate_votes(p_election_id, p_membership_id)
--    Atomically increments vote_count for a cooperative election candidate
CREATE OR REPLACE FUNCTION public.increment_candidate_votes(
  p_election_id UUID,
  p_membership_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.cooperative_election_candidates
  SET vote_count = vote_count + 1
  WHERE election_id = p_election_id AND membership_id = p_membership_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_candidate_votes(UUID, UUID) TO authenticated;

-- 3. increment_product_units(p_product_id, p_units)
--    Atomically increments units_issued on an investment product
CREATE OR REPLACE FUNCTION public.increment_product_units(
  p_product_id UUID,
  p_units NUMERIC
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.investment_products
  SET units_issued = units_issued + p_units, updated_at = now()
  WHERE id = p_product_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_product_units(UUID, NUMERIC) TO authenticated;

-- 4. update_group_member_contribution(p_group_account_id, p_wallet_id, p_amount)
--    Updates contributing member's totals in group_savings_memberships
CREATE OR REPLACE FUNCTION public.update_group_member_contribution(
  p_group_account_id UUID,
  p_wallet_id UUID,
  p_amount NUMERIC
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id UUID;
BEGIN
  SELECT customer_id INTO v_customer_id
  FROM public.wallets WHERE id = p_wallet_id;

  IF v_customer_id IS NULL THEN RETURN; END IF;

  UPDATE public.group_savings_memberships
  SET
    total_contributed = total_contributed + p_amount,
    contributions_count = contributions_count + 1,
    last_contribution_at = now(),
    updated_at = now()
  WHERE group_account_id = p_group_account_id
    AND customer_id = v_customer_id
    AND status = 'active';
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_group_member_contribution(UUID, UUID, NUMERIC) TO authenticated;
