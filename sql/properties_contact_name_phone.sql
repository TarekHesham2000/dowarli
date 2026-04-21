-- دَورلي — بيانات مسؤول التواصل للإعلان (وكالات): اسم + رقم على مستوى العقار
-- نفّذ مرة واحدة في Supabase SQL Editor.

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS contact_name text;

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS contact_phone text;

COMMENT ON COLUMN public.properties.contact_name IS 'Optional listing contact display name (e.g. agency staff); falls back to owner profile in app when null.';
COMMENT ON COLUMN public.properties.contact_phone IS 'Optional listing WhatsApp/call number (local 01x…); falls back to owner profile phone in app when null.';
