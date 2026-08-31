-- 1. Cria tabela de cache para pré-validação de números WhatsApp
CREATE TABLE IF NOT EXISTS public.whatsapp_number_validations (
  phone TEXT PRIMARY KEY,
  exists_whatsapp BOOLEAN NOT NULL DEFAULT false,
  jid TEXT,
  validated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_number_validations_phone
  ON public.whatsapp_number_validations (phone, validated_at DESC);

-- 2. Atualiza constraint de status em campaign_dispatch_runs para permitir 'invalid_number'
ALTER TABLE public.campaign_dispatch_runs
  DROP CONSTRAINT IF EXISTS campaign_dispatch_runs_status_check;

ALTER TABLE public.campaign_dispatch_runs
  ADD CONSTRAINT campaign_dispatch_runs_status_check
  CHECK (status IN ('pending', 'claimed', 'sent', 'failed', 'skipped', 'invalid_number'));
