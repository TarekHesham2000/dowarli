-- =============================================================================
-- دَورلي — Agencies (multi-tenancy + subscriptions), property flags, leads CRM,
-- moderator audit log. Run once in Supabase SQL Editor after profiles/properties exist.
-- =============================================================================

-- ─── Enums ─────────────────────────────────────────────────────────────────
DO $$
BEGIN
  CREATE TYPE public.agency_subscription_status AS ENUM ('free', 'pro', 'expired');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.lead_interest_level AS ENUM ('hot', 'warm', 'cold');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ─── agencies ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.agencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  logo_url text,
  bio text,
  owner_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  subscription_status public.agency_subscription_status NOT NULL DEFAULT 'free',
  subscription_end_date timestamptz,
  ad_credits integer NOT NULL DEFAULT 0,
  CONSTRAINT agencies_ad_credits_non_negative CHECK (ad_credits >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS agencies_slug_unique ON public.agencies (lower(slug));
CREATE INDEX IF NOT EXISTS idx_agencies_owner_id ON public.agencies (owner_id);

ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.agencies.is_verified IS 'When true, agency is listed on public /agencies (admin-approved).';

CREATE INDEX IF NOT EXISTS idx_agencies_verified_name ON public.agencies (is_verified, lower(name))
  WHERE is_verified = true;

COMMENT ON TABLE public.agencies IS 'Brokerage / agency workspace; subscription and ad credits';
COMMENT ON COLUMN public.agencies.subscription_status IS 'free | pro | expired';
COMMENT ON COLUMN public.agencies.ad_credits IS 'Balance for featured placement (is_featured on properties)';

-- ─── properties: agency + quality / ads flags ─────────────────────────────
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES public.agencies (id) ON DELETE SET NULL;

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS is_approved boolean NOT NULL DEFAULT false;

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_properties_agency_id ON public.properties (agency_id)
  WHERE agency_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_properties_is_featured ON public.properties (is_featured)
  WHERE is_featured;

COMMENT ON COLUMN public.properties.agency_id IS 'Optional agency that owns this listing (multi-tenant)';
COMMENT ON COLUMN public.properties.is_approved IS 'Explicit moderator approval flag (complements status)';
COMMENT ON COLUMN public.properties.is_featured IS 'Promoted placement; typically consumes ad_credits on agency';

-- Backfill: existing live listings count as approved
UPDATE public.properties
SET is_approved = true
WHERE status = 'active' AND is_approved IS NOT DISTINCT FROM false;

-- ─── leads (CRM) ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  interest_level public.lead_interest_level NOT NULL DEFAULT 'warm',
  chat_summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_agency_created ON public.leads (agency_id, created_at DESC);

COMMENT ON TABLE public.leads IS 'Inbound CRM leads per agency';

-- ─── moderator_logs ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.moderator_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  moderator_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  action_type text NOT NULL,
  target_id text NOT NULL,
  "timestamp" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_moderator_logs_moderator ON public.moderator_logs (moderator_id, "timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_moderator_logs_action ON public.moderator_logs (action_type, "timestamp" DESC);

COMMENT ON TABLE public.moderator_logs IS 'Admin actions: approve_payment, approve_property, etc.; target_id is polymorphic text';
COMMENT ON COLUMN public.moderator_logs.target_id IS 'Opaque id of affected row (uuid, bigint as string, etc.)';

-- ─── RLS (baseline) ─────────────────────────────────────────────────────────
ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agencies_select_public" ON public.agencies;
CREATE POLICY "agencies_select_public"
  ON public.agencies FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "agencies_insert_owner" ON public.agencies;
CREATE POLICY "agencies_insert_owner"
  ON public.agencies FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "agencies_update_owner" ON public.agencies;
CREATE POLICY "agencies_update_owner"
  ON public.agencies FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "agencies_delete_owner" ON public.agencies;
CREATE POLICY "agencies_delete_owner"
  ON public.agencies FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leads_select_agency_owner" ON public.leads;
CREATE POLICY "leads_select_agency_owner"
  ON public.leads FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.agencies a
      WHERE a.id = leads.agency_id AND a.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "leads_insert_agency_owner" ON public.leads;
CREATE POLICY "leads_insert_agency_owner"
  ON public.leads FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agencies a
      WHERE a.id = agency_id AND a.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "leads_update_agency_owner" ON public.leads;
CREATE POLICY "leads_update_agency_owner"
  ON public.leads FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.agencies a
      WHERE a.id = leads.agency_id AND a.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agencies a
      WHERE a.id = agency_id AND a.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "leads_delete_agency_owner" ON public.leads;
CREATE POLICY "leads_delete_agency_owner"
  ON public.leads FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.agencies a
      WHERE a.id = leads.agency_id AND a.owner_id = auth.uid()
    )
  );

ALTER TABLE public.moderator_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "moderator_logs_admin_all" ON public.moderator_logs;
CREATE POLICY "moderator_logs_admin_all"
  ON public.moderator_logs FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );
