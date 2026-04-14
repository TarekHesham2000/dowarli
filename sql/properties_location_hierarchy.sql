-- =============================================================================
-- دَورلي — محافظة / حي / علامة مميزة على جدول properties + تحديث RPC الإرسال
-- نفّذ مرة في Supabase SQL Editor (أو ادمج مع property_submit_listing_rpc.sql)
-- =============================================================================

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS governorate text;

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS district text;

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS landmark text;

COMMENT ON COLUMN public.properties.governorate IS 'Arabic governorate label, e.g. القاهرة | الجيزة';
COMMENT ON COLUMN public.properties.district IS 'District / compound within governorate';
COMMENT ON COLUMN public.properties.landmark IS 'Detailed address or distinctive marker';

CREATE INDEX IF NOT EXISTS idx_properties_district_lower
  ON public.properties (lower(district))
  WHERE district IS NOT NULL AND btrim(district) <> '';

CREATE INDEX IF NOT EXISTS idx_properties_governorate_lower
  ON public.properties (lower(governorate))
  WHERE governorate IS NOT NULL AND btrim(governorate) <> '';

-- Drop every signature of handle_property_submission (adds p_governorate, p_district, p_landmark)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT pg_catalog.pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'handle_property_submission'
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS public.handle_property_submission(%s)', r.args);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.handle_property_submission(
  p_title text,
  p_description text,
  p_price numeric,
  p_area text,
  p_unit_type text,
  p_address text,
  p_device_id text,
  p_video_url text,
  p_rental_unit text,
  p_beds_count integer,
  p_listing_purpose text,
  p_governorate text DEFAULT NULL,
  p_district text DEFAULT NULL,
  p_landmark text DEFAULT NULL
) RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
  new_id bigint;
  v_agency_id uuid;
  purpose text;
  dev_key text;
  ru_raw text;
  beds_final integer;
  gov text;
  dist text;
  lm text;
  legacy_area text;
  area_for_row text;
  addr_row text;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_title IS NULL OR btrim(p_title) = '' THEN
    RAISE EXCEPTION 'invalid_title';
  END IF;

  purpose := lower(btrim(coalesce(p_listing_purpose, 'rent')));
  IF purpose NOT IN ('rent', 'sale') THEN
    RAISE EXCEPTION 'invalid_listing_purpose';
  END IF;

  dev_key := NULLIF(btrim(coalesce(p_device_id, '')), '');

  ru_raw := NULLIF(lower(btrim(coalesce(p_rental_unit, ''))), '');
  IF purpose = 'sale' THEN
    beds_final := NULL;
  ELSIF ru_raw IS NULL THEN
    beds_final := p_beds_count;
  ELSIF ru_raw = 'bed' THEN
    beds_final := p_beds_count;
  ELSIF ru_raw = 'room' THEN
    beds_final := NULL;
  ELSE
    RAISE EXCEPTION 'invalid_rental_unit';
  END IF;

  gov := NULLIF(btrim(coalesce(p_governorate, '')), '');
  dist := NULLIF(btrim(coalesce(p_district, '')), '');
  lm := btrim(coalesce(p_landmark, ''));
  legacy_area := NULLIF(btrim(coalesce(p_area, '')), '');

  IF gov IS NOT NULL AND dist IS NOT NULL THEN
    area_for_row := dist;
  ELSIF legacy_area IS NOT NULL THEN
    area_for_row := legacy_area;
    gov := NULL;
    dist := NULL;
  ELSE
    RAISE EXCEPTION 'invalid_location';
  END IF;

  addr_row := NULLIF(btrim(coalesce(p_address, '')), '');
  IF addr_row IS NULL AND lm <> '' THEN
    addr_row := lm;
  END IF;

  SELECT ag.id INTO v_agency_id
  FROM public.agencies ag
  WHERE ag.owner_id = uid
  LIMIT 1;

  INSERT INTO public.properties (
    owner_id,
    title,
    description,
    price,
    area,
    unit_type,
    address,
    governorate,
    district,
    landmark,
    status,
    was_charged,
    images,
    device_id,
    video_url,
    rental_unit,
    beds_count,
    listing_purpose,
    listing_type,
    agency_id
  ) VALUES (
    uid,
    btrim(p_title),
    coalesce(p_description, ''),
    p_price,
    area_for_row,
    btrim(p_unit_type),
    coalesce(addr_row, ''),
    gov,
    dist,
    NULLIF(lm, ''),
    'pending_approval',
    true,
    '[]'::jsonb,
    dev_key,
    NULLIF(btrim(coalesce(p_video_url, '')), ''),
    CASE
      WHEN purpose = 'sale' THEN NULL::public.rental_unit_type
      WHEN ru_raw IS NULL THEN NULL::public.rental_unit_type
      WHEN ru_raw = 'bed' THEN 'bed'::public.rental_unit_type
      WHEN ru_raw = 'room' THEN 'room'::public.rental_unit_type
      ELSE NULL::public.rental_unit_type
    END,
    beds_final,
    purpose,
    purpose,
    v_agency_id
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_property_submission(
  text, text, numeric, text, text, text, text, text, text, integer, text, text, text, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.handle_property_submission(
  text, text, numeric, text, text, text, text, text, text, integer, text, text, text, text
) TO authenticated;
