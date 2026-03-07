# Topologia de Deploy

## Arquitetura

```
Vercel (VexoCrm)  --->  VPS (Backend)  --->  Supabase (PostgreSQL)
       |                      |
   Firebase Auth         Firebase Admin
```

## Frontend (Vercel)

### Variáveis de Ambiente Obrigatórias

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `VITE_API_BASE_URL` | Sim | URL base do backend (ex: `https://api.seudominio.com`) |
| `VITE_FIREBASE_API_KEY` | Sim | Chave de API do Firebase |
| `VITE_FIREBASE_AUTH_DOMAIN` | Sim | Domínio de auth do Firebase |
| `VITE_FIREBASE_PROJECT_ID` | Sim | ID do projeto Firebase |
| `VITE_FIREBASE_STORAGE_BUCKET` | Sim | Bucket de storage do Firebase |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Sim | Sender ID de mensagens do Firebase |
| `VITE_FIREBASE_APP_ID` | Sim | ID do app Firebase |
| `VITE_FIREBASE_MEASUREMENT_ID` | Não | Analytics do Firebase |

### Deploy
A Vercel faz deploy automático a partir do Git. **Definir Root Directory como `frontend`** (ou `VexoCrm/frontend` se a raiz do repo for o pai). Configurar variáveis de ambiente no dashboard da Vercel (Produção).

## Backend (VPS)

### Variáveis de Ambiente Obrigatórias

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `NODE_ENV` | Sim | `production` |
| `PORT` | Sim | Porta do servidor (padrão 3001) |
| `CORS_ORIGINS` | Sim | Origens permitidas separadas por vírgula |
| `SUPABASE_URL` | Sim | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Sim | Chave service role do Supabase |
| `LEADS_WEBHOOK_SECRET` | Sim | Segredo Bearer para webhook de leads |
| `N8N_WEBHOOK_SECRET` | Sim | Segredo Bearer para webhook de erros n8n |
| `FIREBASE_PROJECT_ID` | Sim | ID do projeto Firebase |
| `FIREBASE_CLIENT_EMAIL` | Sim | E-mail da service account do Firebase |
| `FIREBASE_PRIVATE_KEY` | Sim | Chave privada do Firebase (escapar \n) |

### Endpoints da API

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/health` | Nenhum | Health check |
| GET | `/api/leads?clientId=` | Nenhum | Lista leads ordenados por data desc |
| GET | `/api/sheets?sheetId=&gid=` | Nenhum | Proxy do Google Sheets |
| GET | `/api/notifications?limit=` | Bearer Firebase | Lista notificações |
| PATCH | `/api/notifications` | Bearer Firebase | Marcar como lido |
| POST | `/api/leads-webhook` | Bearer LEADS_WEBHOOK_SECRET | Upsert de leads |
| POST | `/api/n8n-error-webhook` | Bearer N8N_WEBHOOK_SECRET | Registrar erro + notificar |

### Deploy com Docker
```sh
cd VexoCrm/backend
docker build -t vexo-api .
docker run -d --name vexo-api --env-file .env -p 3001:3001 --restart unless-stopped vexo-api
```

### Reverse Proxy (exemplo Caddy)
```
api.seudominio.com {
    reverse_proxy localhost:3001
}
```

## Integração (n8n)

URLs de webhook para configurar nos workflows do n8n:
- Leads: `POST https://api.seudominio.com/api/leads-webhook`
- Erros: `POST https://api.seudominio.com/api/n8n-error-webhook`

Headers: `Authorization: Bearer <SECRET>`

## Rollback

1. Apontar DNS / reverse proxy de volta para o backend anterior
2. Reverter variáveis de ambiente da Vercel para a URL anterior da API
3. Fazer redeploy do frontend (Vercel faz redeploy automático ao alterar env, se configurado)
4. Meta: rollback em menos de 10 minutos
