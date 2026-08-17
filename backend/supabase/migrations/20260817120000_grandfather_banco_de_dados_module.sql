-- Banco de Dados deixou de ser base universal e virou modulo vendavel avulso.
--
-- Tirar da base universal, sozinho, REMOVERIA o acesso de todo tenant existente
-- no instante do deploy — regressao em producao com cliente usando a tela todo
-- dia. Esta migration escreve o direito adquirido no DADO: quem enxerga o Banco
-- hoje passa a constar como tendo o modulo contratado, e continua enxergando.
--
-- Por que dado e nao um default de compatibilidade no resolvedor: o default
-- seria uma excecao permanente e invisivel ("e vendavel, exceto que esta sempre
-- ligado"). Depois de vender o modulo, ninguem conseguiria distinguir quem
-- pagou de quem foi herdado, e a excecao nunca poderia ser removida com
-- seguranca. Gravado no dado, a tela de empresa mostra a verdade: o toggle
-- aparece marcado para os tenants existentes, e o dono pode desmarcar quem nao
-- pagar. O resolvedor fica sem caso especial.
--
-- Vale para todas as linhas, nao so as modulares: modulos_avulsos e inerte em
-- plano essencial e avancado, e se o dono converter um deles para modular
-- amanha, o direito adquirido continua valendo — que e exatamente a promessa.
--
-- SEM SENTINELA em migrate.js DE PROPOSITO. O baseline de migrate.js:143-149
-- marca como aplicada SEM EXECUTAR toda migration cuja sentinela passa; como
-- esta aqui nao cria coluna nenhuma, qualquer sentinela que eu escrevesse
-- estaria checando outra coisa e a migration seria pulada — foi assim que a
-- 20260730000000 nunca rodou. Sem entrada em `checks`, isAlreadyApplied devolve
-- false e ela executa, que e o que se quer.
--
-- Idempotente: o WHERE ignora quem ja tem a chave.

UPDATE public.lead_client_n8n_settings
SET modulos_avulsos = COALESCE(modulos_avulsos, '[]'::jsonb) || '["banco-de-dados"]'::jsonb
WHERE NOT (COALESCE(modulos_avulsos, '[]'::jsonb) @> '["banco-de-dados"]'::jsonb)
  -- "all"/"*" ja liberam o catalogo inteiro; nao suja o dado desses.
  AND NOT (COALESCE(modulos_avulsos, '[]'::jsonb) @> '["all"]'::jsonb)
  AND NOT (COALESCE(modulos_avulsos, '[]'::jsonb) @> '["*"]'::jsonb);
