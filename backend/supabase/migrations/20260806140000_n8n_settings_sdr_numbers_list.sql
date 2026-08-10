-- Varios numeros de SDR por tenant, em vez de um so.
--
-- O dono precisa mandar a qualificacao para mais de um numero, e vale para os
-- DOIS agentes (disparo e atendimento) — e a mesma configuracao do tenant,
-- consumida pelos dois caminhos, nao duas listas.
--
-- MIGRACAO SEM PERDA: quem ja tem sdr_whatsapp_number preenchido ganha uma
-- lista com aquele numero. Ninguem reconfigura nada.
--
-- A coluna antiga FICA. E o fallback de leitura enquanto houver linha nao
-- migrada, e remover coluna em uso e o tipo de mudanca que derruba producao no
-- meio do deploy.

ALTER TABLE public.lead_client_n8n_settings
  ADD COLUMN IF NOT EXISTS sdr_whatsapp_numbers JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.lead_client_n8n_settings
SET sdr_whatsapp_numbers = jsonb_build_array(sdr_whatsapp_number)
WHERE sdr_whatsapp_numbers = '[]'::jsonb
  AND sdr_whatsapp_number IS NOT NULL
  AND btrim(sdr_whatsapp_number) <> '';
