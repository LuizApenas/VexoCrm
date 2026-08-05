-- Função do agente: qualificador (responde quem foi disparado) ou atendimento
-- (responde quem procurou a empresa).
--
-- Até aqui a distinção existia só na cabeça de quem configurou: o mesmo campo
-- servia para os dois casos e a diferença era o nome dado ao agente e quais
-- números foram marcados. Com a coluna, a tela separa as duas listas e o
-- backend pode registrar qual papel atendeu cada conversa.
--
-- Default 'atendimento' preserva o comportamento das linhas que já existem.

ALTER TABLE public.followup_companies
  ADD COLUMN IF NOT EXISTS inbound_role TEXT NOT NULL DEFAULT 'atendimento';

ALTER TABLE public.followup_companies
  DROP CONSTRAINT IF EXISTS followup_companies_inbound_role_check;

ALTER TABLE public.followup_companies
  ADD CONSTRAINT followup_companies_inbound_role_check
  CHECK (inbound_role IN ('atendimento', 'qualificador'));
