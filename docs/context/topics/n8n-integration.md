# Integração n8n

## Visão Geral

Os workflows do n8n enviam dados para o backend via endpoints de webhook. Após a migração das Supabase Edge Functions para a VPS, todas as URLs de webhook devem ser atualizadas.

## Endpoints de Webhook

### Webhook de Leads

Recebe dados de leads do n8n e faz upsert na tabela `leads`.

| Propriedade | Valor |
|-------------|-------|
| **URL antiga** | `https://<project>.supabase.co/functions/v1/leads-webhook` |
| **URL nova** | `https://api.seudominio.com/api/leads-webhook` |
| **Método** | POST |
| **Header de Auth** | `Authorization: Bearer <LEADS_WEBHOOK_SECRET>` |

#### Corpo da Requisição (lead único)

```json
{
  "client_id": "infinie",
  "lead": {
    "Telefone": "5534999999999",
    "Nome": "Cliente Exemplo",
    "Tipo de Cliente": "residencial",
    "Faixa de Consumo": "R$ 300",
    "Cidade": "Uberlândia",
    "Estado": "MG",
    "status": "em_qualificacao",
    "Bot Ativo": true,
    "Historico": "Primeiro contato via WhatsApp",
    "Data e Hora": "2026-03-04T12:00:00-03:00"
  }
}
```

#### Corpo da Requisição (lote)

```json
{
  "client_id": "infinie",
  "leads": [
    { "Telefone": "5534999999999", "Nome": "Lead 1", ... },
    { "Telefone": "5534888888888", "Nome": "Lead 2", ... }
  ]
}
```

#### Resposta de Sucesso

```json
{
  "success": true,
  "count": 1,
  "ids": ["uuid-1"]
}
```

### Webhook de Erros

Recebe erros de execução dos workflows n8n e cria logs de erro + notificações.

| Propriedade | Valor |
|-------------|-------|
| **URL antiga** | `https://<project>.supabase.co/functions/v1/n8n-error-webhook` |
| **URL nova** | `https://api.seudominio.com/api/n8n-error-webhook` |
| **Método** | POST |
| **Header de Auth** | `Authorization: Bearer <N8N_WEBHOOK_SECRET>` |

#### Corpo da Requisição

```json
{
  "workflow": {
    "name": "Lead Qualification"
  },
  "execution": {
    "id": "12345",
    "url": "https://n8n.seudominio.com/execution/12345"
  },
  "error": {
    "message": "Connection timeout to external API",
    "lastNodeExecuted": "HTTP Request"
  }
}
```

#### Resposta de Sucesso

```json
{
  "success": true
}
```

## Etapas da Migração

1. Abrir cada workflow do n8n que usa as URLs antigas de webhook do Supabase
2. No nó HTTP Request, atualizar a URL para o novo endpoint da VPS
3. Atualizar o valor do header Authorization com o novo segredo do `backend/.env`
4. Testar cada workflow disparando uma execução manual
5. Verificar se os dados aparecem no CRM (página de leads / sino de notificações)

## Verificação

Após a migração, testar com curl:

```bash
# Testar webhook de leads
curl -X POST https://api.seudominio.com/api/leads-webhook \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_LEADS_SECRET" \
  -d '{"client_id":"infinie","lead":{"Telefone":"5534999990000","Nome":"Test Lead","status":"teste"}}'

# Testar webhook de erros
curl -X POST https://api.seudominio.com/api/n8n-error-webhook \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_N8N_SECRET" \
  -d '{"workflow":{"name":"Test"},"execution":{"id":"test-001","url":"http://localhost"},"error":{"message":"Test error","lastNodeExecuted":"TestNode"}}'
```

Ambos devem retornar `{"success": true}`.
