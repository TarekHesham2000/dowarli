-- Allow property owners to read leads on their listings (agency dashboard aggregates by property_id).
-- Safe to add alongside other SELECT policies (RLS ORs permissive policies).
--
-- If auto-link on /become-an-agency fails (UPDATE properties.agency_id), ensure an UPDATE policy exists
-- for listing owners (owner_id = auth.uid()) on public.properties.

DROP POLICY IF EXISTS "leads_select_property_owner" ON public.leads;
CREATE POLICY "leads_select_property_owner"
  ON public.leads FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = leads.property_id AND p.owner_id = auth.uid()
    )
  );
