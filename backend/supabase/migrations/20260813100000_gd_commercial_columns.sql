-- Colunas do modulo comercial GD que os commits 94fb4f0, c00e7f4 e ebb4308
-- afirmaram criar por "auto-migracao" em domains/geracaoDigitalRoutes.js, e que
-- NAO existem no banco de producao (consulta em information_schema.columns
-- devolveu 0 linhas para as oito).
--
-- Por que a auto-migracao nao pegou: cada ALTER estava com `.catch(() => {})`.
-- O erro morria ali, o try/catch externo nunca via nada, e nenhum log saia — o
-- boot parecia limpo com as colunas faltando. Terceiro caso identico no projeto,
-- depois de ensureLeadIntelligenceColumns e do proprio ensureGdTablesAndSeeds.
--
-- Aditiva: ADD COLUMN IF NOT EXISTS em tabela existente. Rodar de novo nao faz nada.

ALTER TABLE public.gd_proposals
  ADD COLUMN IF NOT EXISTS owner_company TEXT NOT NULL DEFAULT 'geracao-digital',
  ADD COLUMN IF NOT EXISTS condicoes_especiais TEXT,
  ADD COLUMN IF NOT EXISTS desconto_setup_pct NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS desconto_mensal_pct NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vexi_plan VARCHAR(50),
  ADD COLUMN IF NOT EXISTS vexi_price NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vexo_plan VARCHAR(50),
  ADD COLUMN IF NOT EXISTS vexo_price NUMERIC DEFAULT 0;

ALTER TABLE public.gd_contracts
  ADD COLUMN IF NOT EXISTS owner_company TEXT NOT NULL DEFAULT 'geracao-digital';

ALTER TABLE public.gd_implementation_briefings
  ADD COLUMN IF NOT EXISTS owner_company TEXT NOT NULL DEFAULT 'geracao-digital';

-- owner_company separa Geracao Digital de Vexo nas listagens; sem indice, cada
-- filtro por empresa vira seq scan nas tres tabelas.
CREATE INDEX IF NOT EXISTS idx_gd_proposals_owner_company
  ON public.gd_proposals (owner_company);
CREATE INDEX IF NOT EXISTS idx_gd_contracts_owner_company
  ON public.gd_contracts (owner_company);
CREATE INDEX IF NOT EXISTS idx_gd_impl_briefings_owner_company
  ON public.gd_implementation_briefings (owner_company);
