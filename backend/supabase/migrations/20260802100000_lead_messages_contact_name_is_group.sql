-- contact_name e is_group em public.lead_messages.
--
-- Motivo: a aba Conversas precisa mostrar o nome do contato/grupo e distinguir
-- conversa de grupo. Antes o nome vinha de um upsert na tabela `leads`, o que
-- criava lead no Banco de Dados só por existir uma conversa (efeito colateral
-- indesejado). Guardando o nome na própria mensagem, o inbox exibe o nome sem
-- tocar na base de leads — extrair lead continua sendo ação deliberada.
--
-- is_group permite listar/filtrar grupos no inbox (o WhatsApp do cliente tem
-- conversas em grupo que precisam aparecer) e continuar excluindo grupos da
-- extração de leads, onde é preciso um telefone discável.

ALTER TABLE public.lead_messages
  ADD COLUMN IF NOT EXISTS contact_name TEXT,
  ADD COLUMN IF NOT EXISTS is_group BOOLEAN DEFAULT false;
