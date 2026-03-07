# Índice de Contexto

## Propósito
Manter uma memória de engenharia persistente para que sessões futuras recuperem o contexto rapidamente.

## Arquivos Principais
- `current.md`: status atual, prioridades, riscos e próximas ações
- `decisions/`: decisões de arquitetura e técnicas (estilo ADR)
- `sessions/`: log cronológico de sessões de chat e resultados
- `topics/`: contexto focado por domínio (auth, checkout, deploy, etc.)

## Acordo de Trabalho
1. Ler `current.md` no início da sessão
2. Carregar apenas entradas relevantes de `topics/` e `decisions/`
3. Atualizar `current.md` e adicionar nota de sessão ao final
4. Registrar decisões técnicas duradouras em `decisions/`

## Navegação
- Status atual: [current.md](./current.md)
- Decisões: [decisions](./decisions)
  - Decisão: [ADR-0001 Backend VPS / Frontend Vercel](./decisions/ADR-0001-backend-vps-frontend-vercel.md)
- Sessões: [sessions](./sessions)
- Tópicos: [topics](./topics)
  - Tópico: [Deploy](./topics/deploy.md)
  - Tópico: [Integração n8n](./topics/n8n-integration.md)
  - Tópico: [Checklist de Cutover](./topics/cutover-checklist.md)
