-- Migration: Add 'extracao_whatsapp' to leads_lead_source_check constraint
-- Garante que leads importados da extração de conversas e agenda do WhatsApp
-- tenham um valor honesto e canônico na coluna lead_source sem violar a CHECK constraint.

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
    'extracao_whatsapp'
  ));

-- Backfill autorizado para dar procedência honesta aos leads já extraídos sem sobrescrever origens de campanha
UPDATE public.leads
SET lead_source = 'extracao_whatsapp',
    updated_at = NOW()
WHERE extracted_from_wa = true
  AND lead_source IS NULL;
