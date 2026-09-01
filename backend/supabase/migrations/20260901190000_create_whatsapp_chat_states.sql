-- Migration: 20260901190000_create_whatsapp_chat_states.sql
-- Tabela para persistência de estados das conversas do WhatsApp (ativa, automacao, arquivada, lixeira)

CREATE TABLE IF NOT EXISTS public.whatsapp_chat_states (
  client_id TEXT NOT NULL,
  phone TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'ativa',
  reason TEXT,
  source TEXT NOT NULL DEFAULT 'auto',
  changed_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (client_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_chat_states_client_state
  ON public.whatsapp_chat_states (client_id, state);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'whatsapp_chat_states_state_check'
  ) THEN
    ALTER TABLE public.whatsapp_chat_states
      ADD CONSTRAINT whatsapp_chat_states_state_check
      CHECK (state IN ('ativa', 'automacao', 'arquivada', 'lixeira'));
  END IF;
END $$;
