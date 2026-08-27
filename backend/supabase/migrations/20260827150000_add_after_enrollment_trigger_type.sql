-- Migration: Permite o novo tipo de gatilho 'after_enrollment' em followup_templates
-- Data: 2026-08-27

DO $$
BEGIN
  -- Remover constraint existente se houver
  ALTER TABLE public.followup_templates DROP CONSTRAINT IF EXISTS followup_templates_trigger_type_check;

  -- Adicionar constraint atualizada com after_enrollment
  ALTER TABLE public.followup_templates
    ADD CONSTRAINT followup_templates_trigger_type_check
    CHECK (trigger_type IN ('on_schedule', 'before_meeting', 'after_meeting', 'no_reply', 'after_enrollment'));
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;
