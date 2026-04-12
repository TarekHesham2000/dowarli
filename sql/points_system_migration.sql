-- =============================================================================
-- دَورلي — Points system: columns + RPCs (run once in Supabase SQL Editor)
-- =============================================================================

-- Profiles: points balance; role default for new columns only (existing rows unchanged)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS points integer NOT NULL DEFAULT 0;

ALTER TABLE public.profiles
  ALTER COLUMN points SET DEFAULT 0;

-- Optional: enforce default role on insert at DB level (if column exists without default)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'user';
  END IF;
END $$;

-- Transactions: recharge metadata
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS sender_phone text;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS points_requested integer;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS package_name text;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS admin_notes text;

-- -----------------------------------------------------------------------------
-- RPC: add_points — admin only (SECURITY DEFINER)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_points(p_user_id uuid, p_delta integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'invalid user';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_delta IS NULL OR p_delta = 0 THEN
    RETURN;
  END IF;
  UPDATE public.profiles
  SET points = COALESCE(points, 0) + p_delta
  WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.add_points(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_points(uuid, integer) TO authenticated;

-- -----------------------------------------------------------------------------
-- RPC: deduct_points — caller may only deduct own balance
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.deduct_points(p_user_id uuid, p_delta integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_pts integer;
BEGIN
  IF p_user_id IS NULL OR p_delta IS NULL OR p_delta <= 0 THEN
    RETURN true;
  END IF;
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT COALESCE(points, 0) INTO current_pts
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF current_pts < p_delta THEN
    RETURN false;
  END IF;

  UPDATE public.profiles
  SET points = current_pts - p_delta
  WHERE id = p_user_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.deduct_points(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.deduct_points(uuid, integer) TO authenticated;
