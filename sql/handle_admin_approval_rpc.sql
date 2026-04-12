-- =============================================================================
-- دَورلي — Admin approval: deduct points (if was_charged) + activate in one txn
-- Run in Supabase SQL Editor after property_submit_listing_rpc.sql
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_admin_approval(p_property_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prop RECORD;
  cost int;
  purpose text;
  cur_pts int;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_property_id IS NULL THEN
    RAISE EXCEPTION 'invalid_property';
  END IF;

  SELECT id, status, owner_id, was_charged, listing_type, listing_purpose
  INTO prop
  FROM public.properties
  WHERE id = p_property_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'property_not_found';
  END IF;

  IF prop.status IS DISTINCT FROM 'pending_approval' AND prop.status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'not_pending_approval';
  END IF;

  purpose := lower(btrim(coalesce(
    nullif(btrim(prop.listing_type), ''),
    nullif(btrim(prop.listing_purpose), ''),
    'rent'
  )));
  IF purpose NOT IN ('rent', 'sale') THEN
    purpose := 'rent';
  END IF;

  cost := CASE WHEN purpose = 'sale' THEN 50 ELSE 20 END;

  IF COALESCE(prop.was_charged, false) THEN
    SELECT COALESCE(points, 0) INTO cur_pts
    FROM public.profiles
    WHERE id = prop.owner_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'owner_profile_not_found';
    END IF;

    IF cur_pts < cost THEN
      RAISE EXCEPTION 'insufficient_points_for_activation';
    END IF;

    UPDATE public.profiles
    SET points = cur_pts - cost
    WHERE id = prop.owner_id;
  END IF;

  UPDATE public.properties
  SET status = 'active'
  WHERE id = p_property_id;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_admin_approval(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_admin_approval(bigint) TO authenticated;
