# Supabase Edge Functions ativas

Este documento registra somente as Edge Functions que fazem parte da operacao atual.

## Funcoes em uso

| Function | Metodo | Consumida por | Papel |
| --- | --- | --- | --- |
| `conversation-memory` | `GET`, `POST` | n8n | salvar e consultar memoria de conversa |
| `conversation-memory-latest` | `GET` | n8n | recuperar a memoria mais recente por telefone |
| `lead-webhook` | `POST` | n8n | criar e finalizar leads |
| `n8n-error-webhook` | `POST` | n8n error workflow | registrar erros e gerar notificacoes |
| `notifications-api` | `GET`, `PATCH` | CRM | consultar e marcar notificacoes |

## Funcoes removidas do escopo atual

As funcoes abaixo nao fazem mais parte da arquitetura documentada:

- `sheets-proxy`
- `lead-exists-by-phone`

Tambem foi normalizado o nome da function de leads:

- `leads-webhook` -> `lead-webhook`

## Padrao de URLs

Use o padrao:

```text
https://<projeto>.supabase.co/functions/v1/<nome-da-function>
```

## 1. `conversation-memory`

Arquivo fonte:

- [frontend/supabase/functions/conversation-memory/index.ts](../frontend/supabase/functions/conversation-memory/index.ts)

### Metodos

- `GET`
- `POST`

### Autenticacao

- Bearer token interno do workflow

### `GET`

Query:

- `telefone`

Retorno:

- ultima conversa encontrada para o telefone

### `POST`

Body esperado:

```json
{
  "telefone": "5534999999999",
  "conversation_compressed": "<payload compactado>",
  "tamanho_original": 1234,
  "timestamp": "2026-03-14T10:00:00.000Z"
}
```

Tabela impactada:

- `lead_conversations`

## 2. `conversation-memory-latest`

Arquivo fonte:

- [frontend/supabase/functions/conversation-memory-latest/index.ts](../frontend/supabase/functions/conversation-memory-latest/index.ts)

### Metodo

- `GET`

### Query

- `telefone`

### Papel no workflow

E a consulta usada logo apos a normalizacao do telefone para decidir se o n8n deve:

- continuar uma conversa existente;
- ou iniciar um contexto novo.

## 3. `lead-webhook`

Arquivo fonte:

- [frontend/supabase/functions/lead-webhook/index.ts](../frontend/supabase/functions/lead-webhook/index.ts)

### Metodo

- `POST`

### Autenticacao

- Bearer token interno do workflow

### Acoes suportadas

#### `create`

Usada no inicio da conversa para garantir que o lead exista.

Body tipico:

```json
{
  "action": "create",
  "client_id": "infinie",
  "telefone": "5534999999999",
  "nome": "Nome do contato"
}
```

#### `finalize`

Usada no fim da qualificacao para consolidar o lead no schema atual.

Body tipico:

```json
{
  "action": "finalize",
  "client_id": "infinie",
  "telefone": "5534999999999",
  "nome": "Nome do contato",
  "tipo_cliente": "rural",
  "faixa_consumo": "600",
  "cidade": "Uberlandia",
  "estado": "MG",
  "status": "qualificado",
  "qualificacao": "Resumo completo do lead"
}
```

Tabela impactada:

- `leads`

Observacao:

- a function trabalha com o schema novo e nao usa `conta_energia`, `bot_ativo` ou `historico`.

## 4. `n8n-error-webhook`

Arquivo fonte:

- [frontend/supabase/functions/n8n-error-webhook/index.ts](../frontend/supabase/functions/n8n-error-webhook/index.ts)

### Metodo

- `POST`

### Papel

- salva erro tecnico em `n8n_error_logs`;
- cria notificacao em `notifications`.

### Payload esperado

Estrutura disparada pelo error workflow do n8n, incluindo:

- `workflow.name`
- `execution.id`
- `execution.url`
- `error.message`
- `error.lastNodeExecuted`

## 5. `notifications-api`

Arquivo fonte:

- [frontend/supabase/functions/notifications-api/index.ts](../frontend/supabase/functions/notifications-api/index.ts)

### Metodos

- `GET`
- `PATCH`

### Autenticacao

- JWT do usuario autenticado no Supabase

### Papel

- listar notificacoes;
- contar nao lidas;
- marcar uma ou todas como lidas.

## Segredos e autenticacao

### Functions de workflow

`conversation-memory`, `conversation-memory-latest`, `lead-webhook` e `n8n-error-webhook` esperam um bearer interno da operacao.

### Function de CRM

`notifications-api` valida o JWT do usuario.

## Resumo operacional

Se a pergunta for "quais functions estao ativas hoje?", a resposta correta e exatamente a lista deste documento. Qualquer referencia adicional deve ser tratada como legado ou material fora do escopo atual.
