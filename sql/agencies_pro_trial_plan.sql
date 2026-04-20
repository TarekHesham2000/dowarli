-- دَورلي — تجربة Pro 10 أيام لكل شركة/موقع عقاري جديد + عمود plan_type (مرة واحدة في SQL Editor)
-- يعتمد على نوع agency_subscription_status الموجود (free | pro | expired).

ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS trial_expires_at timestamptz;

ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS plan_type text NOT NULL DEFAULT 'free';

COMMENT ON COLUMN public.agencies.trial_expires_at IS 'When set with plan pro, trial end time (UTC). App reverts to free after expiry.';
COMMENT ON COLUMN public.agencies.plan_type IS 'Marketing label: pro | free — kept in sync with subscription_status for trials.';

-- Runs first (name sorts before trg_agencies_pro_sets_verified): force Pro + trial on every INSERT.
CREATE OR REPLACE FUNCTION public.agencies_apply_new_pro_trial()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- إنشاءات الإدارة (منصة / تحويل مستخدم) تُدخل بـ is_verified = true — لا نفرض تجربة Pro عليها.
  IF COALESCE(NEW.is_verified, false) THEN
    RETURN NEW;
  END IF;

  NEW.trial_expires_at := COALESCE(NEW.trial_expires_at, (timezone('utc', now()) + interval '10 days'));
  NEW.plan_type := 'pro';
  NEW.subscription_status := 'pro'::public.agency_subscription_status;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_agencies_00_new_pro_trial ON public.agencies;
CREATE TRIGGER trg_agencies_00_new_pro_trial
  BEFORE INSERT ON public.agencies
  FOR EACH ROW
  EXECUTE FUNCTION public.agencies_apply_new_pro_trial();

-- على PostgreSQL أقدم: استبدل EXECUTE FUNCTION بـ EXECUTE PROCEDURE
