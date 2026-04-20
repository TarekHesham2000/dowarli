-- دَورلي — انتهاء صلاحية الإعلان + توسيع system_settings
-- نفّذ مرة واحدة في Supabase SQL Editor (بعد system_settings الأساسي).

-- ─── system_settings: وصف اختياري لكل مفتاح ───
ALTER TABLE public.system_settings
  ADD COLUMN IF NOT EXISTS description text;

COMMENT ON COLUMN public.system_settings.description IS 'تعليقات إدارية للوحة التحكم (اختياري).';

INSERT INTO public.system_settings (key, value, description)
VALUES
  ('ad_duration_days', '30', 'عدد أيام ظهور الإعلان بعد الإنشاء (يُحسب expires_at تلقائياً).')
ON CONFLICT (key) DO UPDATE
SET
  description = COALESCE(EXCLUDED.description, public.system_settings.description);

UPDATE public.system_settings
SET description = 'رقم محفظة / فودافون كاش لشحن النقاط والاشتراكات.'
WHERE key = 'wallet_phone' AND (description IS NULL OR btrim(description) = '');

UPDATE public.system_settings
SET description = 'معرّف InstaPay للتحويل اليدوي.'
WHERE key = 'instapay_id' AND (description IS NULL OR btrim(description) = '');

-- ─── properties.expires_at ───
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

COMMENT ON COLUMN public.properties.expires_at IS 'After this instant, hide from public home/search/chat unless NULL (no limit).';

-- ─── handle_property_submission: يضبط expires_at من ad_duration_days ───
DO $$
DECLARE
  r record;
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
  v_duration_days integer := 30;
  v_val text;
  v_expires timestamptz;
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

  SELECT s.value INTO v_val FROM public.system_settings s WHERE s.key = 'ad_duration_days' LIMIT 1;
  IF v_val IS NOT NULL AND btrim(v_val) ~ '^[0-9]+$' THEN
    v_duration_days := (btrim(v_val))::integer;
  END IF;
  IF v_duration_days IS NULL OR v_duration_days < 1 THEN
    v_duration_days := 30;
  END IF;
  IF v_duration_days > 3650 THEN
    v_duration_days := 3650;
  END IF;
  v_expires := (timezone('utc', now()) + (v_duration_days::text || ' days')::interval);

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
    agency_id,
    expires_at
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
    v_agency_id,
    v_expires
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
