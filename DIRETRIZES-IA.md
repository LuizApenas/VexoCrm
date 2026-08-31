# DIRETRIZES-IA.md — Regras obrigatórias para qualquer IA que edita este repositório

> Este arquivo existe porque erros reais quebraram a produção. Leia inteiro antes de
> tocar em código, banco, deploy ou segredo. As regras não são sugestões: cada uma
> nasceu de um incidente que derrubou o sistema ou vazou credencial.
>
> Companheiro obrigatório: **[INFRA.md](INFRA.md)** (topologia de produção e runbooks).

---

## 0. As 5 leis (se ler só isto, leia isto)

1. **NUNCA** escreva senha, token ou connection string com credencial no código. Sempre `process.env`.
2. **SEMPRE** rode `node --check <arquivo>` em cada arquivo backend alterado, e `tsc` no frontend, **antes** de commitar. Boot que não compila = produção fora.
3. **SEMPRE** valide pela ponta (`crm.vexoia.com`), não só pelo backend direto, antes de dizer que está pronto.
4. **NUNCA** afirme que algo foi corrigido sem ter rodado o comando que prova. "Deve funcionar" não é verificação.
5. **NÃO** adicione código, tabela, seed ou comentário que não seja estritamente necessário para a tarefa. Menos linhas, menos superfície de erro.

---

## 1. Verificar QUAL banco e QUAL backend estão vivos (antes de qualquer diagnóstico)

**Incidente:** horas perdidas depurando o backend errado. O frontend apontava para um
backend antigo (`bks-bk-vexo`, servidor 187.77.52.167) cujo banco tinha sido desligado.
O backend novo e saudável (`vexo/bk-vexo`, 72.61.37.181) estava certo o tempo todo.

**Regra:** antes de investigar qualquer erro 500, confirme o caminho real da requisição:

- **Qual backend o frontend chama?** Veja `frontend/vercel.json` → `rewrites` → `destination`.
  E a env `VITE_API_BASE_URL` na Vercel (hooks que usam `${API_BASE_URL}/api/...` vão por ela,
  não pelo rewrite). Os dois têm que apontar para o **mesmo** backend novo.
- **O backend está vivo e no banco certo?** Abra `https://<backend>/health`. Confira
  `postgresPing: true` e `databaseTarget` (host/porta/database). Se o host não for o banco
  novo, o problema é config, não código.
- **Teste pela ponta:** `crm.vexoia.com/api/health`, não só o backend direto. Isso valida
  front → rewrite → backend → banco.

Se os logs do backend que você olha **não mudam** quando você reproduz o erro, você está
olhando o backend/instância errado. Pare e ache o certo antes de continuar.

**Estado atual correto** (confirme sempre em INFRA.md, pode mudar):
- Backend prod: `https://vexo-backend.xdvm8y.easypanel.host` (porta interna 3001).
- Banco: `vexo_db-vexo:5432/vexo` (host interno, servidor 72.61.37.181).
- Servidor velho `187.77.52.167` (projetos `bks`, `apps`) está sendo desativado. Não use.

---

## 2. Segredos: nunca no código, nunca no git

**Incidente:** a senha do Postgres foi hardcoded em **3 arquivos** e commitada no GitHub
(`geracaoDigitalRoutes.js`, `superadmin/routes.js` e `SuperAdmin.tsx` — este último ia
inteiro pro bundle do navegador, visível a qualquer usuário). Resultado: senha exposta no
histórico do repo, obrigando rotação de credencial.

**Regras:**
- Credencial (senha, token, API key, connection string com senha) **só** via `process.env`.
  Se precisar de um banco de origem para migração, use `process.env.LEGACY_DB_URL` ou receba
  a URL no corpo da requisição em runtime — **nunca** embutida.
- **JAMAIS** ponha segredo em arquivo do `frontend/`. Tudo em `frontend/src` vai para o
  bundle público. Segredo no frontend = segredo vazado.
- Antes de commitar, rode: `grep -rn "postgres:\|apikey\|secret\|token=" backend/src frontend/src | grep -v process.env`
  e confirme que não há credencial literal.
- Arquivos de exploração/scratch (`scratch_*.js`, dumps) **não** entram no git e **não**
  contêm senha. Apague ao terminar.

---

## 3. Não polua o código nem crie coisa desnecessária

**Incidentes:**
- Um bloco de "auto-migração transparente em background" (`setImmediate`) rodava a cada boot,
  embutia senha e copiava tabelas do banco legado — **redundante** (a migração já era pontual
  e manual) e **perigoso**. Removido.
- Tabelas "core" foram criadas automaticamente com **schema errado/mínimo** (ex.: `leads` sem
  as colunas que o chatbot exige), gerando `column ... does not exist`.
- Seeds de propostas/briefings **fabricados** foram inseridos, poluindo dados reais.

**Regras:**
- Migração de dados é **operação pontual**, não código que roda a cada boot. Não deixe rotinas
  de cópia de banco no caminho de inicialização.
- Não crie tabela por conta própria "chutando" o schema. Se uma tabela falta, confirme o
  schema **real** (do banco de origem ou do código que a consome) antes de criar/alterar.
  Preferir `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` sobre recriar.
- **Nunca** insira dados fabricados (seeds falsos de clientes/propostas). Dado inventado é pior
  que dado ausente.
- Cada linha adicionada é superfície de bug. Se não é necessária para a tarefa, não adicione.

---

## 4. Corrija a causa, não o sintoma. E não esconda erro.

**Incidente:** um endpoint que dava 500 foi "estabilizado" com `.catch(() => [])`, devolvendo
lista vazia e escondendo o erro real (o backend estava em crash loop por um `SyntaxError`, e
outras rotas quebravam por schema). O sintoma sumiu do console, a causa continuou.

**Regras:**
- Antes de propor correção, ache a causa raiz. Um 500 em "todas as rotas" quase sempre é uma
  causa única (app não bootou, banco errado, middleware comum), não N bugs.
- Não envolva erro em `try/catch` que engole (`catch (e) {}` ou `.catch(() => [])`) só para o
  console ficar limpo. Logue o erro real e trate de verdade. Fallback silencioso mascara falha.
- Se o app não boota, o problema é boot (sintaxe, import, env), não a rota que aparece no log.

---

## 5. Verificação antes de afirmar (evidência, não achismo)

**Incidente:** correções foram declaradas prontas sem terem sido validadas; informações
"corrigidas" eram na verdade falsas/desatualizadas, custando confiança e tempo.

**Regras — nada é "feito" sem isto:**
- Backend alterado: `node --check` em cada arquivo. Sem exceção.
- Frontend alterado: `npx tsc -p tsconfig.app.json --noEmit` (a raiz tem `files: []`; use o
  `tsconfig.app.json`). Confirme que você não **adicionou** erro novo (compare com o baseline).
- Rota alterada: prove com uma chamada real (curl/fetch/DevTools) que retorna o esperado.
- Migração/coluna: consulte o banco e confirme que a coluna/linha existe (`information_schema`
  ou `SELECT ... LIMIT 0`).
- **DDL que "deu OK" não prova que o objeto existe.** `CREATE TABLE/INDEX ... IF NOT EXISTS` e
  `ALTER ... ADD COLUMN IF NOT EXISTS` retornam sucesso mesmo quando não criam nada (e o objeto
  pode ter sido apagado depois, por um DELETE/DROP em cascata). Sempre confirme o estado real
  com uma consulta de catálogo, e prove o comportamento:
  - índice: `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = '<tabela>';`
  - coluna: `SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = '<tabela>';`
  - se o código usa `ON CONFLICT (a, b)`, rode um INSERT de teste (e apague depois). Sem um índice
    único em `(a, b)` o Postgres responde *"there is no unique or exclusion constraint matching the
    ON CONFLICT specification"* e **todo** upsert falha em silêncio se o erro for engolido.
  Incidente real: nomes de contato não gravavam e a extração retornava 0 porque o índice único
  `(client_id, telefone)` não existia, apesar de o `CREATE ... IF NOT EXISTS` ter reportado OK.
- Ao relatar: diga o comando que rodou e o resultado. Se não rodou, diga "não verificado".
  Não escreva "corrigido" para algo que você só editou.

---

## 6. Commit e deploy

- Commite **apenas** os arquivos que você mudou de propósito. Nunca `git add -A` cego (arrasta
  scratch, dumps, `ops/`). Faça `git add <arquivos específicos>`.
- Repo correto: `~/Documents/vexo-sales-module`, remote `github.com/conradofl/VexoCrm`, branch
  `main`. Confirme com `git remote -v` e `git rev-parse --abbrev-ref HEAD` antes de push.
- **Push atualiza o GitHub; não faz deploy do backend sozinho.** O frontend (Vercel) redeploya
  no push. O backend precisa de **Implantar** no Easypanel (`vexo/bk-vexo`). Diga isso ao usuário.
- Nunca desligue/apague recurso antigo (banco, backend) antes de validar o novo pela ponta e
  ter backup. Ver INFRA.md.

---

## 8. CHECK constraints: verificar SEMPRE antes de gravar valor novo

**Incidente:** Múltiplas violações consecutivas de `CHECK constraint` derrubaram operações em produção e o boot-recovery de lotes órfãos (ex: `trigger_type = 'auto_resume'`, `origin_type = 'manual'`, `followup_jobs_content`, `access preset`, `lead_source`).

**Regra obrigatória:**
- Toda vez que o backend for gravar, atualizar ou fazer fallback de um valor em uma coluna com `CHECK constraint`, é **obrigatório consultar a definição da constraint** no banco ou nos arquivos de migration antes de alterar o código.
- Se o novo valor for legítimo (ex: novo trigger_type ou status), a migration que atualiza a constraint (`DROP CONSTRAINT IF EXISTS ... ADD CONSTRAINT ... CHECK (...)`) deve ser incluída e registrada em `migrate.js` **no mesmíssimo commit** da alteração do código.
- Nunca assuma que uma coluna aceita qualquer string sem validar se existe `CHECK constraint` associada.

---

## 9. Checklist final (cole mentalmente antes de dizer "pronto")

- [ ] Confirmei qual backend/banco a produção usa (health + vercel.json + VITE_API_BASE_URL).
- [ ] `node --check` passou em todos os `.js` backend alterados.
- [ ] `tsc` no frontend sem erro novo.
- [ ] Zero credencial literal no diff (`grep` por senha/token).
- [ ] Não adicionei tabela/seed/rotina de migração desnecessária.
- [ ] Não escondi erro com catch vazio.
- [ ] Se mexi em schema: confirmei coluna/índice no catálogo (não confiei no "OK" do `IF NOT EXISTS`).
- [ ] Se gravei valor em coluna com CHECK: confirmei a constraint e inclui migration no mesmo commit.
- [ ] Testei a rota/tela afetada de verdade e tenho o resultado.
- [ ] `git add` só dos arquivos certos; branch e remote conferidos.
- [ ] Avisei o usuário se precisa **Deploy** no Easypanel (backend não sobe no push).
