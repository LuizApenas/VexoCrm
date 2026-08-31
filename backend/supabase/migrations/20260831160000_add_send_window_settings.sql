-- 20260831160000_add_send_window_settings.sql
-- Janela de Horário Permitido para Envio de Mensagens por Tenant

ALTER TABLE public.lead_client_n8n_settings
  ADD COLUMN IF NOT EXISTS send_window_start TEXT DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS send_window_end TEXT DEFAULT '20:00',
  ADD COLUMN IF NOT EXISTS send_window_days TEXT[] DEFAULT ARRAY['mon','tue','wed','thu','fri'],
  ADD COLUMN IF NOT EXISTS send_window_timezone TEXT DEFAULT 'America/Sao_Paulo',
  ADD COLUMN IF NOT EXISTS send_window_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS agent_replies_outside_window BOOLEAN DEFAULT true;

-- Comentários para documentação de schema
COMMENT ON COLUMN public.lead_client_n8n_settings.send_window_start IS 'Horário de início da janela de envio permitida (HH:mm)';
COMMENT ON COLUMN public.lead_client_n8n_settings.send_window_end IS 'Horário de término da janela de envio permitida (HH:mm)';
COMMENT ON COLUMN public.lead_client_n8n_settings.send_window_days IS 'Dias da semana permitidos para envio (sun, mon, tue, wed, thu, fri, sat)';
COMMENT ON COLUMN public.lead_client_n8n_settings.send_window_timezone IS 'Fuso horário de referência do tenant (ex: America/Sao_Paulo)';
COMMENT ON COLUMN public.lead_client_n8n_settings.send_window_enabled IS 'Indica se a trava de janela de envio está ativa para o tenant';
COMMENT ON COLUMN public.lead_client_n8n_settings.agent_replies_outside_window IS 'Se verdadeiro, o Agente IA responde mensagens inbound mesmo fora do horário de envio';
