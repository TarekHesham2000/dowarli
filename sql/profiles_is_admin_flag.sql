-- Optional: grant admin UI access without changing public `role` display.
-- Run in Supabase SQL Editor if you want `is_admin` in addition to `role = 'admin'`.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.is_admin IS 'When true, user may access /admin (same effect as role = admin for gate checks).';
