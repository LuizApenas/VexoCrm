# INFRA — Mapa de produção e runbook de migração

> Leia isto ANTES de migrar banco, backend, ou trocar Firebase. Foi escrito depois de um
> incidente (29/07/2026) em que o frontend apontava para um backend antigo cujo banco
> tinha sido desligado — o sistema inteiro caiu e levou horas para achar a causa.

## Topologia atual

| Peça | Onde | Detalhe |
|---|---|---|
| **Frontend** | Vercel, projeto `vexo-crm` | Domínio `crm.vexoia.com`. Repo `conradofl/VexoCrm`. |
| **Backend (API)** | Easypanel `72.61.37.181`, projeto `vexo`, serviço `bk-vexo` | Domínio `https://vexo-backend.xdvm8y.easypanel.host` → **porta interna 3001**. |
| **Banco** | Easypanel `72.61.37.181`, projeto `vexo`, serviço `db-vexo` | Host interno `vexo_db-vexo:5432`, database `vexo`. |

**Como o frontend fala com o backend:** `frontend/vercel.json` faz rewrite de `/api/*` para o
domínio do backend. É **UMA linha** (`destination`). Trocar de backend = trocar essa linha e
dar push (a Vercel redeploya sozinha).

## Runbook: trocar de backend/servidor
1. Suba o backend novo. Confirme o domínio público dele e a **porta** (o app escuta **3001** —
   o domínio no Easypanel tem que apontar pra 3001, não 80).
2. Teste direto: abra `https://<dominio-novo>/health` → tem que vir `postgresPing:true`.
3. Edite `destination` nos dois `vercel.json` (raiz e `frontend/`) para o domínio novo.
4. `git commit` + `git push origin main`. Espere a Vercel redeployar (~2 min).
5. **Teste pela ponta:** `crm.vexoia.com/api/health` (NÃO só o backend direto). Isso valida a
   corrente toda (front → rewrite → backend → banco).
6. Só depois de tudo ok, **pare** (não delete) o backend antigo.

## Runbook: trocar de banco
1. `DATABASE_URL` do `bk-vexo` fica em Easypanel → serviço bk-vexo → **Ambiente**.
2. O host tem que resolver **na rede do serviço** (ex.: `vexo_db-vexo` só resolve dentro do
   projeto `vexo`). Host errado dá `getaddrinfo ENOTFOUND <host>` e derruba tudo.
3. Depois de mudar env no Easypanel, faça **Deploy** (recria o container). "Restart" pode não
   recarregar o env novo.
4. **SEMPRE tire um dump do banco antigo antes de desligá-lo:**
   `pg_dump "postgresql://user:senha@host:5432/db" -Fc -f backup.dump`
   Guarde ~2 semanas antes de deletar de vez.

## Regra de ouro
Nunca desligue/apague o recurso antigo antes de validar o novo **pela ponta** (`crm.vexoia.com`).
Sempre com backup do banco antigo em mãos.

## Servidor antigo (a desativar)
Easypanel `187.77.52.167`: projeto `bks/bk-vexo` (backend antigo) e `apps/db-vexo`
(database `vexo-data`, user `dbvexo`). Não confundir com `bks/bk-gestao` (produto separado
LF Soluções, usa Supabase — nada a ver com o VexoCrm).

## Segredos
Rotacionar periodicamente e nunca commitar/printar: senha do Postgres, GROQ_API_KEY,
tokens Slack/Evolution/Resend, FIREBASE_PRIVATE_KEY. Ficam em Easypanel → bk-vexo → Ambiente.
