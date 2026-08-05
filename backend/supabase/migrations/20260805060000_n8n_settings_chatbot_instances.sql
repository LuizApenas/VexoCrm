-- Chips que o chatbot do tenant (aba Configurações) atende.
--
-- Até aqui o vínculo era implícito: o agente inbound atendia os números
-- marcados e o chatbot do tenant ficava com "todo o resto". Na prática ninguém
-- via qual chip usava qual prompt, e bastava um fallback errado no código para
-- o agente errado responder.
--
-- Lista vazia mantém o comportamento antigo (o chatbot atende qualquer chip que
-- não esteja em nenhum agente inbound), então nada muda para quem já usa.
-- Com a lista preenchida, o chatbot só responde nos chips escolhidos.

ALTER TABLE public.lead_client_n8n_settings
  ADD COLUMN IF NOT EXISTS chatbot_instances JSONB NOT NULL DEFAULT '[]'::jsonb;
