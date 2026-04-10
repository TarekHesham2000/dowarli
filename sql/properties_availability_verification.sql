-- =============================================================================
-- دَورلي — توافر العقار، التحقق، والإبلاغات (تشغيل مرة في Supabase SQL Editor)
-- =============================================================================
-- للبلاغات المسجّلة، جدول reports، RPC، وlow_trust: نفّذ بعده
--   sql/properties_reports_trust_migration.sql
-- ملاحظة: عمود properties.status الحالي يبقى لحالة الإعلان (active / pending / rejected).
-- حقل التوافر الفعلي للوحدة هو availability_status أدناه (available / rented / under_review).

-- 1) أعمدة التوافر والتحقق والإبلاغات
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS availability_status text NOT NULL DEFAULT 'available';

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS last_verified_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS report_count integer NOT NULL DEFAULT 0;

-- قيود القيم (مرة واحدة؛ قد يفشل إن كان الاسم مستخدماً — احذف القديم أو عدّل الاسم)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'properties_availability_status_check'
  ) THEN
    ALTER TABLE public.properties
      ADD CONSTRAINT properties_availability_status_check
      CHECK (availability_status IN ('available', 'rented', 'under_review'));
  END IF;
END $$;

-- اختياري: جعل «آخر تأكيد» يعكس تاريخ الإنشاء للصفوف القديمة بدل وقت تشغيل السكربت
-- UPDATE public.properties SET last_verified_at = created_at WHERE last_verified_at IS NOT NULL;

-- 2) عند وصول الإبلاغات إلى 3 أو أكثر → مراجعة تلقائية
CREATE OR REPLACE FUNCTION public.properties_sync_availability_on_reports()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.report_count IS NOT NULL AND NEW.report_count >= 3 THEN
    NEW.availability_status := 'under_review';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_properties_report_review ON public.properties;
CREATE TRIGGER trg_properties_report_review
  BEFORE INSERT OR UPDATE OF report_count ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION public.properties_sync_availability_on_reports();

-- على PostgreSQL أقدم من 14 استبدل السطر أعلاه بـ:
--   EXECUTE PROCEDURE public.properties_sync_availability_on_reports();
