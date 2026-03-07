# ADR-0001: Backend na VPS, Frontend na Vercel

## Status
Aceito

## Data
2026-03-05

## Contexto
O VexoCrm era originalmente implantado com Supabase Edge Functions tratando a lógica da API (leads-webhook, n8n-error-webhook, notifications-api, sheets-proxy). Isso criou acoplamento forte entre frontend e plataforma Supabase, limitou a observabilidade e dificultou o desenvolvimento local.

## Decisão
Separar em dois serviços independentes:
- **VexoCrm** (frontend React/Vite) implantado na **Vercel**
- **Backend** (Node/Express) implantado na **VPS via Docker**

Subdecisões principais:
- Autenticação de notificações usa validação de token Firebase Admin (não Supabase Auth)
- Cutover direto, sem fallback para Supabase Edge Functions
- Banco de dados permanece no Supabase (PostgreSQL)
- Sem migração de schema nesta fase

## Consequências
- Positivo: Escalabilidade independente, melhor observabilidade, desenvolvimento local mais simples
- Positivo: CORS controlado via variável de ambiente CORS_ORIGINS
- Negativo: Exige gerenciamento de VPS (Docker, Nginx/Caddy, HTTPS)
- Negativo: Risco de cutover sem fallback (mitigado por janela curta + rollback DNS)
- Próximos passos: Desativar Edge Functions após validação do cutover

## Referências
- Plano: Separação Backend VPS / Frontend Vercel
- backend/src/server.js — todos os endpoints
- frontend/src/lib/api.ts — uso de API_BASE_URL
