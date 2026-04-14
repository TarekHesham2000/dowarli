-- Phase 3: Advanced CRM — lead source, assignee label, priority, notes audit trail
-- Run in Supabase SQL Editor after agency_analytics_and_crm.sql

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS lead_source text;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS assignee_display text;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS crm_priority text NOT NULL DEFAULT 'medium';

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS lead_notes_history jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_lead_source_check;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_lead_source_check
  CHECK (
    lead_source IS NULL
    OR lead_source IN ('whatsapp', 'call', 'message', 'website', 'other')
  );

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_crm_priority_check;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_crm_priority_check
  CHECK (crm_priority IN ('low', 'medium', 'high'));

COMMENT ON COLUMN public.leads.lead_source IS 'Inbound channel: whatsapp | call | message | website | other';
COMMENT ON COLUMN public.leads.assignee_display IS 'Human-readable assignee (future: multi-agent); default agency owner';
COMMENT ON COLUMN public.leads.crm_priority IS 'Sales priority: low | medium | high';
COMMENT ON COLUMN public.leads.lead_notes_history IS 'Append-only [{at, text}] note snapshots for CRM modal';
