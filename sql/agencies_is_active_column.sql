-- Visibility for public /agencies: list only verified + active agencies.
-- Run once in Supabase SQL Editor after public.agencies exists.

ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.agencies.is_active IS 'When false, hide from public directory even if is_verified (e.g. suspended).';

UPDATE public.agencies SET is_active = true WHERE is_active IS DISTINCT FROM true;

CREATE INDEX IF NOT EXISTS idx_agencies_public_directory
  ON public.agencies (is_verified, is_active, lower(name))
  WHERE is_verified = true AND is_active = true;
