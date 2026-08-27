-- Migration: Corrige check constraints de followup_schedules e followup_jobs
-- Padroniza status 'cancelled' (2 'l's) e restringe origin_type a ('manual', 'utm', 'default')
-- Data: 2026-08-27

DO $$
BEGIN
  -- 0. Normalização prévia de dados existentes com grafia antiga ('canceled' -> 'cancelled')
  UPDATE public.followup_schedules SET status = 'cancelled' WHERE status = 'canceled';
  UPDATE public.followup_jobs SET status = 'cancelled' WHERE status = 'canceled';

  -- 1. followup_schedules origin_type check (estrito: apenas origens reais existentes)
  ALTER TABLE public.followup_schedules DROP CONSTRAINT IF EXISTS followup_schedules_origin_type_check;
  ALTER TABLE public.followup_schedules
    ADD CONSTRAINT followup_schedules_origin_type_check
    CHECK (origin_type IS NULL OR origin_type IN ('manual', 'utm', 'default'));

  -- 2. followup_schedules status check (grafia única 'cancelled')
  ALTER TABLE public.followup_schedules DROP CONSTRAINT IF EXISTS followup_schedules_status_check;
  ALTER TABLE public.followup_schedules
    ADD CONSTRAINT followup_schedules_status_check
    CHECK (status IN ('active', 'cancelled', 'completed', 'converted', 'missing_phone'));

  -- 3. followup_jobs status check (grafia única 'cancelled')
  ALTER TABLE public.followup_jobs DROP CONSTRAINT IF EXISTS followup_jobs_status_check;
  ALTER TABLE public.followup_jobs
    ADD CONSTRAINT followup_jobs_status_check
    CHECK (status IN ('pending', 'sent', 'failed', 'skipped', 'cancelled'));
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;
