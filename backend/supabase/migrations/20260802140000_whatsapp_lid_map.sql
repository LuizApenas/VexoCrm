-- Mapa persistente LID -> telefone real do WhatsApp.
--
-- Por que existe: no modo de privacidade do WhatsApp a conversa é identificada por
-- um LID ("60640710402218@lid"), que NÃO contém o telefone. A Evolution só revela o
-- número (key.remoteJidAlt) quando a conversa tem alguma mensagem RECEBIDA
-- processada nesse modo; em conversas onde só enviamos, o campo não vem.
--
-- Verificado em produção: o mesmo LID 60640710402218 traz remoteJidAlt no chip
-- "geracao-digital" e não traz no chip "gd-vexo". Como o LID é o mesmo contato em
-- qualquer chip, basta um chip descobrir o número uma vez para todos aproveitarem.
--
-- Este mapa acumula esses vínculos conforme aparecem, e o sync o consulta como
-- fallback antes de desistir e mostrar o LID.

CREATE TABLE IF NOT EXISTS public.whatsapp_lid_map (
  lid TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  contact_name TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whatsapp_lid_map_phone_idx ON public.whatsapp_lid_map (phone);
