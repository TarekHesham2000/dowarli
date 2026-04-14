-- Optional Phase-2: coarse device class for view analytics (no raw User-Agent stored)
-- Run after agency_analytics_and_crm.sql

ALTER TABLE public.property_listing_view_events
  ADD COLUMN IF NOT EXISTS client_device_hint text;

ALTER TABLE public.property_listing_view_events DROP CONSTRAINT IF EXISTS property_listing_view_events_device_hint_check;
ALTER TABLE public.property_listing_view_events
  ADD CONSTRAINT property_listing_view_events_device_hint_check
  CHECK (
    client_device_hint IS NULL
    OR client_device_hint IN ('mobile', 'desktop', 'unknown')
  );

COMMENT ON COLUMN public.property_listing_view_events.client_device_hint IS
  'Set by client: mobile | desktop | unknown. INSERT policy unchanged; optional column.';
