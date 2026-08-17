-- Limite de chips de WhatsApp como DADO, nao como constante de codigo.
--
-- O dono foi explicito: "o numero que eu falo normalmente e um exemplo, quanto
-- mais personalizavel melhor". Entao o 2 do plano Essencial nao esta chumbado.
-- Sao tres niveis, do mais especifico para o mais geral:
--   1. lead_client_n8n_settings.chip_limit  -> override deste tenant (esta coluna)
--   2. system_settings.chip_limits          -> limite por plano, editavel
--   3. CHIP_LIMIT_DEFAULTS no codigo        -> so fallback
--
-- NULL na coluna significa "usa a regra do plano", NAO ilimitado. Ilimitado se
-- escreve como -1? Nao: se escreve nao mexendo aqui e usando o modulo
-- multiplos_chips, ou colocando o tenant em plano Avancado. A coluna e para o
-- caso combinado a parte ("este cliente pagou 5 chips").
--
-- Sentinela em migrate.js: esta migration CRIA a coluna chip_limit, entao a
-- sentinela checa exatamente ela. Sentinela que olha outra coisa faz o baseline
-- de migrate.js:143-149 marcar como aplicada SEM executar — foi o que aconteceu
-- com a 20260730000000.

ALTER TABLE public.lead_client_n8n_settings
  ADD COLUMN IF NOT EXISTS chip_limit INTEGER;

COMMENT ON COLUMN public.lead_client_n8n_settings.chip_limit IS
  'Override do limite de chips deste tenant. NULL = usa a regra do plano (ver system_settings.chip_limits).';

-- system_settings nunca foi criada por migration: o codigo que a usa
-- (domains/superadmin/routes.js) engole o erro e cai num objeto em memoria, entao
-- ela pode simplesmente nao existir em producao. Criar aqui e aditivo e conserta
-- tambem o upsell_whatsapp, que hoje pode estar so na memoria do processo.
CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- O seed vai num bloco com EXCEPTION porque, se a tabela JA existir com outro
-- formato, um INSERT solto abortaria a transacao inteira e levaria o ALTER acima
-- junto. Config ausente nao e problema: o backend cai em CHIP_LIMIT_DEFAULTS.
DO $$
BEGIN
  INSERT INTO public.system_settings (key, value)
  VALUES (
    'chip_limits',
    '{"essencial": 2, "modular_com_ferramenta": 2, "modular_sem_ferramenta": 0}'
  )
  ON CONFLICT (key) DO NOTHING;
EXCEPTION WHEN others THEN
  RAISE NOTICE '[chip-limit] seed de system_settings.chip_limits ignorado: %', SQLERRM;
END $$;
