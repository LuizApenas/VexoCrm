-- Migration: Corrige check constraints de followup_schedules e followup_jobs
-- Permite 'manual' e outras origens válidas em origin_type
-- Data: 2026-08-27

DO $$
BEGIN
  -- 1. followup_schedules origin_type check (permite 'manual' do Banco de Dados)
  ALTER TABLE public.followup_schedules DROP CONSTRAINT IF EXISTS followup_schedules_origin_type_check;
  ALTER TABLE public.followup_schedules
    ADD CONSTRAINT followup_schedules_origin_type_check
    CHECK (origin_type IS NULL OR origin_type IN ('manual', 'utm', 'default', 'api', 'webhook', 'import'));

  -- 2. followup_schedules status check (permite 'cancelled' e 'converted')
  ALTER TABLE public.followup_schedules DROP CONSTRAINT IF EXISTS followup_schedules_status_check;
  ALTER TABLE public.followup_schedules
    ADD CONSTRAINT followup_schedules_status_check
    CHECK (status IN ('active', 'canceled', 'cancelled', 'completed', 'converted', 'missing_phone'));

  -- 3. followup_jobs status check (permite 'cancelled')
  ALTER TABLE public.followup_jobs DROP CONSTRAINT IF EXISTS followup_jobs_status_check;
  ALTER TABLE public.followup_jobs
    ADD CONSTRAINT followup_jobs_status_check
    CHECK (status IN ('pending', 'sent', 'failed', 'skipped', 'canceled', 'cancelled'));
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;
