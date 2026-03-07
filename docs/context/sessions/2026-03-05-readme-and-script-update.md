# Sessão: Atualização de READMEs e Script de Dev

**Data**: 2026-03-05

## Resumo
Atualizados todos os READMEs e o script de inicialização de desenvolvimento (`start.ps1`).

## Alterações

### start.ps1
- Parâmetros adicionados: `-All`, `-Backend`, `-Frontend`
- Padrão: apenas frontend (comportamento inalterado)
- `-All`: inicia backend em background (job PowerShell) + frontend
- `-Backend`: apenas backend
- `-Frontend`: apenas frontend (explícito)
- Garante `node_modules` para ambos antes de iniciar
- Avisa se `.env` estiver ausente no backend ou frontend

### READMEs
- **Vexo/README.md** (novo): README raiz com estrutura, quick start e links de docs
- **VexoCrm/README.md**: estrutura, tabela de env, uso do script, links relacionados
- **VexoCrm/backend/README.md**: corrigido `cd VexoApi` → `cd VexoCrm/backend`
- **VexoCrm/frontend/README.md**: corrigido "VexoApi" → "backend", adicionado uso do script

### docs/context
- **topics/README.md**: adicionada tabela dos tópicos atuais (deploy, n8n, cutover)
- **current.md**: adicionada seção Dev Script com uso

## Resultado
Ponto único de entrada para dev: `.\start.ps1` ou `.\start.ps1 -All`. Todos os docs alinhados com a nova estrutura.
