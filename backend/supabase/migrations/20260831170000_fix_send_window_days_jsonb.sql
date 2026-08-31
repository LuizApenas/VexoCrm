-- 20260831170000_fix_send_window_days_jsonb.sql
-- Garante tipo JSONB para send_window_days e todas as colunas de janela de envio

ALTER TABLE public.lead_client_n8n_settings
  ADD COLUMN IF NOT EXISTS send_window_start TEXT DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS send_window_end TEXT DEFAULT '20:00',
  ADD COLUMN IF NOT EXISTS send_window_days JSONB DEFAULT '["mon","tue","wed","thu","fri"]'::jsonb,
  ADD COLUMN IF NOT EXISTS send_window_timezone TEXT DEFAULT 'America/Sao_Paulo',
  ADD COLUMN IF NOT EXISTS send_window_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS agent_replies_outside_window BOOLEAN DEFAULT true;

-- Converte a coluna send_window_days para JSONB caso tenha sido criada como TEXT[]
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'lead_client_n8n_settings' 
      AND column_name = 'send_window_days' 
      AND data_type = 'ARRAY'
  ) THEN
    ALTER TABLE public.lead_client_n8n_settings 
      ALTER COLUMN send_window_days TYPE JSONB USING to_jsonb(send_window_days);
    ALTER TABLE public.lead_client_n8n_settings 
      ALTER COLUMN send_window_days SET DEFAULT '["mon","tue","wed","thu","fri"]'::jsonb;
  END IF;
END $$;
