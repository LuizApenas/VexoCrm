# VexoCrm Backend

Backend API for VexoCrm. Located at `VexoCrm/backend/`. Runs on VPS with Docker, exposes leads, notifications, sheets proxy, and webhook endpoints.

## Tech Stack

- Node.js 20
- Express 4
- Supabase JS (database access)
- Firebase Admin (ID token validation)

## Setup

```sh
cd VexoCrm/backend
npm install
cp .env.example .env
# Fill all required variables in .env
```

## Run

```sh
npm run start    # production
npm run dev      # development (file watching)
```

Health check: `curl http://localhost:3001/health`

## Docker

```sh
docker build -t vexo-api .
docker run --env-file .env -p 3001:3001 vexo-api
```

### Production (with Caddy reverse proxy)

```sh
docker compose -f docker-compose.prod.yml up -d
```

## API Endpoints

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/health` | None | Health check |
| GET | `/api/leads?clientId=` | None | List leads |
| GET | `/api/sheets?sheetId=&gid=` | None | Google Sheets proxy |
| GET | `/api/notifications?limit=` | Bearer Firebase | List notifications |
| PATCH | `/api/notifications` | Bearer Firebase | Mark read |
| POST | `/api/leads-webhook` | Bearer secret | Upsert leads |
| POST | `/api/n8n-error-webhook` | Bearer secret | Log error + notify |

## Environment Variables

See [`.env.example`](.env.example) for the full list of required variables.

## Deploy

See [`docs/context/topics/deploy.md`](../docs/context/topics/deploy.md) for the full deploy guide.
