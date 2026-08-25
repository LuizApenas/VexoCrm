-- Migration: Add wa_message_id column and unique index to lead_messages for idempotency & deduplication
ALTER TABLE public.lead_messages
  ADD COLUMN IF NOT EXISTS wa_message_id VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_messages_wa_message_id
  ON public.lead_messages (client_id, wa_message_id)
  WHERE wa_message_id IS NOT NULL;
