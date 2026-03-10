# Banco de Dados do VexoCrm

## Visão Geral

O banco principal do `VexoCrm` está no Supabase (PostgreSQL). O domínio de dados mais estruturado no repositório hoje é o de leads, com suporte operacional para notificações e logs de erro do n8n.

Este documento mistura duas fontes:
- schema confirmado nas migrations do projeto
- uso real observado no backend Express

Quando algo estiver confirmado apenas pelo backend, isso será indicado explicitamente.

## Tabelas Principais

| Tabela | Finalidade | Status da documentação |
| --- | --- | --- |
| `leads_clients` | Empresas/origens dos leads | Confirmada por migration |
| `leads` | Leads capturados e enriquecidos | Confirmada por migration |
| `lead_conversations` | Memória comprimida das conversas do agente | Confirmada por migration |
| `notifications` | Notificações operacionais exibidas no CRM | Inferida pelo backend; RLS visível em migration |
| `n8n_error_logs` | Registro de erros de execução dos workflows n8n | Inferida pelo backend; policy visível em migration |

## 1. `leads_clients`

Representa as empresas ou grupos de origem usados para filtrar os leads no CRM.

### Colunas confirmadas

| Coluna | Tipo | Observação |
| --- | --- | --- |
| `id` | `TEXT` | Chave primária |
| `name` | `TEXT` | Nome da empresa/cliente |
| `created_at` | `TIMESTAMPTZ` | Default `now()` |

### Uso operacional
- A tabela alimenta o seletor de empresa no dashboard.
- O backend lista esses registros em `GET /api/lead-clients`.
- Seed inicial confirmado: `id = 'infinie'`, `name = 'Infinie'`.

## 2. `leads`

Tabela principal de negócio do CRM. Armazena os leads associados a uma empresa em `leads_clients`.

### Colunas confirmadas

| Coluna | Tipo | Observação |
| --- | --- | --- |
| `id` | `UUID` | Chave primária, default `gen_random_uuid()` |
| `client_id` | `TEXT` | FK para `leads_clients.id` |
| `telefone` | `TEXT` | Obrigatório |
| `nome` | `TEXT` | Nome do lead |
| `tipo_cliente` | `TEXT` | Ex.: residencial, casa, comercial |
| `faixa_consumo` | `TEXT` | Faixa/valor de consumo |
| `cidade` | `TEXT` | Cidade |
| `estado` | `TEXT` | Estado |
| `conta_energia` | `TEXT` | Informação complementar da conta |
| `status` | `TEXT` | Estado comercial/operacional do lead |
| `bot_ativo` | `BOOLEAN` | Default `false` |
| `historico` | `TEXT` | Texto livre com contexto do lead |
| `data_hora` | `TIMESTAMPTZ` | Data do evento/origem do lead |
| `qualificacao` | `TEXT` | Campo complementar de qualificação |
| `created_at` | `TIMESTAMPTZ` | Default `now()` |
| `updated_at` | `TIMESTAMPTZ` | Default `now()` |

### Regras confirmadas
- Chave única composta: `UNIQUE (client_id, telefone)`
- FK: `client_id REFERENCES leads_clients(id) ON DELETE CASCADE`

### Índices confirmados
- `idx_leads_client_id`
- `idx_leads_status`
- `idx_leads_data_hora`

### Uso operacional
- `GET /api/leads?clientId=<id>` retorna os leads filtrados por empresa.
- `POST /api/leads-webhook` faz upsert por `(client_id, telefone)`.
- `GET /api/dashboard?clientId=<id>` agrega essa tabela para KPIs e gráficos do dashboard.

### Métricas derivadas no dashboard
- total de leads
- leads do dia
- leads em qualificação (`status = em_qualificacao`)
- taxa de qualificação
- leads com `bot_ativo = true`
- temperatura inferida por texto em `historico` / `qualificacao`
- breakdown por status e por tipo de cliente

## 3. `lead_conversations`

Tabela operacional para armazenar memória comprimida das conversas do agente de IA que roda no n8n.

### Colunas confirmadas

| Coluna | Tipo | Observação |
| --- | --- | --- |
| `id` | `UUID` | Chave primária, default `gen_random_uuid()` |
| `telefone` | `TEXT` | Telefone sanitizado para dígitos |
| `conversation_compressed` | `TEXT` | Conteúdo recebido em gzip + base64 |
| `tamanho_original` | `INTEGER` | Tamanho do payload antes da compressão |
| `unknown_lead` | `BOOLEAN` | `true` quando o telefone não existe em `leads` |
| `created_at` | `TIMESTAMPTZ` | Timestamp recebido da conversa |

### Índices confirmados
- `idx_lead_conversations_telefone`
- `idx_lead_conversations_created_at`

### Uso operacional
- Alimentada por `POST /api/conversation-memory`
- Usa `N8N_WEBHOOK_SECRET` como bearer
- O backend valida base64, gzip, tamanho e sanitização do telefone antes de salvar
- A tabela não tem leitura pública

## 4. `notifications`

Tabela usada para exibir notificações operacionais no sino do CRM e na tela do agente.

### Campos observados no backend

| Coluna | Tipo inferido | Observação |
| --- | --- | --- |
| `id` | `UUID/TEXT` | Identificador da notificação |
| `type` | `TEXT` | Ex.: `n8n_error` |
| `title` | `TEXT` | Título exibido ao usuário |
| `description` | `TEXT` | Descrição resumida |
| `link` | `TEXT` | Link opcional para execução/log |
| `read` | `BOOLEAN` | Controle de leitura |
| `created_at` | `TIMESTAMPTZ` | Ordenação de listagem |

### Observações
- O backend lê e atualiza essa tabela em `/api/notifications`.
- O backend também insere notificações após erro em `/api/n8n-error-webhook`.
- Há migration confirmando RLS ativa e bloqueio de acesso direto do cliente.

## 5. `n8n_error_logs`

Tabela operacional usada para persistir erros dos workflows do n8n.

### Campos observados no backend

| Coluna | Tipo inferido | Observação |
| --- | --- | --- |
| `execution_id` | `TEXT` | Chave de unicidade lógica do erro |
| `workflow_name` | `TEXT` | Nome do workflow |
| `message` | `TEXT` | Mensagem de erro |
| `node` | `TEXT` | Último nó executado |
| `execution_url` | `TEXT` | Link para a execução no n8n |

### Observações
- O backend faz `upsert` nessa tabela em `/api/n8n-error-webhook`.
- Há policy confirmada em migration bloqueando acesso direto do cliente.

## Relacionamentos

- `leads.client_id` -> `leads_clients.id`
- `notifications` é consumida por usuários autenticados via Firebase no backend
- `n8n_error_logs` alimenta `notifications` quando ocorre erro operacional

## Segurança / Acesso

### Confirmado por migration
- `leads` e `leads_clients` têm RLS habilitada
- leitura liberada para `anon` e `authenticated`
- escrita fica reservada ao fluxo de backend/service role

### Confirmado por backend
- o frontend não acessa Supabase diretamente para o dashboard
- o backend usa `SUPABASE_SERVICE_ROLE_KEY` para consultar e gravar dados
- notificações exigem autenticação Firebase no backend

## Observações de nomenclatura

- O nome real da tabela é `leads_clients`
- Em conversas informais pode aparecer `lead_clients`, mas no banco e no backend o identificador usado é `leads_clients`
