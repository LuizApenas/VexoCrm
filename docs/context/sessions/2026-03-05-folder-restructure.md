# Sessão: Reestruturação de Pastas (Opção B)

**Data**: 2026-03-05

## Resumo
Reorganizada a estrutura do projeto para que tudo fique dentro do repo VexoCrm: `backend/` + `frontend/`.

## Alterações

### Estrutura
- **Antes**: `VexoApi/` e `VexoCrm/` como irmãos
- **Depois**: `VexoCrm/backend/` (ex-VexoApi) + `VexoCrm/frontend/` (conteúdo ex-VexoCrm)

### Arquivos Atualizados
- `start.ps1` — aponta para `VexoCrm/frontend`
- `backend/deploy.sh`, `rollback.sh` — REPO_ROOT = pai do backend
- `backend/README.md`, `docker-compose.prod.yml`, `Caddyfile` — comentários de caminho
- `frontend/README.md` — estrutura e caminhos
- `docs/context/topics/deploy.md` — nota sobre Root Directory para Vercel
- `docs/context/topics/cutover-checklist.md` — caminhos backend/frontend
- `VexoCrm/README.md` — novo README raiz

### Validação
- Build do frontend: PASSOU
- Backend: `npm install` + `node src/server.js` funcionam (porta 3001 estava em uso durante o teste)

## Resultado
Estrutura de monorepo concluída. O usuário deve remover manualmente a pasta antiga `VexoApi/` se ainda existir.
