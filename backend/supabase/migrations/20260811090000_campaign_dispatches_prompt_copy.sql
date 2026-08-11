-- Roteiro do agente por DISPARO, isolado e editavel.
--
-- Ate aqui o disparo apontava para o roteiro da campanha (campaigns.campaign_prompt_id),
-- lido ao vivo no momento em que o lead respondia. Consequencias: editar o roteiro da
-- campanha mudava o atendimento de disparos ja em andamento, e nao havia como corrigir o
-- roteiro de UM disparo sem afetar os outros.
--
-- Congelar seria pior: um roteiro imutavel prende o dono numa campanha defeituosa — se a
-- IA responde errado, a unica saida seria cancelar o disparo, e quem ja recebeu a
-- mensagem uma vez nao abre de novo. Por isso a coluna guarda a COPIA (isolada), que
-- continua editavel.
--
-- Aditiva: disparo antigo fica com NULL e cai no roteiro da campanha, exatamente como
-- hoje. Nenhum comportamento existente muda.
ALTER TABLE public.campaign_dispatches
  ADD COLUMN IF NOT EXISTS campaign_prompt_id UUID;

CREATE INDEX IF NOT EXISTS idx_campaign_dispatches_prompt
  ON public.campaign_dispatches (campaign_prompt_id);
