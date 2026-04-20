-- Agency public landing theme (primary accent). One of the preset hex values from the app.
ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS theme_color text NOT NULL DEFAULT '#00d38d';

COMMENT ON COLUMN public.agencies.theme_color IS
  'Primary accent for /agency/[slug]. Allowed: #D4AF37, #1E3A8A, #10B981, #00d38d (normalized in app).';
