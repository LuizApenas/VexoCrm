-- Migration: Permite lembretes avulsos no módulo de follow-up (sem cadência prévia)
-- Criação da coluna custom_message e flexibilização de NOT NULL com check constraint estrito

-- 1. Permite followup_schedules sem campanha (avulso)
ALTER TABLE public.followup_schedules ALTER COLUMN campaign_id DROP NOT NULL;

-- 2. Adiciona coluna custom_message e permite template_id nulo em followup_jobs
ALTER TABLE public.followup_jobs ADD COLUMN IF NOT EXISTS custom_message TEXT;
ALTER TABLE public.followup_jobs ALTER COLUMN template_id DROP NOT NULL;

-- 3. CHECK de integridade em followup_jobs: garante que todo job tem template_id OU custom_message preenchida e não vazia
ALTER TABLE public.followup_jobs DROP CONSTRAINT IF EXISTS followup_jobs_content_check;
ALTER TABLE public.followup_jobs
  ADD CONSTRAINT followup_jobs_content_check
  CHECK (
    (template_id IS NOT NULL)
    OR
    (template_id IS NULL AND custom_message IS NOT NULL AND length(trim(custom_message)) > 0)
  );
