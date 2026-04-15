-- Moderation-style approval flag for agencies (optional; API falls back if column missing).
ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';

COMMENT ON COLUMN public.agencies.status IS 'Agency lifecycle: pending | approved | rejected (directory visibility uses is_active).';

UPDATE public.agencies
SET status = 'approved'
WHERE is_verified IS true AND is_active IS NOT DISTINCT FROM true AND (status IS NULL OR status = 'pending');
