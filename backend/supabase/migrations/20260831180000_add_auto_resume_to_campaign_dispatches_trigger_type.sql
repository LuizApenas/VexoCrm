-- Adiciona 'auto_resume' e 'draft' à constraint campaign_dispatches_trigger_type_check
-- Permite que o boot-recovery retome lotes interrompidos e que rascunhos sejam salvos

ALTER TABLE public.campaign_dispatches DROP CONSTRAINT IF EXISTS campaign_dispatches_trigger_type_check;

ALTER TABLE public.campaign_dispatches
  ADD CONSTRAINT campaign_dispatches_trigger_type_check
  CHECK (trigger_type IN ('manual', 'scheduled', 'auto_resume', 'draft'));
