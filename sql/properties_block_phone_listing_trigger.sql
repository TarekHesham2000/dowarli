-- =============================================================================
-- دَورلي — منع وضع ١١ رقماً متتالياً في عنوان/وصف الإعلان (حجز التواصل للـ CRM)
-- نفّذ في Supabase SQL Editor بعد التأكد من وجود جدول public.properties
-- =============================================================================

CREATE OR REPLACE FUNCTION public.properties_reject_phone_in_listing_text()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  blob text;
  normalized text;
BEGIN
  blob := coalesce(new.title, '') || E'\n' || coalesce(new.description, '');
  normalized := translate(
    blob,
    '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
    '01234567890123456789',
  );
  IF normalized ~ '[0-9]{11}' THEN
    RAISE EXCEPTION 'ممنوع وضع أرقام تليفونات لضمان تسجيل بيانات العميل في الـ CRM الخاص بك.';
  END IF;
  RETURN new;
END;
$$;

COMMENT ON FUNCTION public.properties_reject_phone_in_listing_text() IS
  'Blocks INSERT/UPDATE when title or description contains 11 consecutive digits (phone leak).';

DROP TRIGGER IF EXISTS trg_properties_block_phone_listing ON public.properties;
CREATE TRIGGER trg_properties_block_phone_listing
  BEFORE INSERT OR UPDATE OF title, description ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION public.properties_reject_phone_in_listing_text();

-- PostgreSQL < 14: استبدل EXECUTE FUNCTION بـ:
--   EXECUTE PROCEDURE public.properties_reject_phone_in_listing_text();
