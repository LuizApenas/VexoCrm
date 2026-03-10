    # VexoCrm

    CRM para workflows, notificações e interações com agentes. Monorepo com backend (API Node/Express) e frontend (React/Vite). Deploy na Vercel (frontend) e VPS/EasyPanel (backend), com Supabase (PostgreSQL), Firebase Auth e webhooks n8n.

    ## Arquitetura do Sistema

    ```mermaid
    flowchart TB
        subgraph frontend [Frontend - Vercel]
            React[React/Vite]
            Firebase[Firebase Auth]
        end

        subgraph backend [Backend - VPS/EasyPanel]
            Express[Express API]
            FirebaseAdmin[Firebase Admin]
        end

        subgraph external [Serviços Externos]
            Supabase[(Supabase PostgreSQL)]
            GoogleSheets[Google Sheets]
            N8N[n8n Workflows]
        end

        React -->|"REST + Bearer"| Express
        React --> Firebase
        Express --> FirebaseAdmin
        Express --> Supabase
        Express --> GoogleSheets
        N8N -->|"Webhooks Bearer"| Express
    ```

    ## Fluxo de Requisição

    ```mermaid
    sequenceDiagram
        participant Usuario
        participant Frontend
        participant Backend
        participant Supabase

        Usuario->>Frontend: Navega / ação
        Frontend->>Firebase: Obtém ID token
        Frontend->>Backend: Requisição API + Bearer token
        Backend->>Backend: Valida token
        Backend->>Supabase: Query / upsert
        Supabase-->>Backend: Resultado
        Backend-->>Frontend: Resposta JSON
        Frontend-->>Usuario: Renderiza
    ```

    ## Fluxo de Autenticação

    ```mermaid
    flowchart LR
        subgraph naoAutenticado [Não autenticado]
            Login[Página de Login]
        end

        subgraph autenticado [Autenticado]
            Dashboard[Dashboard]
            Leads[Leads]
            Agente[Agente]
        end

        Login -->|"Firebase signIn"| Firebase[Firebase Auth]
        Firebase -->|"ID token"| Frontend[Frontend]
        Frontend -->|"Bearer token"| Backend[Backend]
        Backend -->|"verifyIdToken"| FirebaseAdmin[Firebase Admin]
        FirebaseAdmin -->|"decoded"| Backend
        Backend -->|"200"| Frontend
        Frontend --> Dashboard
        Frontend --> Leads
        Frontend --> Agente
    ```

    ## Fluxo dos Webhooks n8n

    ```mermaid
    sequenceDiagram
        participant N8N as n8n Workflow
        participant Backend
        participant Supabase

    N8N->>Backend: POST /api/leads-webhook
    Backend->>Backend: Valida Bearer secret
    Backend->>Supabase: Upsert leads
    Supabase-->>Backend: OK
    Backend-->>N8N: 200

    N8N->>Backend: POST /api/conversation-memory
    Backend->>Backend: Valida Bearer secret
    Backend->>Backend: Valida gzip+base64 e sanitiza telefone
    Backend->>Supabase: Insert lead_conversations
    Supabase-->>Backend: OK
    Backend-->>N8N: 200

    N8N->>Backend: POST /api/n8n-error-webhook
    Backend->>Backend: Valida Bearer secret
    Backend->>Supabase: Insert n8n_error_logs
        Backend->>Supabase: Insert notifications
        Supabase-->>Backend: OK
        Backend-->>N8N: 200
    ```

    ## Estrutura de Diretórios

    ```
    VexoCrm/
    ├── backend/                 # API Node/Express
    │   ├── src/
    │   │   └── server.js        # Todas as rotas e lógica
    │   ├── scripts/
    │   │   └── import-leads.js  # Importa leads de JSON para Supabase
    │   ├── .env.example
    │   ├── Dockerfile
    │   └── docker-compose.prod.yml
    ├── frontend/                # App React/Vite
    │   ├── src/
    │   │   ├── components/      # UI, gráficos, AppSidebar, ProtectedRoute
    │   │   ├── contexts/        # AuthContext
    │   │   ├── hooks/           # useLeads, useNotifications, useSheets
    │   │   ├── lib/             # api, firebase, sheets, utils
    │   │   └── pages/           # Index, Leads, Agente, Login, SetPassword
    │   ├── supabase/
    │   │   └── migrations/     # Migrações SQL
    │   ├── vercel.json
    │   └── .env.example
    ├── scripts/                 # Import e setup
    │   ├── setup-leads-tables.sql
    │   ├── excel-to-leads.py
    │   └── README-import-leads.md
    └── README.md
    ```

    ## Schema do Banco de Dados

    ```mermaid
    erDiagram
        leads_clients ||--o{ leads : "possui"
        leads_clients {
            text id PK
            text name
            timestamptz created_at
        }
        leads {
            uuid id PK
            text client_id FK
            text telefone
            text nome
            text tipo_cliente
            text faixa_consumo
            text cidade
            text estado
            text conta_energia
            text status
            boolean bot_ativo
            text historico
            timestamptz data_hora
            text qualificacao
            timestamptz created_at
            timestamptz updated_at
        }
        notifications {
            uuid id PK
            text type
            text title
            text description
            text link
            boolean read
            timestamptz created_at
        }
    n8n_error_logs {
        text execution_id PK
        text workflow_name
        text message
        text node
        text execution_url
    }
    lead_conversations {
        uuid id PK
        text telefone
        text conversation_compressed
        integer tamanho_original
        boolean unknown_lead
        timestamptz created_at
    }
```

| Tabela            | Propósito                           | Relacionamentos                    |
|-------------------|-------------------------------------|------------------------------------|
| `leads_clients`   | Grupos de clientes / fontes de leads| Referenciada por `leads.client_id` |
| `leads`           | Registros de leads                  | FK para `leads_clients`            |
| `notifications`   | Notificações de usuário (erros n8n) | Append-only, RLS bloqueia acesso direto |
| `n8n_error_logs`  | Rastreamento de erros n8n           | Append-only, RLS bloqueia acesso direto |
| `lead_conversations` | Memória comprimida de conversas do agente | Consulta opcional por telefone |

    ## Resumo dos Endpoints da API

    | Método | Endpoint                  | Auth              | Descrição                          |
    |--------|---------------------------|-------------------|------------------------------------|
    | GET    | `/health`                 | Nenhum            | Health check (Supabase, Firebase)  |
    | GET    | `/api/leads?clientId=`    | Nenhum            | Lista leads (cliente padrão: infinie) |
    | GET    | `/api/sheets?sheetId=&gid=` | Nenhum          | Proxy CSV do Google Sheets         |
| GET    | `/api/notifications`      | Bearer Firebase   | Lista notificações                 |
| PATCH  | `/api/notifications`      | Bearer Firebase   | Marca notificação(s) como lida(s)  |
| POST   | `/api/leads-webhook`      | Bearer secret     | Upsert de leads via n8n            |
| POST   | `/api/conversation-memory` | Bearer secret    | Salva memória comprimida da conversa |
| POST   | `/api/n8n-error-webhook`  | Bearer secret     | Registra erro n8n e cria notificação |

    ## Variáveis de Ambiente

    | Local         | Variáveis principais                                                                 |
    |---------------|---------------------------------------------------------------------------------------|
    | `backend/.env`  | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `FIREBASE_*`, `LEADS_WEBHOOK_SECRET`, `N8N_WEBHOOK_SECRET`, `CORS_ORIGINS`, `PORT` |
    | `frontend/.env` | `VITE_API_BASE_URL`, `VITE_FIREBASE_*`                                               |

    Veja [README Backend](backend/README.md) e [README Frontend](frontend/README.md) para listas completas.
    Documentação detalhada do banco: [database.md](database.md)

    ## Quick Start (Local)

    ### Opção 1: Script da raiz (recomendado)

    Na raiz de `Vexo/`:

    ```powershell
    .\start.ps1              # Apenas frontend
    .\start.ps1 -All        # Backend + frontend
    .\start.ps1 -Backend    # Apenas backend
    ```

    ### Opção 2: Manual

    **Backend:**
    ```sh
    cd backend
    npm install
    cp .env.example .env
    # Preencha .env com Supabase, Firebase, segredos dos webhooks
    npm run start
    ```

    **Frontend:**
    ```sh
    cd frontend
    npm install
    cp .env.example .env
    # Defina VITE_API_BASE_URL=http://localhost:3001
    npm run dev
    ```

    ## Deploy

    - **Frontend:** Vercel — defina Root Directory como `frontend` (ou `VexoCrm/frontend`)
    - **Backend:** VPS (Docker) ou EasyPanel — build a partir de `backend/`

    Detalhes: `.cursor/context/topics/deploy.md` (local, com Cursor).

    ## Casos de Uso

    ### UC1: Login e Acesso ao Dashboard

    ```mermaid
    flowchart LR
        A[Usuário acessa app] --> B{Autenticado?}
        B -->|Não| C[Redireciona para /login]
        C --> D[Usuário faz login com Firebase]
        D --> E[Obtém ID token]
        E --> F[Armazena em AuthContext]
        F --> G[Redireciona para /]
        B -->|Sim| G
        G --> H[Dashboard com KPIs e gráficos]
    ```

    ### UC2: Visualizar e Filtrar Leads

    ```mermaid
    flowchart LR
        A[Usuário acessa /leads] --> B[hook useLeads]
        B --> C[GET /api/leads?clientId=infinie]
        C --> D[Backend consulta Supabase]
        D --> E[Resposta JSON]
        E --> F[Cache TanStack Query]
        F --> G[Tabela de leads renderizada]
    ```

    ### UC3: Receber Notificação de Erro n8n

    ```mermaid
    flowchart LR
        A[Workflow n8n falha] --> B[Nó de erro dispara]
        B --> C[POST /api/n8n-error-webhook]
        C --> D[Backend valida secret]
        D --> E[Insert n8n_error_logs]
        E --> F[Insert notifications]
        F --> G[Usuário faz polling GET /api/notifications]
        G --> H[NotificationBell exibe badge]
        H --> I[Usuário clica para ver]
    ```

    ### UC4: Importar Leads do Excel

    ```mermaid
    flowchart LR
        A[Arquivo Excel] --> B[excel-to-leads.py]
        B --> C[leads.json]
        C --> D[import-leads.js]
        D --> E[Cliente Supabase do backend]
        E --> F[Upsert na tabela leads]
    ```

    Veja [scripts/README-import-leads.md](scripts/README-import-leads.md) para instruções passo a passo.

    ### UC5: Proxy de Dados do Google Sheets

    ```mermaid
    flowchart LR
        A[Frontend useSheets] --> B[GET /api/sheets?sheetId=&gid=]
        B --> C[Backend busca CSV do Google]
        C --> D[Parse CSV para linhas]
        D --> E[Resposta JSON]
        E --> F[Gráficos / tabelas renderizam]
    ```

    A planilha deve estar "Publicada na web" (Arquivo > Compartilhar > Publicar na web > CSV).

    ## Documentação Relacionada

    | Documento | Descrição |
    |-----------|-----------|
    | [README Backend](backend/README.md) | Referência da API, funções, endpoints |
    | [README Frontend](frontend/README.md) | Componentes, hooks, rotas |
    | [README Import Leads](scripts/README-import-leads.md) | Pipeline Excel → Supabase |

    > **Nota:** Se a pasta antiga `VexoApi/` existir na raiz do repo, remova manualmente. Todo o código do backend está em `backend/`.
