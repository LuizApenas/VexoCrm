-- Adiciona coluna recontact_message em lead_client_n8n_settings para frase customizada de recontato
ALTER TABLE public.lead_client_n8n_settings
  ADD COLUMN IF NOT EXISTS recontact_message TEXT;
