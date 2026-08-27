-- Migration: Corrige check constraints de followup_schedules e followup_jobs
-- Padroniza status 'cancelled' (2 'l's) e restringe origin_type a ('manual', 'utm', 'default')
-- Data: 2026-08-27

-- 0. Normalização de dados históricos (corrige qualquer ocorrência prévia de 'canceled')
UPDATE public.followup_schedules SET status = 'cancelled' WHERE status = 'canceled';
UPDATE public.followup_jobs SET status = 'cancelled' WHERE status = 'canceled';

-- 1. followup_schedules.origin_type: estrito aos valores reais existentes
ALTER TABLE public.followup_schedules DROP CONSTRAINT IF EXISTS followup_schedules_origin_type_check;
ALTER TABLE public.followup_schedules
  ADD CONSTRAINT followup_schedules_origin_type_check
  CHECK (origin_type IS NULL OR origin_type IN ('manual', 'utm', 'default'));

-- 2. followup_schedules.status: grafia única
ALTER TABLE public.followup_schedules DROP CONSTRAINT IF EXISTS followup_schedules_status_check;
ALTER TABLE public.followup_schedules
  ADD CONSTRAINT followup_schedules_status_check
  CHECK (status IN ('active', 'cancelled', 'completed', 'converted', 'missing_phone'));

-- 3. followup_jobs.status: grafia única
ALTER TABLE public.followup_jobs DROP CONSTRAINT IF EXISTS followup_jobs_status_check;
ALTER TABLE public.followup_jobs
  ADD CONSTRAINT followup_jobs_status_check
  CHECK (status IN ('pending', 'sent', 'failed', 'skipped', 'cancelled'));
