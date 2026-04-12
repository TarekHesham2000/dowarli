-- =============================================================================
-- دَورلي — Welcome points banner flag, default points=100, saved searches, alerts
-- Run once in Supabase SQL Editor after points_system_migration.sql
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS welcome_points_banner_seen boolean NOT NULL DEFAULT false;

UPDATE public.profiles
SET welcome_points_banner_seen = true
WHERE welcome_points_banner_seen IS NOT DISTINCT FROM false;

ALTER TABLE public.profiles
  ALTER COLUMN points SET DEFAULT 100;

-- ---------------------------------------------------------------------------
-- saved_searches: user alert criteria (JSON from home search UI)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.saved_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  filters jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saved_searches_user_id ON public.saved_searches (user_id);

ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saved_searches_select_own" ON public.saved_searches;
CREATE POLICY "saved_searches_select_own"
  ON public.saved_searches FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "saved_searches_insert_own" ON public.saved_searches;
CREATE POLICY "saved_searches_insert_own"
  ON public.saved_searches FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "saved_searches_delete_own" ON public.saved_searches;
CREATE POLICY "saved_searches_delete_own"
  ON public.saved_searches FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- In-app notifications created by Edge Function (service role) on property match
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.property_alert_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  property_id bigint NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  saved_search_id uuid REFERENCES public.saved_searches (id) ON DELETE SET NULL,
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT property_alert_notifications_user_prop_unique UNIQUE (user_id, property_id)
);

CREATE INDEX IF NOT EXISTS idx_property_alert_notifications_user_created
  ON public.property_alert_notifications (user_id, created_at DESC);

ALTER TABLE public.property_alert_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "property_alert_notifications_select_own" ON public.property_alert_notifications;
CREATE POLICY "property_alert_notifications_select_own"
  ON public.property_alert_notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "property_alert_notifications_update_own" ON public.property_alert_notifications;
CREATE POLICY "property_alert_notifications_update_own"
  ON public.property_alert_notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());
