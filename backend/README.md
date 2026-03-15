# Backend VexoCrm

Camada Node.js/Express de apoio ao CRM.

Hoje este backend nao e a origem principal da operacao de leads no n8n. O fluxo operacional de captacao e qualificacao usa `Supabase Edge Functions`. O backend existe para:

- servir o frontend do CRM;
- autenticar usuarios via Firebase;
- expor consultas agregadas de dashboard e leads;
- centralizar notificacoes operacionais.

## Stack

- Node.js 20+
- Express
- Supabase JS
- Firebase Admin
- Docker

## Endpoints em uso

| Metodo | Rota | Uso atual |
| --- | --- | --- |
| `GET` | `/health` | health check |
| `GET` | `/api/lead-clients` | filtros do CRM |
| `GET` | `/api/dashboard` | dashboard do CRM |
| `GET` | `/api/leads` | listagem de leads |
| `GET` | `/api/notifications` | feed de notificacoes |
| `PATCH` | `/api/notifications` | marcar notificacoes como lidas |

## Endpoints de compatibilidade

As rotas abaixo ainda existem no codigo, mas nao sao a interface principal do workflow atual porque o n8n esta usando Edge Functions do Supabase:

- `POST /api/leads-webhook`
- `POST /api/n8n-error-webhook`
- `POST /api/conversation-memory`

## Variaveis de ambiente

| Variavel | Uso |
| --- | --- |
| `PORT` | porta do servidor; padrao `3001` |
| `CORS_ORIGINS` | origens permitidas |
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | service role do Supabase |
| `FIREBASE_PROJECT_ID` | projeto Firebase |
| `FIREBASE_CLIENT_EMAIL` | service account Firebase |
| `FIREBASE_PRIVATE_KEY` | chave privada Firebase |

Veja [backend/.env.example](./.env.example).

## Dados expostos ao frontend

O backend consulta o schema atual de `leads`, sem colunas antigas como:

- `conta_energia`
- `bot_ativo`
- `historico`

As metricas do dashboard hoje usam:

- `totalLeads`
- `leadsToday`
- `qualifiedLeads`
- `qualificationRate`
- `activeCities`
- distribuicao por temperatura, perfil e status

## Execucao local

```powershell
cd backend
npm install
npm run dev
```

Servidor local: `http://localhost:3001`

## Docker

```bash
docker build -t vexo-api .
docker run --env-file .env -p 3001:3001 vexo-api
```

## Deploy

```bash
cd backend
git pull origin main
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d
docker logs -f vexo-api
```

## Posicionamento deste modulo

Se a pergunta for "onde a automacao de leads roda hoje?", a resposta correta e:

- `n8n + Supabase Edge Functions`

Se a pergunta for "onde o CRM web consulta dados?", a resposta correta e:

- `backend/`
