-- Adiciona coluna degustacao_expira_em em lead_client_n8n_settings
ALTER TABLE public.lead_client_n8n_settings ADD COLUMN IF NOT EXISTS degustacao_expira_em TIMESTAMPTZ;
