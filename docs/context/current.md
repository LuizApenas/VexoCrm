# Contexto Atual do Projeto

## Objetivo
VexoCrm: monorepo com backend (API) e frontend. O backend fornece APIs REST para leads, notificações, proxy de planilhas e webhooks.

## Prioridades Ativas
- P1: Separação backend/frontend concluída — pronto para deploy na VPS e cutover na Vercel

## Em Andamento
- Nenhuma (todos os TODOs de implementação concluídos)

## Bloqueios
- Acesso à VPS necessário para deploy em produção (etapa A4)
- Docker Desktop necessário para validar build da imagem localmente

## Decisões Recentes
- 2026-03-05: Estrutura de pastas — VexoCrm/backend + VexoCrm/frontend (opção B)
- 2026-03-05: ADR-0001 aceito — Backend na VPS (Docker), Frontend na Vercel, cutover direto
- 2026-03-05: Cliente Supabase removido do frontend (client.ts + types.ts)
- 2026-03-05: Verificação de auth antes de ensureSupabase nos webhooks (401 antes de 500)
- 2026-03-05: Hardening de CORS — wildcard removido em produção
- 2026-03-05: Formato de erro padronizado em todos os endpoints (helper sendError)
- 2026-03-05: Healthcheck e usuário não-root adicionados ao Dockerfile
- 2026-03-05: docker-compose.prod.yml com Caddy como reverse proxy criado
- 2026-03-05: Configuração Vercel (vercel.json + .env.production) criada
- 2025-03-04: Template Lovable substituído por branding e docs do VexoCrm

## Script de Desenvolvimento

Na raiz de `Vexo/`: `.\start.ps1` (frontend), `.\start.ps1 -All` (backend + frontend), `.\start.ps1 -Backend` (apenas backend).

## Import de Leads (Excel → Supabase)
- Scripts em `VexoCrm/scripts/`: `excel-to-leads.py`, `import-leads.js`, `setup-leads-tables.sql`
- Ver `scripts/README-import-leads.md` para fluxo completo

## Próximas Ações
- Remover pasta `VexoApi/` manualmente (se ainda existir; fechar processos antes)
- Configurar credenciais reais em `backend/.env` na VPS
- Substituir `api.seudominio.com` pelo domínio real no Caddyfile
- Configurar variáveis de ambiente no dashboard da Vercel (VITE_API_BASE_URL + Firebase)
- Atualizar URLs dos webhooks no n8n para os endpoints da VPS
- Seguir checklist de cutover: [cutover-checklist.md](topics/cutover-checklist.md)
- Considerar code-splitting para reduzir o bundle JS (~1MB)

## Riscos
- Bundle JS de 1019 kB (283 kB gzip); considerar code-splitting
- Cutover sem fallback — mitigado por scripts de rollback (< 10 min)
- Baseline de lint: 3 erros + 8 warnings (pré-existentes, não bloqueantes)
