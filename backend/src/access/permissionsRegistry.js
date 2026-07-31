// Registro Central de Permissões (PERMISSIONS_REGISTRY) — objetivo 3 da reformulação.
//
// FONTE ÚNICA DE VERDADE das permissões granulares do Vexo OS. Consumido por:
//   - guards do backend (autorização por permissão em vez de "página interna");
//   - migração transparente de usuários antigos (presets → permissões);
//   - matriz de toggles do admin (frontend, via /api/access/registry);
//   - Vexo Academy dinâmico (filtra tutoriais pelas permissões do usuário).
//
// Cada permissão declara `legacyPages`/`legacyViews`: as páginas internas / views de
// cliente que ANTES liberavam a mesma capacidade. Isso mantém usuários antigos
// funcionando (compat) enquanto migramos o gating para permissões, e serve de mapa
// reverso para a migração (preset antigo → permissões novas).
//
// Ao adicionar uma ferramenta nova ao sistema, basta registrar a permissão aqui:
// admin e treinamento se atualizam sozinhos para todos os usuários.

export const PERMISSION_CATEGORIES = [
  { key: "vendas_crm", label: "Máquina de Vendas & CRM" },
  { key: "disparos_whatsapp", label: "Máquina de Disparos & WhatsApp" },
  { key: "agente_ia", label: "Agente de Inteligência Artificial (IA)" },
  { key: "relatorios", label: "Relatórios & Inteligência" },
  { key: "administracao", label: "Administração da Empresa" },
];

// roles: quem PODE receber a permissão. "internal" = equipe Vexo; "client" = usuário do tenant.
export const PERMISSIONS_REGISTRY = [
  // A) MÁQUINA DE VENDAS & CRM
  { key: "dashboard.view", category: "vendas_crm", label: "Visualizar Dashboard e Métricas", roles: ["internal", "client"], legacyPages: ["dashboard"], legacyViews: ["dashboard"] },
  { key: "leads.view", category: "vendas_crm", label: "Visualizar Lista de Leads", roles: ["internal", "client"], legacyPages: ["leads"], legacyViews: ["leads"] },
  { key: "leads.export", category: "vendas_crm", label: "Exportar Leads (Excel/CSV)", roles: ["internal", "client"], legacyPages: ["leads", "planilhas"], legacyViews: ["leads"] },
  { key: "banco_dados.view", category: "vendas_crm", label: "Acessar Banco de Dados Inteligente", roles: ["internal", "client"], legacyPages: ["planilhas"], legacyViews: ["planilhas"] },
  { key: "banco_dados.extract_wa", category: "vendas_crm", label: "Executar Extração de Contatos via WhatsApp", roles: ["internal", "client"], legacyPages: ["planilhas"], legacyViews: ["planilhas"] },
  { key: "banco_dados.import", category: "vendas_crm", label: "Importar Planilhas de Leads", roles: ["internal", "client"], legacyPages: ["planilhas"], legacyViews: ["planilhas"] },
  { key: "banco_dados.delete", category: "vendas_crm", label: "Excluir Leads da Base", roles: ["internal", "client"], legacyPages: ["planilhas"], legacyViews: ["planilhas"] },
  { key: "geracao_digital.proposals", category: "vendas_crm", label: "Criar e Gerar Propostas Comerciais (GD)", roles: ["internal", "client"], legacyPages: ["geracao-digital", "propostas-gd", "implantacao-gd", "apresentacao-gd", "briefings-gd", "dashboard-gd"], legacyViews: [] },
  { key: "geracao_digital.prices", category: "vendas_crm", label: "Alterar Valores e Condições de Proposta", roles: ["internal", "client"], legacyPages: ["geracao-digital", "propostas-gd"], legacyViews: [] },

  // B) MÁQUINA DE DISPAROS & WHATSAPP
  { key: "whatsapp.view", category: "disparos_whatsapp", label: "Acessar Tela de Conversas (Inbox)", roles: ["internal", "client"], legacyPages: ["whatsapp"], legacyViews: ["whatsapp"] },
  { key: "whatsapp.reply", category: "disparos_whatsapp", label: "Responder Mensagens no Inbox", roles: ["internal", "client"], legacyPages: ["whatsapp"], legacyViews: ["whatsapp"] },
  { key: "whatsapp.chips_view", category: "disparos_whatsapp", label: "Visualizar Chips Conectados no Tenant", roles: ["internal", "client"], legacyPages: ["conexoes", "whatsapp"], legacyViews: ["whatsapp"] },
  { key: "whatsapp.chips_add", category: "disparos_whatsapp", label: "Conectar Novo Chip WhatsApp (QR Code)", roles: ["internal", "client"], legacyPages: ["conexoes"], legacyViews: [] },
  { key: "whatsapp.chips_delete", category: "disparos_whatsapp", label: "Remover/Desconectar Chip WhatsApp", roles: ["internal", "client"], legacyPages: ["conexoes"], legacyViews: [] },
  { key: "campaigns.view", category: "disparos_whatsapp", label: "Visualizar Campanhas", roles: ["internal", "client"], legacyPages: ["planilhas", "campanhas", "disparos"], legacyViews: ["planilhas"] },
  { key: "campaigns.create", category: "disparos_whatsapp", label: "Criar Nova Campanha", roles: ["internal", "client"], legacyPages: ["planilhas", "campanhas", "disparos"], legacyViews: ["planilhas"] },
  { key: "campaigns.delete", category: "disparos_whatsapp", label: "Excluir Campanha", roles: ["internal", "client"], legacyPages: ["planilhas", "campanhas", "disparos"], legacyViews: ["planilhas"] },
  { key: "dispatches.execute", category: "disparos_whatsapp", label: "Executar e Disparar Lotes de Mensagens", roles: ["internal", "client"], legacyPages: ["planilhas", "disparos", "campanhas"], legacyViews: ["planilhas"] },
  { key: "dispatches.pause", category: "disparos_whatsapp", label: "Pausar Disparo em Andamento", roles: ["internal", "client"], legacyPages: ["planilhas", "disparos", "campanhas"], legacyViews: ["planilhas"] },
  { key: "dispatches.export_failed", category: "disparos_whatsapp", label: "Exportar Relatório de Leads Falhados", roles: ["internal", "client"], legacyPages: ["planilhas", "disparos", "relatorios"], legacyViews: ["planilhas"] },

  // C) AGENTE DE INTELIGÊNCIA ARTIFICIAL (IA)
  { key: "agente.view", category: "agente_ia", label: "Visualizar Painel do Agente IA (Iara)", roles: ["internal", "client"], legacyPages: ["agente"], legacyViews: [] },
  { key: "agente.toggle", category: "agente_ia", label: "Ligar / Desligar Atendimento por IA", roles: ["internal", "client"], legacyPages: ["agente"], legacyViews: [] },
  { key: "agente.edit_prompt", category: "agente_ia", label: "Editar Prompt / Instruções do Agente IA", roles: ["internal", "client"], legacyPages: ["agente"], legacyViews: [] },
  { key: "agente.change_llm", category: "agente_ia", label: "Alterar Provedor/Modelo de LLM (OpenAI, Groq, Anthropic)", roles: ["internal", "client"], legacyPages: ["agente"], legacyViews: [] },
  { key: "agente.change_identity", category: "agente_ia", label: "Alterar Nome e Foto do Agente", roles: ["internal", "client"], legacyPages: ["agente"], legacyViews: [] },

  // D) RELATÓRIOS & INTELIGÊNCIA
  { key: "reports.commercial", category: "relatorios", label: "Acessar Relatórios Comerciais", roles: ["internal", "client"], legacyPages: ["inteligencia-comercial", "relatorios"], legacyViews: [] },
  { key: "reports.dispatches", category: "relatorios", label: "Acessar Relatórios de Envio de WhatsApp", roles: ["internal", "client"], legacyPages: ["relatorios", "disparos"], legacyViews: [] },
  { key: "reports.export_pdf", category: "relatorios", label: "Exportar Relatórios em PDF", roles: ["internal", "client"], legacyPages: ["relatorios", "inteligencia-comercial"], legacyViews: [] },

  // E) ADMINISTRAÇÃO DA EMPRESA
  { key: "users.view", category: "administracao", label: "Visualizar Usuários Cadastrados", roles: ["internal"], legacyPages: ["usuarios"], legacyViews: [] },
  { key: "users.manage", category: "administracao", label: "Incluir, Editar Permissões e Desativar Usuários", roles: ["internal"], legacyPages: ["usuarios"], legacyViews: [] },
  { key: "tenants.manage", category: "administracao", label: "Gerenciar Dados da Empresa / Tenant", roles: ["internal"], legacyPages: ["empresas"], legacyViews: [] },
];

export const PERMISSION_KEYS = PERMISSIONS_REGISTRY.map((p) => p.key);

const PERMISSION_BY_KEY = new Map(PERMISSIONS_REGISTRY.map((p) => [p.key, p]));

export function getPermissionDefinition(key) {
  return PERMISSION_BY_KEY.get(key) || null;
}

export function isValidPermissionKey(key) {
  return PERMISSION_BY_KEY.has(key);
}

// Filtra uma lista arbitrária de chaves, mantendo só permissões válidas do registro.
export function sanitizePermissionKeys(value) {
  const list = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];

  return Array.from(
    new Set(
      list
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter((item) => PERMISSION_BY_KEY.has(item))
    )
  );
}

// Permissões cujo legacyPages/legacyViews cobre a página/view antiga informada.
// Usado na migração: um usuário antigo que tinha a página "planilhas" recebe todas as
// permissões cujo legacyPages inclui "planilhas".
export function permissionsForLegacyPages(pages = []) {
  const pageSet = new Set((pages || []).filter(Boolean));
  if (pageSet.size === 0) return [];

  return PERMISSIONS_REGISTRY.filter(
    (p) => p.roles.includes("internal") && (p.legacyPages || []).some((page) => pageSet.has(page))
  ).map((p) => p.key);
}

export function permissionsForLegacyViews(views = []) {
  const viewSet = new Set((views || []).filter(Boolean));
  if (viewSet.size === 0) return [];

  return PERMISSIONS_REGISTRY.filter(
    (p) => p.roles.includes("client") && (p.legacyViews || []).some((view) => viewSet.has(view))
  ).map((p) => p.key);
}

// Permissões antigas (ACCESS_PERMISSION_KEYS) → granulares novas. Chaves iguais que já
// existem no registro passam direto; só as que mudaram de nome/granularidade têm alias.
export const LEGACY_PERMISSION_ALIASES = {
  "imports.manage": ["banco_dados.import"],
  "campaigns.manage": [
    "campaigns.view",
    "campaigns.create",
    "campaigns.delete",
    "dispatches.execute",
    "dispatches.pause",
    "dispatches.export_failed",
  ],
};

export function translateLegacyPermissions(keys = []) {
  const out = [];
  for (const raw of keys) {
    const key = typeof raw === "string" ? raw.trim() : "";
    if (!key) continue;
    if (LEGACY_PERMISSION_ALIASES[key]) {
      out.push(...LEGACY_PERMISSION_ALIASES[key]);
    } else if (PERMISSION_BY_KEY.has(key)) {
      out.push(key);
    }
  }
  return Array.from(new Set(out));
}

// Migração transparente (objetivo 2): calcula o conjunto EFETIVO de permissões granulares
// de um usuário a partir do que ele já tinha, sem NUNCA reduzir acesso. É a união de:
//   - permissões já granulares (novo modelo), + aliases de permissões antigas;
//   - permissões derivadas das páginas internas antigas (usuário interno);
//   - permissões derivadas das views de cliente antigas (usuário do tenant);
//   - todas as permissões, se for admin.
export function deriveEffectivePermissions({
  isAdmin = false,
  role = "internal",
  storedPermissions = [],
  internalPages = [],
  allowedViews = [],
} = {}) {
  if (isAdmin || role === "superadmin") {
    return [...PERMISSION_KEYS];
  }

  const derived = new Set(translateLegacyPermissions(storedPermissions));

  if (role === "internal") {
    for (const key of permissionsForLegacyPages(internalPages)) derived.add(key);
  }
  if (role === "client") {
    for (const key of permissionsForLegacyViews(allowedViews)) derived.add(key);
  }

  return Array.from(derived);
}

// Mapa reverso página/view → permissões que a cobrem. Usado pelos guards para autorizar
// por PERMISSÃO em vez de por "página interna", liberando o uso da ferramenta a qualquer
// usuário válido do tenant (interno ou cliente) que tenha a permissão — objetivo 1.
export function permissionsCoveringPage(page) {
  return PERMISSIONS_REGISTRY.filter((p) => (p.legacyPages || []).includes(page)).map((p) => p.key);
}

export function permissionsCoveringView(view) {
  return PERMISSIONS_REGISTRY.filter((p) => (p.legacyViews || []).includes(view)).map((p) => p.key);
}

export function accessHasPagePermission(access, page) {
  const pages = Array.isArray(page) ? page : [page];
  const held = new Set((access && access.permissions) || []);
  return pages.some((pg) => permissionsCoveringPage(pg).some((key) => held.has(key)));
}

export function accessHasViewPermission(access, view) {
  const views = Array.isArray(view) ? view : [view];
  const held = new Set((access && access.permissions) || []);
  return views.some((vw) => permissionsCoveringView(vw).some((key) => held.has(key)));
}

// Payload servido ao frontend (matriz do admin + academy) — objetivo 3.
export function buildPermissionsRegistryPayload() {
  return {
    categories: PERMISSION_CATEGORIES,
    permissions: PERMISSIONS_REGISTRY.map((p) => ({
      key: p.key,
      label: p.label,
      category: p.category,
      roles: p.roles,
      legacyPages: p.legacyPages || [],
      legacyViews: p.legacyViews || [],
    })),
  };
}
