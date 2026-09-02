-- Migration: Add 'inbound' to leads_lead_source_check constraint and attended columns to chat states
-- 1. Garante que contatos cadastrados a partir de conversas inbound do WhatsApp
--    tenham um valor honesto e canônico na coluna lead_source sem violar a CHECK constraint.
ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_lead_source_check;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_lead_source_check
  CHECK (lead_source IS NULL OR lead_source IN (
    'campanha',
    'organico',
    'trafego_pago',
    'whatsapp_ads',
    'indicacao',
    'outro',
    'extracao_whatsapp',
    'inbound'
  ));

-- 2. Adiciona colunas para rastrear atendimento pontual sem precisar arquivar a conversa
ALTER TABLE public.whatsapp_chat_states
  ADD COLUMN IF NOT EXISTS attended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS attended_by TEXT;
