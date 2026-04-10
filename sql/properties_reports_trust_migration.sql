-- =============================================================================
-- دَورلي — بلاغات العقارات، الثقة، وإعادة التحقق (Supabase SQL Editor — مرة واحدة)
-- =============================================================================
-- يكمّل sql/properties_availability_verification.sql إن كان مُنفَّذاً مسبقاً.
-- عمود properties.status يبقى لحالة الإعلان (active/pending/rejected).
-- availability_status = توافر الوحدة (available/rented/under_review).

-- ─── 1) جدول البلاغات ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id bigint NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reports_property_user_unique UNIQUE (property_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_reports_property_id ON public.reports (property_id);
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON public.reports (user_id);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- لا سياسات SELECT/INSERT للعموم — الإدراج عبر الدالة SECURITY DEFINER فقط

-- ─── 2) أعمدة إضافية على properties ───────────────────────────────────────
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS last_action_by_broker timestamptz;

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS under_review_at timestamptz;

-- ─── 3) ملف الوسيط: ثقة منخفضة ────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS low_trust boolean NOT NULL DEFAULT false;

-- ─── 4) سجل دخول العقارات تحت المراجعة (لحساب >5 في 30 يوماً) ─────────────
CREATE TABLE IF NOT EXISTS public.broker_under_review_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id bigint NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  broker_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bur_broker_created
  ON public.broker_under_review_events (broker_id, created_at DESC);

-- ─── 5) تحديث trigger التوافر عند report_count ─────────────────────────────
CREATE OR REPLACE FUNCTION public.properties_sync_availability_on_reports()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.report_count IS NOT NULL AND NEW.report_count >= 3 THEN
    NEW.availability_status := 'under_review';
    IF TG_OP = 'INSERT' OR COALESCE(OLD.report_count, 0) < 3 THEN
      NEW.under_review_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_properties_report_review ON public.properties;
CREATE TRIGGER trg_properties_report_review
  BEFORE INSERT OR UPDATE OF report_count ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION public.properties_sync_availability_on_reports();

-- Postgres < 14: EXECUTE PROCEDURE public.properties_sync_availability_on_reports();

-- ─── 6) تسجيل الحدث + تحديث low_trust ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_broker_under_review_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cnt int;
  v_old text;
BEGIN
  IF NEW.availability_status <> 'under_review' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_old := OLD.availability_status;
  ELSE
    v_old := NULL;
  END IF;

  IF v_old IS DISTINCT FROM 'under_review' THEN
    INSERT INTO public.broker_under_review_events (property_id, broker_id)
    VALUES (NEW.id, NEW.owner_id);

    SELECT COUNT(*)::int INTO v_cnt
    FROM public.broker_under_review_events e
    WHERE e.broker_id = NEW.owner_id
      AND e.created_at > now() - interval '30 days';

    UPDATE public.profiles
    SET low_trust = (v_cnt > 5)
    WHERE id = NEW.owner_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_properties_log_under_review ON public.properties;
CREATE TRIGGER trg_properties_log_under_review
  AFTER INSERT OR UPDATE OF availability_status ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION public.log_broker_under_review_event();

-- ─── 7) RPC: بلاغ من مستخدم مسجّل (إدراج + زيادة report_count) ──────────────
CREATE OR REPLACE FUNCTION public.report_property_unavailable(p_property_id bigint, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_status text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  SELECT owner_id, status INTO v_owner, v_status
  FROM public.properties
  WHERE id = p_property_id;

  IF v_owner IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_owner = v_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'own_listing');
  END IF;

  IF v_status IS DISTINCT FROM 'active' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_reportable');
  END IF;

  INSERT INTO public.reports (property_id, user_id, reason)
  VALUES (
    p_property_id,
    v_uid,
    NULLIF(trim(COALESCE(p_reason, '')), '')
  );

  UPDATE public.properties
  SET report_count = COALESCE(report_count, 0) + 1
  WHERE id = p_property_id;

  RETURN jsonb_build_object('ok', true);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_reported');
END;
$$;

REVOKE ALL ON FUNCTION public.report_property_unavailable(bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_property_unavailable(bigint, text) TO authenticated;

-- ─── 8) RPC: إعادة التحقق من الوسيط (تبريد 24 ساعة أو إقرار) ───────────────
CREATE OR REPLACE FUNCTION public.broker_reverify_listing(
  p_property_id bigint,
  p_truth_declaration boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_av text;
  v_ur_at timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  SELECT owner_id, availability_status, under_review_at
  INTO v_owner, v_av, v_ur_at
  FROM public.properties
  WHERE id = p_property_id;

  IF v_owner IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_owner <> v_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  IF v_av IS DISTINCT FROM 'under_review' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_under_review');
  END IF;

  IF NOT COALESCE(p_truth_declaration, false) THEN
    IF v_ur_at IS NOT NULL AND now() < v_ur_at + interval '24 hours' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'cooldown');
    END IF;
  END IF;

  UPDATE public.properties
  SET
    availability_status = 'available',
    report_count = 0,
    last_verified_at = now(),
    last_action_by_broker = now(),
    under_review_at = NULL
  WHERE id = p_property_id
    AND owner_id = v_uid;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.broker_reverify_listing(bigint, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.broker_reverify_listing(bigint, boolean) TO authenticated;
