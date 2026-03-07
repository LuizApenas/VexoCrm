# VexoCrm

CRM for workflows, notifications, and agent interactions. Monorepo with backend (API) and frontend.

## Structure

```
VexoCrm/
├── backend/       # Node/Express API (VPS + Docker)
│   ├── src/
│   ├── Dockerfile
│   ├── docker-compose.prod.yml
│   └── ...
├── frontend/      # React/Vite app (Vercel)
│   ├── src/
│   ├── vercel.json
│   └── ...
└── README.md
```

## Quick Start (Local)

### Option 1: Use root script (recommended)

From `Vexo/` root:

```powershell
.\start.ps1              # Frontend only
.\start.ps1 -All         # Backend + frontend
.\start.ps1 -Backend     # Backend only
```

### Option 2: Manual

**Backend:**
```sh
cd backend
npm install
cp .env.example .env
# Fill .env with Supabase, Firebase, webhook secrets
npm run start
```

**Frontend:**
```sh
cd frontend
npm install
cp .env.example .env
# Set VITE_API_BASE_URL=http://localhost:3001
npm run dev
```

## Environment

| Location | Key vars |
|----------|----------|
| `backend/.env` | SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FIREBASE_*, LEADS_WEBHOOK_SECRET, N8N_WEBHOOK_SECRET |
| `frontend/.env` | VITE_API_BASE_URL, VITE_FIREBASE_* |

## Deploy

- **Frontend**: Vercel — set Root Directory to `frontend` (or `VexoCrm/frontend`)
- **Backend**: VPS (Docker) or EasyPanel — build from `backend/`

Deploy details: `.cursor/context/topics/deploy.md` (local, when using Cursor).

## Related

- [Backend README](backend/README.md)
- [Frontend README](frontend/README.md)

> **Note:** If the old `VexoApi/` folder exists at repo root, remove it manually. All backend code is in `backend/`.
