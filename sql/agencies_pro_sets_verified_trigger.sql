-- When subscription becomes Pro, list the agency publicly (is_verified) without a separate admin step.
CREATE OR REPLACE FUNCTION public.set_agency_verified_when_pro()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.subscription_status = 'pro' THEN
    NEW.is_verified := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_agencies_pro_sets_verified ON public.agencies;
CREATE TRIGGER trg_agencies_pro_sets_verified
  BEFORE INSERT OR UPDATE OF subscription_status ON public.agencies
  FOR EACH ROW
  EXECUTE FUNCTION public.set_agency_verified_when_pro();

COMMENT ON FUNCTION public.set_agency_verified_when_pro() IS 'Sets is_verified when subscription_status is pro';
