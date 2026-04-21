-- دَورلي — وسائل راحة متقدمة على مستوى الإعلان (وكالات)
-- نفّذ مرة واحدة في Supabase SQL Editor (بعد إنشاء الجدول properties).

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS amenities jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.properties.amenities IS 'Optional flags: gas, electricity_meter, water_meter, parking, elevator, security_services (booleans). Agency listings; see src/lib/propertyAmenities.ts';
