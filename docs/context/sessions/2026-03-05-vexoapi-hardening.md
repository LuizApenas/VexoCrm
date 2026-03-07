# 2026-03-05 — Hardening do Backend

## Resumo
Validado o startup do backend e endurecido CORS / tratamento de erros.

## Alterações
- **CORS**: Em produção, o wildcard `*` agora é removido da lista de origens (não apenas ignorado). Apenas origens explícitas são aceitas.
- **Respostas de erro**: Confirmado que todas as respostas de erro já usam `sendError(res, status, code, message, details?)` com códigos de erro únicos.
- **Handler global de erros**: Já presente — captura erros de origem CORS (403 CORS_FORBIDDEN_ORIGIN) e erros não tratados (500 INTERNAL_ERROR).
- **.env.example**: Removidas seções duplicadas; template único e autoritativo agora.

## Validação
- Servidor inicia com sucesso na porta 3001 (smoke test passou).
- Sem erros de linter em server.js.

## Decisões
- Origens CORS com wildcard são removidas (não apenas ignoradas) em produção para clareza.

## Próximos Passos
- Configurar credenciais reais no .env para deploy.
