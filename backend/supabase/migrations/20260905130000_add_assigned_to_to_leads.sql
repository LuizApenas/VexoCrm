-- Migration: Add assigned_to column and compound index to leads table
-- Enables per-operator lead assignment and dashboard role-based filtering (Item D)

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS assigned_to TEXT;

CREATE INDEX IF NOT EXISTS idx_leads_assigned_to
  ON public.leads (client_id, assigned_to);
