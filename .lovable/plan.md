

# Sistema de Notificacao de Erros n8n - Plano Final

## Correcoes Identificadas

### 1. Secret FIREBASE_PROJECT_ID
O secret `FIREBASE_PROJECT_ID` precisa ter o valor `vexocrm` (nao `project-847527684058`). Este valor e usado como `issuer` e `audience` na validacao do Firebase JWT:
- issuer: `https://securetoken.google.com/vexocrm`
- audience: `vexocrm`

Se o valor atual estiver errado, sera necessario atualiza-lo via dashboard do Supabase.

### 2. URL das Edge Functions no Frontend
Este projeto usa **Vite** (nao Next.js), portanto a variavel correta e `import.meta.env.VITE_SUPABASE_URL`. Nao usaremos `process.env.NEXT_PUBLIC_*`.

---

## Arquivos a Criar

### Edge Functions

**`supabase/functions/n8n-error-webhook/index.ts`**
- CORS (OPTIONS -> 200)
- Valida `Authorization: Bearer` contra `Deno.env.get("N8N_WEBHOOK_SECRET")`
- Parse body, valida campos obrigatorios
- Trunca message (1000), node (200)
- Upsert em `n8n_error_logs` com `onConflict: "execution_id"`
- Insert em `notifications`
- Client: `createClient(Deno.env.get("URL")!, Deno.env.get("SERVICE_ROLE_KEY")!)`

**`supabase/functions/notifications-api/index.ts`**
- CORS (OPTIONS -> 200)
- Valida Firebase ID Token via `jose` (createRemoteJWKSet):
  - JWKS URL: `https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com`
  - issuer: `https://securetoken.google.com/${Deno.env.get("FIREBASE_PROJECT_ID")}` (= vexocrm)
  - audience: `${Deno.env.get("FIREBASE_PROJECT_ID")}` (= vexocrm)
- GET: params `limit` (default 20, max 50), `onlyUnread`; retorna `{ items, unreadCount }`
- PATCH: body `{ id?, read?, markAllRead? }`
- Client: `createClient(Deno.env.get("URL")!, Deno.env.get("SERVICE_ROLE_KEY")!)`

### Firebase Auth (Frontend)

**`src/lib/firebase.ts`**
- `initializeApp` com credenciais:
  - apiKey: `[REDACTED]`
  - authDomain: `vexocrm.firebaseapp.com`
  - projectId: `vexocrm`
- Export `auth` (getAuth)

**`src/contexts/AuthContext.tsx`**
- Provider com `onAuthStateChanged`
- `signInWithGoogle()` via `signInWithPopup`
- `getIdToken()` retorna token do usuario atual
- Expoe `user`, `loading`, `signInWithGoogle`, `signOut`, `getIdToken`

**`src/pages/Login.tsx`**
- Botao "Entrar com Google"
- Redireciona para `/` apos login

**`src/components/ProtectedRoute.tsx`**
- Verifica autenticacao, redireciona para `/login` se nao logado

### Notificacoes (Frontend)

**`src/hooks/useNotifications.ts`**
- Obtem idToken via `useAuth().getIdToken()`
- URL: `` `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notifications-api` ``
- Polling 15s
- `markAsRead(id)`, `markAllRead()`
- Toast via Sonner para novos items (localStorage `lastSeenCreatedAt`)

**`src/components/NotificationBell.tsx`**
- Bell icon com badge (unreadCount)
- Popover com lista de notificacoes
- Tempo relativo via `date-fns`
- Clicar: marca lida + abre link
- Botao "Marcar todas como lidas"

---

## Arquivos a Modificar

**`supabase/config.toml`** - Adicionar:
```text
[functions.n8n-error-webhook]
verify_jwt = false

[functions.notifications-api]
verify_jwt = false
```

**`src/App.tsx`** - Envolver com `AuthProvider`, adicionar rota `/login`, proteger rotas existentes com `ProtectedRoute`

**`src/components/AppSidebar.tsx`** - Substituir NavLink "/notificacoes" pelo componente `NotificationBell`

---

## Dependencia Nova

- `firebase` (npm package)

---

## Sequencia de Implementacao

1. Verificar/atualizar secret `FIREBASE_PROJECT_ID` para `vexocrm`
2. Instalar `firebase`
3. Atualizar `supabase/config.toml`
4. Criar edge function `n8n-error-webhook`
5. Criar edge function `notifications-api`
6. Criar `src/lib/firebase.ts` + `AuthContext` + `Login` + `ProtectedRoute`
7. Atualizar `App.tsx`
8. Criar hook `useNotifications`
9. Criar `NotificationBell`
10. Integrar na sidebar
11. Deploy e testar

---

## Entregaveis Pos-Implementacao

- Guia de teste curl para o webhook
- Passo a passo de configuracao do n8n com Error Trigger

