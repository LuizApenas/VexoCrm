-- Quem o chatbot do tenant pode atender.
--
-- Incidente real: a mae do dono mandou "Boa tarde filho!" para o numero da
-- empresa e recebeu atendimento de robo ("O que voce procura na Geracao
-- Digital?"). Qualquer pessoa que escrevesse para o numero — contato pessoal,
-- fornecedor, engano — entrava no funil e consumia LLM.
--
-- 'leads_only' (padrao): so responde quem ja e lead conhecido do tenant ou
-- chegou por campanha. Desconhecido fica em silencio, para atendimento humano.
-- 'all': responde qualquer inbound (comportamento antigo). E escolha do
-- cliente, nao padrao.
--
-- Default seguro de proposito: quem nao configurar nada passa a ter o
-- comportamento restrito, que e o que evita constrangimento com o cliente.

ALTER TABLE public.lead_client_n8n_settings
  ADD COLUMN IF NOT EXISTS chatbot_inbound_scope TEXT NOT NULL DEFAULT 'leads_only';
