-- دَورلي — منطقة فرعية + فهرسة نص العنوان الكامل للبحث (مرة واحدة في SQL Editor)
-- -----------------------------------------------------------------------------

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS sub_area text;

COMMENT ON COLUMN public.properties.sub_area IS 'Finer location inside district (e.g. حي الزهور) — often AI-parsed from detailed address.';

-- Full listing address for search (raw user text when AI splits district/landmark).
-- App writes `address` with the full detailed string on submit.
CREATE INDEX IF NOT EXISTS idx_properties_address_lower
  ON public.properties (lower(coalesce(address, '')))
  WHERE coalesce(btrim(address), '') <> '';

-- Optional: trigram for ilike %keyword% (requires extension; skip if your project disallows it)
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- CREATE INDEX IF NOT EXISTS idx_properties_address_trgm
--   ON public.properties USING gin (address gin_trgm_ops);
