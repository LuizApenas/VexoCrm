-- Garante que a tabela public.leads tenha TODAS as colunas que o chatbot/Agente IA e o
-- Banco de Dados leem/escrevem. Idempotente (ADD COLUMN IF NOT EXISTS).
--
-- Motivo: a tabela `leads` já existia em produção, então o `CREATE TABLE IF NOT EXISTS`
-- em lead-client-tables.js virava no-op e nunca adicionava as colunas novas. A migração
-- 20260505000012 adicionava `status_conversa`, mas seu baseline (migrate.js) só checava
-- `lead_import_items.status_conversa` — em produção a coluna existia lá mas NÃO em `leads`,
-- então a migração foi marcada como aplicada sem rodar o ALTER em `leads`. Resultado:
-- `column "status_conversa" does not exist` no endpoint /api/hardcoded-chat-leads (Agente IA).

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS status_conversa TEXT,
  ADD COLUMN IF NOT EXISTS finalizado BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS dados JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS mensagem TEXT,
  ADD COLUMN IF NOT EXISTS historico TEXT,
  ADD COLUMN IF NOT EXISTS lead_temperature TEXT,
  ADD COLUMN IF NOT EXISTS spin_fase TEXT,
  ADD COLUMN IF NOT EXISTS qualificacao TEXT,
  ADD COLUMN IF NOT EXISTS lead_score NUMERIC(8, 2),
  ADD COLUMN IF NOT EXISTS lead_origin TEXT,
  ADD COLUMN IF NOT EXISTS lead_source TEXT,
  ADD COLUMN IF NOT EXISTS source_campaign_id UUID,
  ADD COLUMN IF NOT EXISTS source_campaign_name TEXT,
  ADD COLUMN IF NOT EXISTS bot_ativo BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS tipo_cliente TEXT,
  ADD COLUMN IF NOT EXISTS faixa_consumo TEXT,
  ADD COLUMN IF NOT EXISTS cidade TEXT,
  ADD COLUMN IF NOT EXISTS estado TEXT,
  ADD COLUMN IF NOT EXISTS conta_energia TEXT,
  ADD COLUMN IF NOT EXISTS data_hora TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS potential_contract_value NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS first_contact_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS qualified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS behavior_meta JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS ultima_interacao_bot TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ultima_interacao_usuario TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_nascimento DATE,
  ADD COLUMN IF NOT EXISTS ultima_visita DATE,
  ADD COLUMN IF NOT EXISTS perfil_musical TEXT;

-- CHECKs de integridade dos enums, só se ainda não existirem (guardado por pg_constraint).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'leads_status_conversa_check' AND conrelid = 'public.leads'::regclass
  ) THEN
    ALTER TABLE public.leads
      ADD CONSTRAINT leads_status_conversa_check
      CHECK (status_conversa IS NULL OR status_conversa IN ('aguardando_usuario', 'em_atendimento', 'finalizado'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'leads_lead_temperature_check' AND conrelid = 'public.leads'::regclass
  ) THEN
    ALTER TABLE public.leads
      ADD CONSTRAINT leads_lead_temperature_check
      CHECK (lead_temperature IS NULL OR lead_temperature IN ('QUENTE', 'MORNO', 'FRIO'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'leads_spin_fase_check' AND conrelid = 'public.leads'::regclass
  ) THEN
    ALTER TABLE public.leads
      ADD CONSTRAINT leads_spin_fase_check
      CHECK (spin_fase IS NULL OR spin_fase IN ('situacao', 'problema', 'implicacao', 'necessidade'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'leads_lead_source_check' AND conrelid = 'public.leads'::regclass
  ) THEN
    ALTER TABLE public.leads
      ADD CONSTRAINT leads_lead_source_check
      CHECK (lead_source IS NULL OR lead_source IN ('campanha', 'organico', 'trafego_pago', 'whatsapp_ads', 'indicacao', 'outro'));
  END IF;
END $$;
