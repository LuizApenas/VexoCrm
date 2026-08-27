-- Migration: 20260827000000_add_lead_messages_message_timestamp.sql
-- Separa o timestamp real do WhatsApp (message_timestamp) do timestamp de auditoria de inserção (created_at).

ALTER TABLE public.lead_messages
ADD COLUMN IF NOT EXISTS message_timestamp TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_lead_messages_message_timestamp
ON public.lead_messages (client_id, message_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_lead_messages_effective_order
ON public.lead_messages (client_id, COALESCE(message_timestamp, delivered_at, created_at) DESC);
