-- =============================================================================
-- دَورلي — platform_settings (single row) + user_system_notifications
-- Run in Supabase SQL Editor after public.properties / public.profiles exist.
-- Then run the block that replaces handle_admin_approval (depends on this table).
--
-- platform_settings columns (singleton id=1):
--   ad_post_cost_sale, ad_post_cost_rent, free_listing_limit, promo_discount_percentage,
--   sale_mode_enabled, sale_mode_bonus_points_percent, updated_at
-- Admin UI: /admin → تبويب «إعدادات». Public read via /api/platform-settings.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.platform_settings (
  id smallint PRIMARY KEY DEFAULT 1,
  CONSTRAINT platform_settings_singleton CHECK (id = 1),
  ad_post_cost_sale integer NOT NULL DEFAULT 50,
  ad_post_cost_rent integer NOT NULL DEFAULT 20,
  free_listing_limit integer NOT NULL DEFAULT 2,
  promo_discount_percentage numeric(5, 2) NOT NULL DEFAULT 0,
  sale_mode_enabled boolean NOT NULL DEFAULT false,
  sale_mode_bonus_points_percent numeric(5, 2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.platform_settings IS 'Singleton (id=1): dynamic listing point costs, promos, White Friday mode.';
COMMENT ON COLUMN public.platform_settings.promo_discount_percentage IS 'When sale_mode_enabled: percent discount off listing activation point costs (0–100).';
COMMENT ON COLUMN public.platform_settings.sale_mode_bonus_points_percent IS 'When sale_mode_enabled: extra percent granted on admin point top-ups (add-points).';

INSERT INTO public.platform_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_settings_select_authenticated" ON public.platform_settings;
CREATE POLICY "platform_settings_select_authenticated"
  ON public.platform_settings FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "platform_settings_select_anon" ON public.platform_settings;
CREATE POLICY "platform_settings_select_anon"
  ON public.platform_settings FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "platform_settings_update_admin" ON public.platform_settings;
CREATE POLICY "platform_settings_update_admin"
  ON public.platform_settings FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- ─── In-app system notifications (broker dashboard) ─────────────────────────
CREATE TABLE IF NOT EXISTS public.user_system_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_created
  ON public.user_system_notifications (user_id, created_at DESC);

COMMENT ON TABLE public.user_system_notifications IS 'Admin / system messages shown on user dashboard; read_at null = unread.';

ALTER TABLE public.user_system_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_notifications_select_own" ON public.user_system_notifications;
CREATE POLICY "user_notifications_select_own"
  ON public.user_system_notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_notifications_update_own" ON public.user_system_notifications;
CREATE POLICY "user_notifications_update_own"
  ON public.user_system_notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Inserts from browser are blocked; use service role via /api/admin/notify-user

-- ─── Replace handle_admin_approval to use platform_settings + sale discount ─
CREATE OR REPLACE FUNCTION public.handle_admin_approval(p_property_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prop RECORD;
  ps RECORD;
  cost int;
  base_cost int;
  purpose text;
  cur_pts int;
  discount numeric;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_property_id IS NULL THEN
    RAISE EXCEPTION 'invalid_property';
  END IF;

  SELECT id, status, owner_id, was_charged, listing_type, listing_purpose
  INTO prop
  FROM public.properties
  WHERE id = p_property_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'property_not_found';
  END IF;

  IF prop.status IS DISTINCT FROM 'pending_approval' AND prop.status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'not_pending_approval';
  END IF;

  purpose := lower(btrim(coalesce(
    nullif(btrim(prop.listing_type), ''),
    nullif(btrim(prop.listing_purpose), ''),
    'rent'
  )));
  IF purpose NOT IN ('rent', 'sale') THEN
    purpose := 'rent';
  END IF;

  SELECT *
  INTO ps
  FROM public.platform_settings
  WHERE id = 1;

  IF NOT FOUND THEN
    base_cost := CASE WHEN purpose = 'sale' THEN 50 ELSE 20 END;
    cost := base_cost;
  ELSE
    base_cost := CASE WHEN purpose = 'sale' THEN ps.ad_post_cost_sale ELSE ps.ad_post_cost_rent END;
    cost := base_cost;
    IF ps.sale_mode_enabled AND COALESCE(ps.promo_discount_percentage, 0) > 0 THEN
      discount := LEAST(100::numeric, GREATEST(0::numeric, ps.promo_discount_percentage));
      cost := GREATEST(1, FLOOR(base_cost * (1 - discount / 100.0))::int);
    END IF;
  END IF;

  IF COALESCE(prop.was_charged, false) THEN
    SELECT COALESCE(points, 0) INTO cur_pts
    FROM public.profiles
    WHERE id = prop.owner_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'owner_profile_not_found';
    END IF;

    IF cur_pts < cost THEN
      RAISE EXCEPTION 'insufficient_points_for_activation';
    END IF;

    UPDATE public.profiles
    SET points = cur_pts - cost
    WHERE id = prop.owner_id;
  END IF;

  UPDATE public.properties
  SET status = 'active', is_approved = true
  WHERE id = p_property_id;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_admin_approval(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_admin_approval(bigint) TO authenticated;
