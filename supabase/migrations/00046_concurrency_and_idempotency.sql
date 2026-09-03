-- ============================================================================
-- 00046 — Concurrency Guard & Idempotency Infrastructure (Gate 4, P0)
--
-- Purpose:
--   1. wallet_holds: pooling-safe concurrency guard for money movement.
--      Two concurrent transfer/withdrawal requests can both pass an app-side
--      balance check and double-spend the wallet. The hold is placed with a
--      single atomic conditional UPDATE (row-locked), so the second request
--      fails the check at the database level regardless of stale app reads.
--
--   2. UNIQUE(idempotency_key) on wallet_holds gives database-level duplicate
--      protection for retries that cross server boundaries (double-click,
--      network retry, request replay).
--
--   3. Stale-hold sweep: if the process dies between placing a hold and
--      releasing it, reserved_balance would be elevated forever. The sweep
--      function releases holds older than a configurable age and is called
--      by the daily reconciliation cron.
--
-- Hold lifecycle:
--   reserve  -> active   (before balance check + FTO reservation)
--   release  -> released (after FTO reservation posted, or on failure)
--   sweep    -> swept     (age-based, crash recovery)
--
-- Security: all functions are EXECUTE-restricted to service_role. Customers
-- have no direct access. RLS enabled with no policies (deny all to anon/
-- authenticated; service_role bypasses RLS).
-- ============================================================================

-- 1. wallet_holds table
CREATE TABLE IF NOT EXISTS public.wallet_holds (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id         uuid NOT NULL REFERENCES public.wallets(id) ON DELETE RESTRICT,
  idempotency_key   text NOT NULL,
  amount            numeric(15,2) NOT NULL,

  status            text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'released', 'swept')),

  created_at        timestamptz NOT NULL DEFAULT now(),
  released_at       timestamptz,

  CONSTRAINT chk_hold_amount_positive CHECK (amount > 0),
  CONSTRAINT uq_wallet_holds_idempotency_key UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_wallet_holds_wallet_active
  ON public.wallet_holds (wallet_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_wallet_holds_stale_sweep
  ON public.wallet_holds (created_at)
  WHERE status = 'active';

COMMENT ON TABLE public.wallet_holds IS 'Pooling-safe concurrency guard for money movement: atomically reserves funds before balance check + FTO reservation.';

-- 2. reserve_wallet_hold
-- Atomically: lock wallet row, verify funds room, increment reserved_balance,
-- insert hold. Single transaction = pooling-safe (Supavisor/pgbouncer).
-- Returns jsonb:
--   {"status":"reserved","hold_id":"...","available_balance":"..."}
--   {"status":"duplicate","hold_id":"..."}
--   {"status":"insufficient","available_balance":"..."}
--   {"status":"error","message":"..."}
CREATE OR REPLACE FUNCTION public.reserve_wallet_hold(
  p_wallet_id        uuid,
  p_idempotency_key  text,
  p_amount           numeric(15,2)
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet     public.wallets%ROWTYPE;
  v_hold       public.wallet_holds%ROWTYPE;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Hold amount must be positive');
  END IF;

  -- Idempotent replay: a hold with this key already exists
  SELECT * INTO v_hold
  FROM public.wallet_holds
  WHERE idempotency_key = p_idempotency_key;

  IF FOUND THEN
    RETURN jsonb_build_object('status', 'duplicate', 'hold_id', v_hold.id);
  END IF;

  -- Row lock: serializes concurrent reserve calls on the same wallet
  SELECT * INTO v_wallet
  FROM public.wallets
  WHERE id = p_wallet_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Wallet not found');
  END IF;

  IF v_wallet.status <> 'active' THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Wallet is not active');
  END IF;

  -- Room check against the LIVE row (not the caller's stale read):
  -- available = cached_balance - reserved_balance
  IF (v_wallet.cached_balance - v_wallet.reserved_balance) < p_amount THEN
    RETURN jsonb_build_object(
      'status', 'insufficient',
      'available_balance', v_wallet.cached_balance - v_wallet.reserved_balance
    );
  END IF;

  -- Increment reserved balance (drops cached_available for concurrent requests)
  UPDATE public.wallets
  SET reserved_balance = reserved_balance + p_amount,
      version = version + 1,
      updated_at = now()
  WHERE id = p_wallet_id;

  -- Insert the hold
  INSERT INTO public.wallet_holds (wallet_id, idempotency_key, amount, status)
  VALUES (p_wallet_id, p_idempotency_key, p_amount, 'active')
  RETURNING * INTO v_hold;

  RETURN jsonb_build_object(
    'status', 'reserved',
    'hold_id', v_hold.id,
    'available_balance', v_wallet.cached_balance - v_wallet.reserved_balance - p_amount
  );
END;
$$;

-- 3. release_wallet_hold
-- Marks the hold released and decrements reserved_balance.
-- Idempotent: releasing an already-released hold is a no-op returning true.
CREATE OR REPLACE FUNCTION public.release_wallet_hold(
  p_idempotency_key text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hold public.wallet_holds%ROWTYPE;
BEGIN
  SELECT * INTO v_hold
  FROM public.wallet_holds
  WHERE idempotency_key = p_idempotency_key;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_hold.status <> 'active' THEN
    RETURN true; -- already released
  END IF;

  UPDATE public.wallets
  SET reserved_balance = GREATEST(reserved_balance - v_hold.amount, 0),
      version = version + 1,
      updated_at = now()
  WHERE id = v_hold.wallet_id;

  UPDATE public.wallet_holds
  SET status = 'released',
      released_at = now()
  WHERE id = v_hold.id;

  RETURN true;
END;
$$;

-- 4. sweep_stale_wallet_holds
-- Crash recovery: release active holds older than p_max_age_minutes and
-- refresh the affected wallet caches. Called by the reconciliation cron.
CREATE OR REPLACE FUNCTION public.sweep_stale_wallet_holds(
  p_max_age_minutes integer DEFAULT 15
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_wallet record;
BEGIN
  WITH stale AS (
    SELECT id, wallet_id, amount
    FROM public.wallet_holds
    WHERE status = 'active'
      AND created_at < now() - (p_max_age_minutes || ' minutes')::interval
    FOR UPDATE SKIP LOCKED
  ),
  decremented AS (
    UPDATE public.wallets w
    SET reserved_balance = GREATEST(w.reserved_balance - stale.amount, 0),
        version = w.version + 1,
        updated_at = now()
    FROM stale
    WHERE w.id = stale.wallet_id
    RETURNING w.id AS wallet_id, stale.id AS hold_id
  )
  UPDATE public.wallet_holds h
  SET status = 'swept',
      released_at = now()
  FROM decremented
  WHERE h.id = decremented.hold_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Refresh balance caches for wallets touched by this sweep
  FOR v_wallet IN
    SELECT DISTINCT wallet_id
    FROM public.wallet_holds
    WHERE status = 'swept'
      AND released_at > now() - interval '1 minute'
  LOOP
    PERFORM public.refresh_wallet_balance_cache(v_wallet.wallet_id);
  END LOOP;

  RETURN v_count;
END;
$$;

-- 5. RLS: deny all direct access (service_role bypasses)
ALTER TABLE public.wallet_holds ENABLE ROW LEVEL SECURITY;
-- No policies: anon/authenticated get nothing. All access via service_role
-- (SECURITY DEFINER functions) from the backend only.

REVOKE EXECUTE ON FUNCTION public.reserve_wallet_hold(uuid, text, numeric) FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.release_wallet_hold(text) FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.sweep_stale_wallet_holds(integer) FROM authenticated, anon;

COMMENT ON FUNCTION public.reserve_wallet_hold(uuid, text, numeric) IS 'Gate 4 P0: atomic concurrency guard - locks wallet row, checks room, reserves funds, records hold.';
COMMENT ON FUNCTION public.release_wallet_hold(text) IS 'Gate 4 P0: releases a wallet hold and restores reserved_balance.';
COMMENT ON FUNCTION public.sweep_stale_wallet_holds(integer) IS 'Gate 4 P0: crash recovery - releases active holds older than the given age.';
