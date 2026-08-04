-- Vários números de WhatsApp por agente.
--
-- Motivo: followup_companies.evolution_instance é TEXT único, então cada número
-- exigia uma linha própria — e um agente qualificador atendendo dez consultores
-- viraria dez configurações idênticas para manter em sincronia.
--
-- A coluna antiga NÃO sai: continua guardando o primeiro número da lista, para
-- não quebrar nada que a leia (o NOT NULL original segue satisfeito). A lista
-- completa passa a viver em evolution_instances, mesmo padrão já usado em
-- campaigns.analytics_meta.importIds.

ALTER TABLE public.followup_companies
  ADD COLUMN IF NOT EXISTS evolution_instances JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Backfill: quem já tinha um número passa a ter esse número na lista.
UPDATE public.followup_companies
SET evolution_instances = jsonb_build_array(evolution_instance)
WHERE evolution_instances = '[]'::jsonb
  AND evolution_instance IS NOT NULL
  AND btrim(evolution_instance) <> '';
