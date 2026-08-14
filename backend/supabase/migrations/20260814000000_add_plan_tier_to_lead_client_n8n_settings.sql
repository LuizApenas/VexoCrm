-- Adiciona colunas plan_tier e modulos_avulsos em lead_client_n8n_settings
ALTER TABLE public.lead_client_n8n_settings ADD COLUMN IF NOT EXISTS plan_tier TEXT DEFAULT 'essencial';
ALTER TABLE public.lead_client_n8n_settings ADD COLUMN IF NOT EXISTS modulos_avulsos JSONB DEFAULT '[]'::jsonb;
