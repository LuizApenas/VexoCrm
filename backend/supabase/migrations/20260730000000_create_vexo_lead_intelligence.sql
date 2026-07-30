-- Migration: 20260730000000_create_vexo_lead_intelligence.sql
-- Adiciona colunas e índices para o módulo Banco de Dados Inteligente (Vexo Lead Intelligence)

ALTER TABLE public.leads 
  ADD COLUMN IF NOT EXISTS tenant_id UUID,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS stage TEXT DEFAULT 'cold',
  ADD COLUMN IF NOT EXISTS temperature TEXT DEFAULT 'warm',
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS last_interaction_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS extracted_from_wa BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS raw_chat_summary TEXT;

-- Sincronizar dados existentes para compatibilidade de colunas
UPDATE public.leads 
SET phone = telefone 
WHERE phone IS NULL AND telefone IS NOT NULL;

-- Constraints para estágio e temperatura
ALTER TABLE public.leads 
  DROP CONSTRAINT IF EXISTS check_lead_stage;

ALTER TABLE public.leads 
  ADD CONSTRAINT check_lead_stage 
  CHECK (stage IS NULL OR stage IN ('buyer', 'open_budget', 'inquiry', 'cold', 'lost'));

ALTER TABLE public.leads 
  DROP CONSTRAINT IF EXISTS check_lead_temperature_v2;

ALTER TABLE public.leads 
  ADD CONSTRAINT check_lead_temperature_v2 
  CHECK (temperature IS NULL OR temperature IN ('hot', 'warm', 'cold'));

-- Índices otimizados para busca e relatórios por tenant e estágio
CREATE INDEX IF NOT EXISTS idx_leads_tenant_phone ON public.leads (client_id, telefone);
CREATE INDEX IF NOT EXISTS idx_leads_stage ON public.leads (stage);
CREATE INDEX IF NOT EXISTS idx_leads_temperature ON public.leads (temperature);
