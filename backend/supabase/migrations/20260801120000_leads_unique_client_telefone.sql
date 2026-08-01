-- Índice único (client_id, telefone) em public.leads.
--
-- Motivo: o código faz upsert de lead por telefone (sync de conversas do WhatsApp e
-- extração de contatos do Banco de Dados). Sem um índice único nessas colunas, qualquer
-- `INSERT ... ON CONFLICT (client_id, telefone)` falha com "there is no unique or
-- exclusion constraint matching the ON CONFLICT specification" — o que já derrubou em
-- silêncio a gravação de nomes e a extração de contatos duas vezes, porque o índice
-- criado à mão sumiu quando a tabela foi recriada.
--
-- O código de upsert (services/leadUpsert.js) não depende mais deste índice — faz
-- UPDATE e, se não afetar linha, INSERT. Este índice existe para integridade
-- (impedir duplicidade de telefone por cliente) e performance da busca.
--
-- Remove duplicados antes de criar o índice, senão a criação falha.

DELETE FROM public.leads a
USING public.leads b
WHERE a.ctid < b.ctid
  AND a.client_id = b.client_id
  AND a.telefone = b.telefone;

CREATE UNIQUE INDEX IF NOT EXISTS leads_client_telefone_uidx
  ON public.leads (client_id, telefone);
