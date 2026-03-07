# VexoCrm Frontend

Frontend application for VexoCrm. Located at `VexoCrm/frontend/`. Provides a unified UI for workflows, notifications, and agent interactions.

## Tech Stack

- **Runtime**: Node.js 18+
- **Build**: Vite 5
- **Framework**: React 18
- **Language**: TypeScript
- **UI**: shadcn/ui, Tailwind CSS, Radix UI
- **Auth**: Firebase (Google Sign-In)
- **Backend**: VexoCrm backend (Node/Express on VPS) + Supabase (PostgreSQL)
- **State**: TanStack Query, React Hook Form
- **Validation**: Zod

## Prerequisites

- Node.js 18+ and npm (or [nvm](https://github.com/nvm-sh/nvm#installing-and-updating))
- Backend running locally (`http://localhost:3001`) or in VPS
- Firebase project (vexocrm)

## Setup

```sh
# Clone the repository
git clone <YOUR_GIT_URL>
cd VexoCrm/frontend

# Install dependencies
npm install

# Copy env template and fill in values
cp .env.example .env
```

### Environment Variables

Create a `.env` file in `frontend/` with:

| Variable | Description |
|----------|-------------|
| `VITE_API_BASE_URL` | Backend base URL (e.g. `http://localhost:3001` or `https://api.seudominio.com`) |
| `VITE_FIREBASE_API_KEY` | Firebase API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain (e.g. `vexocrm.firebaseapp.com`) |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID (e.g. `vexocrm`) |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase app ID |
| `VITE_FIREBASE_MEASUREMENT_ID` | Firebase analytics measurement ID (optional) |

## Development

```sh
# From Vexo root — use script (recommended)
.\start.ps1              # Frontend only
.\start.ps1 -All         # Backend + frontend

# Or from frontend/
npm run dev

# Run tests
npm run test

# Lint
npm run lint

# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
VexoCrm/                 # Repo root
├── backend/             # API (VPS + Docker)
├── frontend/            # This app (Vercel)
│   ├── src/
│   └── ...
```

```
frontend/
├── src/
│   ├── components/     # UI components (shadcn, AppSidebar, etc.)
│   ├── contexts/       # AuthContext, etc.
│   ├── hooks/          # useNotifications, useLeads
│   ├── lib/            # Firebase and API helpers
│   ├── pages/          # Index, Agente, Login, SetPassword
│   └── App.tsx
└── public/
```

## Leads (PostgreSQL + n8n)

Leads are stored in PostgreSQL. The `/leads` page reads from the `leads` table.

### Setup

1. Run migrations in Supabase (`supabase db push`).
2. Configure `LEADS_WEBHOOK_SECRET` in `backend/.env`.
3. Deploy `backend` to VPS.

### n8n HTTP Request

Add an HTTP Request node to your workflow:

- **Method**: POST
- **URL**: `https://<SEU_BACKEND>/api/leads-webhook`
- **Headers**: `Authorization: Bearer <LEADS_WEBHOOK_SECRET>`
- **Body** (JSON):

```json
{
  "client_id": "infinie",
  "lead": {
    "Telefone": "5534999999999",
    "Nome": "Cliente",
    "Tipo de Cliente": "residencial",
    "Faixa de Consumo": "R$ 300",
    "Cidade": "Uberlândia",
    "Estado": "MG",
    "status": "em_qualificacao",
    "Bot Ativo": true,
    "Historico": "...",
    "Data e Hora": "2026-03-04T12:00:00-03:00"
  }
}
```

For batch: `{ "leads": [{ ... }, { ... }] }`. Upsert by `(client_id, telefone)` in Supabase.

## Deploy

- **Frontend (Vercel)**: configure `VITE_API_BASE_URL` apontando para a VPS.
- **Backend (VPS)**: usar `backend/Dockerfile` + reverse proxy (Nginx/Caddy) com HTTPS.

## Features

- **Authentication**: Google Sign-In via Firebase
- **Notifications**: n8n error notifications with polling and mark-as-read
- **Protected routes**: Login required for main app
- **Agent interface**: AI agent interaction page

## Related

- Backend: [../backend](../backend)
- Context and decisions: [../docs/context](../docs/context/)
