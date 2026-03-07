# Sessão: Implementação da Separação Backend/Frontend

**Data**: 2026-03-05

## Resumo
Implementado o plano completo de separação: backend (VPS/Docker) e VexoCrm (Vercel) como serviços independentes.

## Alterações

### Backend
- Hardening de CORS: wildcard removido em produção, apenas origens explícitas
- Respostas de erro padronizadas com `sendError(res, status, code, message, details)`
- Verificação de auth antes de `ensureSupabase` nos endpoints de webhook (401 antes de 500)
- Dockerfile melhorado: usuário não-root, instrução HEALTHCHECK
- `.dockerignore` criado
- `.env.example` criado com as 9 variáveis obrigatórias
- `docker-compose.prod.yml` com Caddy como reverse proxy
- `Caddyfile` com headers de segurança e HTTPS automático
- Scripts auxiliares `deploy.sh` e `rollback.sh`

### Frontend (VexoCrm)
- Cliente Supabase removido (`src/integrations/supabase/client.ts` + `types.ts`)
- Diretório vazio `src/integrations/` removido
- `vercel.json` criado (rewrites SPA + headers de segurança)
- Template `.env.production` criado
- Build: PASSOU (3369 módulos)
- Testes: PASSOU (1/1)
- Lint: 3 erros pré-existentes, 8 warnings (baseline)

### Documentação
- ADR-0001: decisão Backend VPS / Frontend Vercel
- `docs/context/topics/deploy.md`: topologia completa de deploy e variáveis de ambiente
- `docs/context/topics/n8n-integration.md`: guia de migração de webhooks
- `docs/context/topics/cutover-checklist.md`: etapas pré/pós cutover

### Resultados dos Smoke Tests
- `GET /health` -> `ok: true` (supabase: false, firebaseAuth: false sem env)
- `GET /api/notifications` -> 500 `FIREBASE_NOT_CONFIGURED` (esperado sem env)
- `POST /api/leads-webhook` (sem auth) -> 401 `UNAUTHORIZED`
- `POST /api/n8n-error-webhook` (sem auth) -> 401 `UNAUTHORIZED`
- `GET /api/sheets` (sem params) -> 400 `INVALID_QUERY`

## Resultado
Todos os 12 TODOs (P0, A1-A4, B1-B3, C1-C2, D1-D2) concluídos.
Pronto para deploy na VPS e cutover na Vercel seguindo o checklist.
