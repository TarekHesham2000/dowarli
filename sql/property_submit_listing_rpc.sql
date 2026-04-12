-- =============================================================================
-- دَورلي — Atomic listing submit: insert pending_approval (points deducted on admin approval only)
-- Run once in Supabase SQL Editor after points_system_migration.sql
-- Pair with handle_admin_approval_rpc.sql for activation + point charge.
--
-- If INSERT fails on `images`: your column may be text[] — use ARRAY[]::text[]
-- instead of '[]'::jsonb, and skip the jsonb DEFAULT block below.
-- Enable Supabase Realtime on `public.profiles` if you want live points updates
-- in the Navbar when another session (e.g. admin) changes points.
--
-- ─── DB audit: enum columns on public.properties (run in SQL Editor) ────────
-- SELECT column_name, udt_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'properties'
-- ORDER BY ordinal_position;
--
-- List USER-DEFINED types used by the table:
-- SELECT c.column_name, c.udt_name
-- FROM information_schema.columns c
-- WHERE c.table_schema = 'public' AND c.table_name = 'properties'
--   AND c.data_type = 'USER-DEFINED';
--
-- Enum labels (example for rental_unit_type):
-- SELECT e.enumlabel FROM pg_enum e
-- JOIN pg_type t ON t.oid = e.enumtypid
-- WHERE t.typname = 'rental_unit_type';
--
-- WHY type mismatch: columns typed as ENUM require values of that enum type.
-- Expressions like btrim(p_rental_unit) are TEXT; Postgres will not assign
-- TEXT to rental_unit_type without an explicit ::rental_unit_type cast (or NULL).
-- =============================================================================

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS listing_purpose text NOT NULL DEFAULT 'rent';

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS listing_type text NOT NULL DEFAULT 'rent';

COMMENT ON COLUMN public.properties.listing_purpose IS 'rent | sale — drives points cost (20 vs 50)';
COMMENT ON COLUMN public.properties.listing_type IS 'Same as listing_purpose; app-facing name for feeds (rent | sale)';

UPDATE public.properties
SET listing_type = lower(btrim(coalesce(nullif(btrim(listing_purpose), ''), 'rent')))
WHERE listing_type IS DISTINCT FROM lower(btrim(coalesce(nullif(btrim(listing_purpose), ''), 'rent')));

-- ─── properties.status CHECK must allow pending_approval (RPC inserts it) ───
-- If you see: violates check constraint "properties_status_check"
-- the old rule was usually only (active, pending, rejected). Run this block once.
-- Inspect existing values first if ADD fails: SELECT DISTINCT status FROM public.properties;
ALTER TABLE public.properties DROP CONSTRAINT IF EXISTS properties_status_check;
ALTER TABLE public.properties
  ADD CONSTRAINT properties_status_check
  CHECK (
    status IN (
      'active',
      'pending',
      'pending_approval',
      'rejected',
      'archived'
    )
  );

-- Optional: normalize legacy rows still marked "pending"
UPDATE public.properties
SET status = 'pending_approval'
WHERE status = 'pending';

-- Ensure images has a JSON default when omitted (adjust if your column is text[] instead of jsonb)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'properties' AND column_name = 'images'
      AND data_type = 'jsonb'
  ) THEN
    ALTER TABLE public.properties ALTER COLUMN images SET DEFAULT '[]'::jsonb;
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.submit_property_with_points(
  text, text, numeric, text, text, text, text, text, text, integer, text
);

-- -----------------------------------------------------------------------------
-- RPC: handle_property_submission — caller = owner; was_charged set for paid slots (charge on admin approval)
-- -----------------------------------------------------------------------------
-- Drop every signature so an older overload cannot keep running (common cause of “still text” errors).
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
  p_listing_purpose text
) RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
  free_lim int := 2;
  cnt_user int := 0;
  cnt_dev int := 0;
  published_count int := 0;
  is_free boolean;
  new_id bigint;
  purpose text;
  dev_key text;
  ru_raw text;
  beds_final integer;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_title IS NULL OR btrim(p_title) = '' THEN
    RAISE EXCEPTION 'invalid_title';
  END IF;

  SELECT COALESCE((SELECT NULLIF(btrim(value), '')::int FROM public.settings WHERE key = 'free_property_limit' LIMIT 1), 2)
  INTO free_lim;

  purpose := lower(btrim(coalesce(p_listing_purpose, 'rent')));
  IF purpose NOT IN ('rent', 'sale') THEN
    RAISE EXCEPTION 'invalid_listing_purpose';
  END IF;

  SELECT count(*)::int INTO cnt_user
  FROM public.properties
  WHERE owner_id = uid
    AND status IN ('active', 'pending', 'pending_approval');

  dev_key := NULLIF(btrim(coalesce(p_device_id, '')), '');
  IF dev_key IS NOT NULL THEN
    SELECT count(*)::int INTO cnt_dev
    FROM public.properties
    WHERE device_id = dev_key
      AND status IN ('active', 'pending', 'pending_approval');
  ELSE
    cnt_dev := 0;
  END IF;

  published_count := GREATEST(cnt_user, cnt_dev);
  is_free := published_count < free_lim;

  -- rental_unit: enum — use a single CASE so every branch is rental_unit_type (never plain text).
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

  INSERT INTO public.properties (
    owner_id,
    title,
    description,
    price,
    area,
    unit_type,
    address,
    status,
    was_charged,
    images,
    device_id,
    video_url,
    rental_unit,
    beds_count,
    listing_purpose,
    listing_type
  ) VALUES (
    uid,
    btrim(p_title),
    coalesce(p_description, ''),
    p_price,
    btrim(p_area),
    btrim(p_unit_type),
    btrim(p_address),
    'pending_approval',
    NOT is_free,
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
    purpose
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_property_submission(
  text, text, numeric, text, text, text, text, text, text, integer, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.handle_property_submission(
  text, text, numeric, text, text, text, text, text, text, integer, text
) TO authenticated;

-- ─── Verify installed signatures (use p.oid — both pg_proc and pg_namespace have oid) ───
-- SELECT pg_catalog.pg_get_function_identity_arguments(p.oid) AS function_args
-- FROM pg_catalog.pg_proc p
-- JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public' AND p.proname = 'handle_property_submission';
