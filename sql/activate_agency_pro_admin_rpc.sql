-- Atomic admin activation: agency Pro + mark transaction verified (SECURITY DEFINER, bypasses RLS)
-- Run after transactions.is_verified exists (see transactions_is_verified_column.sql) or adjust UPDATE below.
--
-- Remove duplicate overloads (e.g. p_transaction_id uuid vs bigint) so PostgREST can resolve the call.

DROP FUNCTION IF EXISTS public.activate_agency_pro_admin(uuid, uuid);
DROP FUNCTION IF EXISTS public.activate_agency_pro_admin(uuid, bigint);

CREATE OR REPLACE FUNCTION public.activate_agency_pro_admin(
  p_broker_id uuid,
  p_transaction_id bigint
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pkg text;
  v_n integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT t.package_name INTO STRICT v_pkg
  FROM public.transactions t
  WHERE t.id = p_transaction_id
    AND t.broker_id = p_broker_id
    AND t.status = 'pending';

  IF v_pkg IS DISTINCT FROM 'agency_business_pro' THEN
    RAISE EXCEPTION 'Invalid package: expected agency_business_pro';
  END IF;

  UPDATE public.agencies
  SET
    subscription_status = 'pro',
    is_verified = true
  WHERE owner_id = p_broker_id;

  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN
    RAISE EXCEPTION 'Agency not found';
  END IF;

  UPDATE public.transactions
  SET
    status = 'verified',
    is_verified = true
  WHERE id = p_transaction_id
    AND broker_id = p_broker_id
    AND status = 'pending';

  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN
    RAISE EXCEPTION 'Transaction verify failed';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.activate_agency_pro_admin(uuid, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activate_agency_pro_admin(uuid, bigint) TO authenticated;

COMMENT ON FUNCTION public.activate_agency_pro_admin(uuid, bigint) IS 'Admin-only: set agency Pro and verify agency_business_pro transaction in one transaction';

-- If you still see "Could not choose the best candidate", run in SQL editor:
-- SELECT proname, oidvectortypes(proargtypes) FROM pg_proc WHERE proname = 'activate_agency_pro_admin';
-- and DROP any extra signatures not listed above.
