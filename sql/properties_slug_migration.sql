-- =============================================================================
-- دَورلي — Property URL slugs (/property/[slug]) + backfill + auto-maintain
-- Run once in Supabase SQL Editor.
-- =============================================================================

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS slug text;

CREATE UNIQUE INDEX IF NOT EXISTS properties_slug_unique
  ON public.properties (slug)
  WHERE slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_properties_slug_lookup ON public.properties (slug);

-- Slug: title with spaces → hyphens, strip path-like chars, max 100 chars + "-" + id (unique)
CREATE OR REPLACE FUNCTION public.properties_make_slug(p_title text, p_id bigint)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    left(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            btrim(coalesce(nullif(btrim(p_title), ''), 'عقار')),
            '\s+',
            '-',
            'g'
          ),
          '[/\\?#<>\[\]{}|]+',
          '',
          'g'
        ),
        '-{2,}',
        '-',
        'g'
      ),
      100
    )
    || '-'
    || p_id::text;
$$;

CREATE OR REPLACE FUNCTION public.properties_set_slug_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.properties
  SET slug = public.properties_make_slug(title, id)
  WHERE id = NEW.id AND (slug IS NULL OR btrim(slug) = '');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_properties_slug_after_insert ON public.properties;
CREATE TRIGGER trg_properties_slug_after_insert
  AFTER INSERT ON public.properties
  FOR EACH ROW
  EXECUTE PROCEDURE public.properties_set_slug_after_insert();

CREATE OR REPLACE FUNCTION public.properties_refresh_slug_on_title()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.title IS DISTINCT FROM OLD.title THEN
    NEW.slug := public.properties_make_slug(NEW.title, NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_properties_slug_before_update ON public.properties;
CREATE TRIGGER trg_properties_slug_before_update
  BEFORE UPDATE OF title ON public.properties
  FOR EACH ROW
  EXECUTE PROCEDURE public.properties_refresh_slug_on_title();

UPDATE public.properties p
SET slug = public.properties_make_slug(p.title, p.id)
WHERE p.slug IS NULL OR btrim(p.slug) = '';

COMMENT ON COLUMN public.properties.slug IS 'Path under /property/[slug]; ends with -{id} for uniqueness';
