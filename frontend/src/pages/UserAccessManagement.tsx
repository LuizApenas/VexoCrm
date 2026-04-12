import { useEffect, useMemo, useState } from "react";
import {
  LockKeyhole,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/EmptyState";
import { ErrorMessage } from "@/components/ErrorMessage";
import { PageShell } from "@/components/PageShell";
import { type LeadClient, useLeadClients } from "@/hooks/useLeadClients";
import { type AdminUserRecord, useAdminUsers } from "@/hooks/useAdminUsers";
import { API_BASE_URL } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  ACCESS_PERMISSION_ORDER,
  CLIENT_VIEW_ORDER,
  buildPresetDefaults,
  getDefaultPresetForRole,
  INTERNAL_PAGE_ORDER,
  isFixedAdminAccount,
  type AccessPermission,
  type AccessPreset,
  type AccessRole,
  type AccessScope,
  type AccessView,
  type ApprovalLevel,
  type InternalPage,
} from "@/lib/access";
import { useAuth } from "@/contexts/AuthContext";

type ManagedRole = AccessRole;

interface UserDraft {
  role: ManagedRole;
  accessPreset: AccessPreset;
  scopeMode: AccessScope;
  approvalLevel: ApprovalLevel;
  companyName: string;
  clientIds: string[];
  allowedViews: AccessView[];
  internalPages: InternalPage[];
  permissions: AccessPermission[];
  disabled: boolean;
}

interface CreateUserDraft {
  email: string;
  password: string;
  displayName: string;
  role: ManagedRole;
  accessPreset: AccessPreset;
  scopeMode: AccessScope;
  approvalLevel: ApprovalLevel;
  companyName: string;
  clientIds: string[];
  allowedViews: AccessView[];
  internalPages: InternalPage[];
  permissions: AccessPermission[];
  sendPasswordReset: boolean;
  disabled: boolean;
}

type AccessDraft = UserDraft | CreateUserDraft;
type RoleFilter = "all" | ManagedRole;

const DEFAULT_INTERNAL_PAGES: InternalPage[] = ["dashboard"];
const DEFAULT_CLIENT_VIEWS: AccessView[] = ["dashboard", "leads"];

const ROLE_LABELS: Record<ManagedRole, string> = {
  internal: "Interno",
  client: "Cliente",
  pending: "Pendente",
};

const ROLE_BADGE_CLASS: Record<ManagedRole, string> = {
  internal: "bg-primary/10 text-primary",
  client: "bg-[#1A5CFF]/10 text-[#1A5CFF]",
  pending: "bg-amber-500/10 text-amber-500",
};

const ROLE_PRESETS: Record<ManagedRole, AccessPreset[]> = {
  internal: ["internal_admin", "internal_manager", "internal_operator"],
  client: ["client_manager", "client_operator", "client_viewer"],
  pending: ["pending"],
};

const ROLE_SCOPES: Record<ManagedRole, AccessScope[]> = {
  internal: ["all_clients", "assigned_clients", "no_client_access"],
  client: ["assigned_clients", "no_client_access"],
  pending: ["no_client_access"],
};

const ROLE_APPROVAL_LEVELS: Record<ManagedRole, ApprovalLevel[]> = {
  internal: ["none", "operator", "supervisor", "manager", "director"],
  client: ["none", "operator", "supervisor", "manager"],
  pending: ["none"],
};

const ROLE_PERMISSIONS: Record<ManagedRole, AccessPermission[]> = {
  internal: [...ACCESS_PERMISSION_ORDER],
  client: [
    "dashboard.view",
    "leads.view",
    "leads.export",
    "imports.manage",
    "whatsapp.view",
    "whatsapp.reply",
  ],
  pending: [],
};

const VIEW_LABELS: Record<AccessView, string> = {
  dashboard: "Dashboard",
  leads: "Leads",
  planilhas: "Planilhas",
  whatsapp: "WhatsApp",
};

const INTERNAL_PAGE_LABELS: Record<InternalPage, string> = {
  dashboard: "Dashboard",
  leads: "Leads",
  planilhas: "Planilhas",
  whatsapp: "WhatsApp",
  agente: "Agente",
  usuarios: "Usuarios",
  campanhas: "Campanhas",
};

const CLIENT_PAGE_TABS = [
  { value: "portal", label: "Portal", items: ["dashboard", "leads", "planilhas"] as AccessView[] },
  { value: "comunicacao", label: "Comunicacao", items: ["whatsapp"] as AccessView[] },
];

const INTERNAL_PAGE_TABS = [
  { value: "operacao", label: "Operacao", items: ["dashboard", "leads", "planilhas", "whatsapp"] as InternalPage[] },
  { value: "gestao", label: "Gestao", items: ["agente", "usuarios", "campanhas"] as InternalPage[] },
];

function buildUserDraft(user: AdminUserRecord): UserDraft {
  const role = user.access.role;
  const accessPreset = user.access.accessPreset || getDefaultPresetForRole(role);
  const defaults = buildPresetDefaults(accessPreset);

  return {
    role,
    accessPreset,
    scopeMode: user.access.scopeMode || defaults.scopeMode,
    approvalLevel: user.access.approvalLevel || defaults.approvalLevel,
    companyName: user.access.companyName || "",
    clientIds: Array.from(new Set(user.access.clientIds || [])),
    allowedViews: user.access.allowedViews?.length
      ? user.access.allowedViews
      : [...defaults.allowedViews],
    internalPages: user.access.internalPages?.length
      ? user.access.internalPages
      : [...defaults.internalPages],
    permissions: user.access.permissions?.length
      ? user.access.permissions
      : [...defaults.permissions],
    disabled: user.disabled,
  };
}

function buildCreateDraft(): CreateUserDraft {
  return normalizeCreateDraftForSimpleForm({
    email: "",
    password: "",
    displayName: "",
    role: "internal",
    accessPreset: "internal_operator",
    scopeMode: "all_clients",
    approvalLevel: "operator",
    companyName: "",
    clientIds: [],
    allowedViews: [],
    internalPages: [...DEFAULT_INTERNAL_PAGES],
    permissions: ["dashboard.view"],
    sendPasswordReset: false,
    disabled: false,
  });
}

function derivePermissionsFromClientViews(views: AccessView[]): AccessPermission[] {
  const permissions: AccessPermission[] = [];

  if (views.includes("dashboard")) permissions.push("dashboard.view");
  if (views.includes("leads")) permissions.push("leads.view");
  if (views.includes("planilhas")) permissions.push("imports.manage");
  if (views.includes("whatsapp")) permissions.push("whatsapp.view", "whatsapp.reply");

  return filterArray(permissions, ACCESS_PERMISSION_ORDER);
}

function derivePermissionsFromInternalPages(pages: InternalPage[]): AccessPermission[] {
  const permissions: AccessPermission[] = [];

  if (pages.includes("dashboard")) permissions.push("dashboard.view");
  if (pages.includes("leads")) permissions.push("leads.view");
  if (pages.includes("planilhas")) permissions.push("imports.manage");
  if (pages.includes("whatsapp")) permissions.push("whatsapp.view", "whatsapp.reply");
  if (pages.includes("agente")) permissions.push("agente.view");
  if (pages.includes("usuarios")) permissions.push("users.view", "users.manage");
  if (pages.includes("campanhas")) permissions.push("campaigns.manage");

  return filterArray(permissions, ACCESS_PERMISSION_ORDER);
}

function applySimpleAccessModel<T extends AccessDraft>(draft: T): T {
  if (draft.role === "pending") {
    return {
      ...draft,
      accessPreset: "pending",
      scopeMode: "no_client_access",
      approvalLevel: "none",
      clientIds: [],
      allowedViews: [],
      internalPages: [],
      permissions: [],
    };
  }

  const selectedClientId = draft.clientIds[0]?.trim() || "";

  if (draft.role === "client") {
    const allowedViews = filterArray(
      draft.allowedViews.length ? draft.allowedViews : DEFAULT_CLIENT_VIEWS,
      CLIENT_VIEW_ORDER
    );
    const accessPreset: AccessPreset =
      allowedViews.includes("planilhas") || allowedViews.includes("whatsapp")
        ? "client_operator"
        : "client_viewer";
    const defaults = buildPresetDefaults(accessPreset);

    return {
      ...draft,
      role: "client",
      accessPreset,
      scopeMode: "assigned_clients",
      approvalLevel: defaults.approvalLevel,
      clientIds: selectedClientId ? [selectedClientId] : [],
      allowedViews,
      internalPages: [],
      permissions: derivePermissionsFromClientViews(allowedViews),
    };
  }

  const internalPages = filterArray(
    draft.internalPages.length ? draft.internalPages : DEFAULT_INTERNAL_PAGES,
    INTERNAL_PAGE_ORDER
  );
  const accessPreset: AccessPreset =
    internalPages.includes("usuarios") || internalPages.includes("campanhas") || internalPages.includes("agente")
      ? "internal_manager"
      : "internal_operator";
  const defaults = buildPresetDefaults(accessPreset);

  return {
    ...draft,
    role: "internal",
    accessPreset,
    scopeMode: selectedClientId ? "assigned_clients" : "all_clients",
    approvalLevel: defaults.approvalLevel,
    clientIds: selectedClientId ? [selectedClientId] : [],
    allowedViews: [],
    internalPages,
    permissions: derivePermissionsFromInternalPages(internalPages),
  };
}

function normalizeCreateDraftForSimpleForm(draft: CreateUserDraft): CreateUserDraft {
  return applySimpleAccessModel(draft);
}

function formatDate(value: string | null) {
  if (!value) return "Nunca";

  try {
    return new Date(value).toLocaleString("pt-BR");
  } catch {
    return value;
  }
}

function toggleItem<T>(items: T[], item: T, checked: boolean) {
  return checked ? Array.from(new Set([...items, item])) : items.filter((entry) => entry !== item);
}

function filterArray<T extends string>(items: T[], allowed: readonly T[]) {
  return Array.from(new Set(items.filter((item): item is T => allowed.includes(item))));
}

function normalizeDraft<T extends AccessDraft>(draft: T): T {
  const role = draft.role;
  const accessPreset = ROLE_PRESETS[role].includes(draft.accessPreset)
    ? draft.accessPreset
    : getDefaultPresetForRole(role);
  const defaults = buildPresetDefaults(accessPreset);

  if (role === "pending") {
    return {
      ...draft,
      role,
      accessPreset: "pending",
      scopeMode: "no_client_access",
      approvalLevel: "none",
      companyName: draft.companyName,
      clientIds: [],
      allowedViews: [],
      internalPages: [],
      permissions: [],
      disabled: draft.disabled,
    };
  }

  const clientIds = Array.from(new Set(draft.clientIds.map((value) => value.trim()).filter(Boolean)));
  const allowedViews = role === "client" ? filterArray(draft.allowedViews, CLIENT_VIEW_ORDER) : [];
  const internalPages = role === "internal" ? filterArray(draft.internalPages, INTERNAL_PAGE_ORDER) : [];
  const permissions = filterArray(draft.permissions, ROLE_PERMISSIONS[role]);

  return {
    ...draft,
    role,
    accessPreset,
    scopeMode: ROLE_SCOPES[role].includes(draft.scopeMode) ? draft.scopeMode : defaults.scopeMode,
    approvalLevel: ROLE_APPROVAL_LEVELS[role].includes(draft.approvalLevel)
      ? draft.approvalLevel
      : defaults.approvalLevel,
    clientIds:
      role === "internal" && draft.scopeMode === "no_client_access" ? [] : clientIds,
    allowedViews: role === "client" ? allowedViews : [],
    internalPages: role === "internal" ? internalPages : [],
    permissions,
  };
}

function transitionDraft<T extends AccessDraft>(draft: T): T {
  const normalized = normalizeDraft(draft);
  const defaults = buildPresetDefaults(normalized.accessPreset);

  if (normalized.role === "client") {
    return {
      ...normalized,
      scopeMode: "assigned_clients",
      approvalLevel: ROLE_APPROVAL_LEVELS.client.includes(normalized.approvalLevel)
        ? normalized.approvalLevel
        : defaults.approvalLevel,
      allowedViews: normalized.allowedViews.length ? normalized.allowedViews : [...defaults.allowedViews],
      internalPages: [],
      permissions: normalized.permissions.length ? normalized.permissions : [...defaults.permissions],
    };
  }

  if (normalized.role === "internal") {
    return {
      ...normalized,
      scopeMode: ROLE_SCOPES.internal.includes(normalized.scopeMode)
        ? normalized.scopeMode
        : defaults.scopeMode,
      approvalLevel: ROLE_APPROVAL_LEVELS.internal.includes(normalized.approvalLevel)
        ? normalized.approvalLevel
        : defaults.approvalLevel,
      allowedViews: [],
      internalPages: normalized.internalPages.length ? normalized.internalPages : [...defaults.internalPages],
      permissions: normalized.permissions.length ? normalized.permissions : [...defaults.permissions],
    };
  }

  return normalized;
}

function buildPayload(draft: AccessDraft) {
  const normalized = normalizeDraft(draft);

  return {
    role: normalized.role,
    accessPreset: normalized.accessPreset,
    scopeMode: normalized.scopeMode,
    approvalLevel: normalized.approvalLevel,
    companyName: normalized.companyName.trim() || undefined,
    clientIds: normalized.clientIds,
    allowedViews: normalized.allowedViews,
    internalPages: normalized.internalPages,
    permissions: normalized.permissions,
    disabled: normalized.disabled,
  };
}

function validateDraft(draft: AccessDraft) {
  const normalized = normalizeDraft(draft);

  if (normalized.role === "client") {
    if (normalized.clientIds.length === 0) {
      return "Selecione ao menos um tenant/cliente para este usuario.";
    }

    if (normalized.allowedViews.length === 0) {
      return "Selecione ao menos uma view para o usuario cliente.";
    }
  }

  if (normalized.role === "internal") {
    if (normalized.scopeMode === "assigned_clients" && normalized.clientIds.length === 0) {
      return "Usuarios internos com escopo vinculado precisam de pelo menos um tenant/cliente.";
    }

    if (normalized.internalPages.length === 0) {
      return "Selecione ao menos uma pagina interna para este usuario.";
    }
  }

  if (normalized.role !== "pending" && normalized.permissions.length === 0) {
    return "Selecione ao menos uma permissao operacional.";
  }

  return null;
}

interface ChecklistPanelProps {
  title: string;
  description: string;
  items: string[];
  selected: string[];
  disabled: boolean;
  emptyMessage: string;
  searchPlaceholder?: string;
  onToggle: (item: string, checked: boolean) => void;
  onSelectAll?: () => void;
  onClear?: () => void;
  renderLabel: (item: string) => string;
  renderHint?: (item: string) => string | null;
}

function ChecklistPanel({
  title,
  description,
  items,
  selected,
  disabled,
  emptyMessage,
  searchPlaceholder,
  onToggle,
  onSelectAll,
  onClear,
  renderLabel,
  renderHint,
}: ChecklistPanelProps) {
  const [search, setSearch] = useState("");
  const term = search.trim().toLowerCase();
  const filteredItems = items.filter((item) => {
    if (!term) return true;

    const label = renderLabel(item).toLowerCase();
    const hint = renderHint?.(item)?.toLowerCase() || "";
    return label.includes(term) || hint.includes(term);
  });

  return (
    <div className="rounded-3xl border border-border/80 bg-background/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="text-xs leading-5 text-muted-foreground">{description}</p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
            {selected.length} selecionados
          </Badge>

          {onSelectAll ? (
            <Button type="button" size="sm" variant="ghost" disabled={disabled || items.length === 0} onClick={onSelectAll}>
              Todos
            </Button>
          ) : null}

          {onClear ? (
            <Button type="button" size="sm" variant="ghost" disabled={disabled || selected.length === 0} onClick={onClear}>
              Limpar
            </Button>
          ) : null}
        </div>
      </div>

      {items.length > 6 ? (
        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={searchPlaceholder || "Filtrar itens"}
            className="pl-9"
          />
        </div>
      ) : null}

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">{emptyMessage}</p>
      ) : filteredItems.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Nenhum item corresponde ao filtro informado.</p>
      ) : (
        <ScrollArea className="mt-4 h-72 pr-3">
          <div className="grid gap-3 md:grid-cols-2">
            {filteredItems.map((item) => (
              <label
                key={item}
                className={cn(
                  "flex items-start gap-3 rounded-2xl border px-3 py-3 text-sm transition-colors",
                  selected.includes(item) ? "border-primary/30 bg-primary/5" : "border-border/70 bg-background/70",
                  disabled ? "opacity-70" : "hover:border-primary/30 hover:bg-primary/5"
                )}
              >
                <Checkbox
                  checked={selected.includes(item)}
                  disabled={disabled}
                  onCheckedChange={(checked) => onToggle(item, checked === true)}
                />
                <span className="space-y-1">
                  <span className="block font-medium text-foreground">{renderLabel(item)}</span>
                  {renderHint?.(item) ? (
                    <span className="block text-xs text-muted-foreground">{renderHint(item)}</span>
                  ) : null}
                </span>
              </label>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

interface AccessPagesTabsProps {
  role: "internal" | "client";
  selected: string[];
  disabled: boolean;
  onChange: (next: string[]) => void;
}

function AccessPagesTabs({ role, selected, disabled, onChange }: AccessPagesTabsProps) {
  const tabs = role === "client" ? CLIENT_PAGE_TABS : INTERNAL_PAGE_TABS;
  const referenceOrder = role === "client" ? CLIENT_VIEW_ORDER : INTERNAL_PAGE_ORDER;
  const [activeTab, setActiveTab] = useState(tabs[0].value);

  useEffect(() => {
    setActiveTab(tabs[0].value);
  }, [role]);

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
      <TabsList className="grid w-full grid-cols-2">
        {tabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} className="mt-0">
          <ChecklistPanel
            title={role === "client" ? "Paginas do cliente" : "Paginas internas"}
            description={
              role === "client"
                ? "Escolha apenas as paginas que o cliente vai enxergar no portal."
                : "Escolha apenas os modulos que esse usuario vai acessar no CRM."
            }
            items={tab.items}
            selected={selected}
            disabled={disabled}
            emptyMessage="Nenhuma pagina disponivel."
            onToggle={(item, checked) => onChange(toggleItem(selected, item, checked))}
            onSelectAll={() =>
              onChange(filterArray(Array.from(new Set([...selected, ...tab.items])), referenceOrder))
            }
            onClear={() => {
              const tabItems = tab.items as string[];
              onChange(selected.filter((item) => !tabItems.includes(item)));
            }}
            renderLabel={(item) =>
              role === "client"
                ? VIEW_LABELS[item as AccessView]
                : INTERNAL_PAGE_LABELS[item as InternalPage]
            }
            renderHint={(item) => {
              if (role === "client") {
                if (item === "whatsapp") return "Inbox e conversa do cliente";
                if (item === "planilhas") return "Importacao e historico";
                return "Pagina visivel no portal";
              }

              if (item === "usuarios") return "Governanca de acessos";
              if (item === "agente") return "Alertas e monitoramento";
              if (item === "campanhas") return "Disparos e campanhas";
              return "Modulo do CRM";
            }}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}

interface AccessGovernanceProps {
  draft: AccessDraft;
  clients: LeadClient[];
  editable: boolean;
  onChange: (patch: Partial<AccessDraft>) => void;
}

function AccessGovernance({ draft, clients, editable, onChange }: AccessGovernanceProps) {
  const normalized = applySimpleAccessModel(draft);
  const matrixDisabled = !editable || normalized.role === "pending";
  const roleOptions: ManagedRole[] =
    normalized.role === "pending" ? ["pending", "internal", "client"] : ["internal", "client"];
  const applyPatch = (patch: Partial<AccessDraft>) => onChange(applySimpleAccessModel({ ...normalized, ...patch }));

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-border/80 bg-background/60 p-5">
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Tipo</p>
            <Select
              value={normalized.role}
              disabled={!editable}
              onValueChange={(value: ManagedRole) => applyPatch({ role: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecionar tipo" />
              </SelectTrigger>
              <SelectContent>
                {roleOptions.map((role) => (
                  <SelectItem key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Empresa / tenant</p>
            <Select
              value={normalized.clientIds[0] || "__none"}
              disabled={!editable}
              onValueChange={(value) => {
                const selectedClient = clients.find((client) => client.id === value);
                applyPatch({
                  clientIds: value === "__none" ? [] : [value],
                  companyName: value === "__none" ? "" : selectedClient?.name || "",
                });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecionar empresa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">
                  {normalized.role === "client" ? "Selecionar empresa" : "Sem empresa vinculada"}
                </SelectItem>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Empresa exibida</p>
            <Input
              value={normalized.companyName}
              disabled={!editable}
              onChange={(event) => applyPatch({ companyName: event.target.value })}
              placeholder="Nome exibido da empresa"
            />
          </div>
        </div>
      </div>

      {normalized.role === "pending" ? (
        <div className="rounded-3xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-700">
          Usuario pendente nao recebe paginas, views nem permissoes operacionais ate a aprovacao.
        </div>
      ) : null}

      {normalized.role !== "pending" ? (
        <AccessPagesTabs
          role={normalized.role}
          selected={normalized.role === "client" ? normalized.allowedViews : normalized.internalPages}
          disabled={matrixDisabled}
          onChange={(next) =>
            normalized.role === "client"
              ? applyPatch({ allowedViews: next as AccessView[] })
              : applyPatch({ internalPages: next as InternalPage[] })
          }
        />
      ) : null}
    </div>
  );
}

function isProtectedAdmin(user: AdminUserRecord) {
  return user.access.isAdmin || isFixedAdminAccount(user.uid, user.email);
}

function getClientName(clientId: string, clients: LeadClient[]) {
  return clients.find((client) => client.id === clientId)?.name || clientId;
}

function summarizeClientAssignments(clientIds: string[], clients: LeadClient[]) {
  if (clientIds.length === 0) return "Nenhum tenant vinculado";

  const names = clientIds.map((clientId) => getClientName(clientId, clients));
  if (names.length <= 2) return names.join(", ");

  return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
}

function sortByReferenceOrder<T extends string>(items: T[], referenceOrder: readonly T[]) {
  const orderMap = new Map(referenceOrder.map((item, index) => [item, index]));
  return [...items].sort((left, right) => (orderMap.get(left) ?? 999) - (orderMap.get(right) ?? 999));
}

function buildComparablePayload(draft: AccessDraft) {
  const payload = buildPayload(draft);

  return {
    ...payload,
    clientIds: [...payload.clientIds].sort(),
    allowedViews: sortByReferenceOrder(payload.allowedViews, CLIENT_VIEW_ORDER),
    internalPages: sortByReferenceOrder(payload.internalPages, INTERNAL_PAGE_ORDER),
    permissions: sortByReferenceOrder(payload.permissions, ACCESS_PERMISSION_ORDER),
  };
}

function hasDraftChanges(user: AdminUserRecord, draft: UserDraft) {
  return JSON.stringify(buildComparablePayload(buildUserDraft(user))) !== JSON.stringify(buildComparablePayload(draft));
}

function buildSearchIndex(user: AdminUserRecord, draft: UserDraft) {
  return [
    user.email,
    user.displayName,
    draft.companyName,
    draft.accessPreset,
    draft.scopeMode,
    ROLE_LABELS[draft.role],
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

interface UserListItemProps {
  user: AdminUserRecord;
  draft: UserDraft;
  clients: LeadClient[];
  selected: boolean;
  protectedAccount: boolean;
  dirty: boolean;
  onSelect: () => void;
}

function UserListItem({
  user,
  draft,
  clients,
  selected,
  protectedAccount,
  dirty,
  onSelect,
}: UserListItemProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-3xl border p-4 text-left transition-colors",
        selected
          ? "border-primary/30 bg-primary/5 shadow-sm"
          : "border-border/80 bg-background/70 hover:border-primary/20 hover:bg-background"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="truncate text-sm font-medium text-foreground">
            {user.displayName || user.email || "Usuario sem nome"}
          </p>
          <p className="truncate text-xs text-muted-foreground">{user.email || "Sem e-mail"}</p>
        </div>

        <Badge className={protectedAccount ? "bg-primary/10 text-primary" : ROLE_BADGE_CLASS[draft.role]}>
          {protectedAccount ? "Protegido" : ROLE_LABELS[draft.role]}
        </Badge>
      </div>

      {draft.disabled || dirty ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {draft.disabled ? (
            <Badge variant="outline" className="border-amber-500/30 text-amber-600">
              Login desativado
            </Badge>
          ) : null}
          {dirty ? (
            <Badge variant="outline" className="border-primary/30 text-primary">
              Nao salvo
            </Badge>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
        <p>{draft.companyName || "Sem empresa exibida"}</p>
        <p>{summarizeClientAssignments(draft.clientIds, clients)}</p>
      </div>
    </button>
  );
}

export default function UserAccessManagement() {
  const { getIdToken, isAdminUser } = useAuth();
  const { data: users = [], isLoading, error, refetch } = useAdminUsers();
  const { data: clients = [] } = useLeadClients();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, UserDraft>>({});
  const [createDraft, setCreateDraft] = useState<CreateUserDraft>(() => buildCreateDraft());
  const [savingUid, setSavingUid] = useState<string | null>(null);
  const [deletingUid, setDeletingUid] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [createError, setCreateError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [createdPasswordResetLink, setCreatedPasswordResetLink] = useState<string | null>(null);

  const canEditUsers = isAdminUser;

  useEffect(() => {
    setDrafts((current) => {
      if (!users.length) {
        return {};
      }

      const next: Record<string, UserDraft> = {};
      for (const user of users) {
        const existingDraft = current[user.uid];
        next[user.uid] =
          existingDraft && hasDraftChanges(user, existingDraft) ? existingDraft : buildUserDraft(user);
      }
      return next;
    });
  }, [users]);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    const ordered = [...users].sort((a, b) => {
      if (a.access.isAdmin !== b.access.isAdmin) {
        return a.access.isAdmin ? -1 : 1;
      }

      const order: Record<ManagedRole, number> = { pending: 0, client: 1, internal: 2 };
      return order[a.access.role] - order[b.access.role];
    });

    return ordered.filter((user) => {
      const draft = drafts[user.uid] || buildUserDraft(user);
      if (roleFilter !== "all" && draft.role !== roleFilter) return false;
      if (!term) return true;
      return buildSearchIndex(user, draft).includes(term);
    });
  }, [drafts, roleFilter, search, users]);

  useEffect(() => {
    if (!users.length) {
      setSelectedUserId(null);
      return;
    }

    if (selectedUserId && users.some((user) => user.uid === selectedUserId)) {
      return;
    }

    if (filteredUsers.length > 0) {
      setSelectedUserId(filteredUsers[0].uid);
    }
  }, [filteredUsers, selectedUserId, users]);

  const selectedUser = users.find((user) => user.uid === selectedUserId) || null;
  const selectedDraft = selectedUser ? drafts[selectedUser.uid] || buildUserDraft(selectedUser) : null;
  const selectedProtectedAccount = selectedUser ? isProtectedAdmin(selectedUser) : false;
  const selectedEditable = Boolean(selectedUser && canEditUsers && !selectedProtectedAccount);
  const selectedHasChanges = selectedUser && selectedDraft ? hasDraftChanges(selectedUser, selectedDraft) : false;
  const selectedHiddenByFilter = Boolean(
    selectedUser && selectedDraft && !filteredUsers.some((user) => user.uid === selectedUser.uid)
  );

  const updateDraft = (uid: string, patch: Partial<UserDraft>) => {
    setDrafts((current) => {
      const sourceUser = users.find((user) => user.uid === uid);
      if (!sourceUser) {
        return current;
      }

      const merged = {
        ...(current[uid] || buildUserDraft(sourceUser)),
        ...patch,
      };

      const next = patch.role || patch.accessPreset ? transitionDraft(merged) : normalizeDraft(merged);
      return {
        ...current,
        [uid]: next,
      };
    });
  };

  const updateCreateDraft = (patch: Partial<CreateUserDraft>) => {
    setCreateDraft((current) => {
      return normalizeCreateDraftForSimpleForm({
        ...current,
        ...patch,
      });
    });
  };

  const saveUser = async (user: AdminUserRecord) => {
    if (!canEditUsers || isProtectedAdmin(user)) return;

    const draft = drafts[user.uid];
    if (!draft) return;

    const validationError = validateDraft(draft);
    if (validationError) {
      setSaveError(validationError);
      return;
    }

    setSavingUid(user.uid);
    setSaveError("");
    setSaveSuccess("");

    try {
      const token = await getIdToken();
      if (!token) {
        throw new Error("Usuario nao autenticado.");
      }

      const payload = buildPayload(draft);

      const res = await fetch(`${API_BASE_URL}/api/admin/users/${encodeURIComponent(user.uid)}/access`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.error?.message || body?.error?.details || "Nao foi possivel salvar este usuario.");
      }

      setSaveSuccess(`Acessos atualizados para ${user.email || user.uid}.`);
      setDrafts((current) => ({
        ...current,
        [user.uid]: buildUserDraft(body.item || user),
      }));
      await refetch();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Nao foi possivel salvar este usuario.");
    } finally {
      setSavingUid(null);
    }
  };

  const createUser = async () => {
    if (!canEditUsers) return;

    const preparedDraft = normalizeCreateDraftForSimpleForm(createDraft);
    const validationError = validateDraft(preparedDraft);
    if (validationError) {
      setCreateError(validationError);
      return;
    }

    setCreating(true);
    setCreateError("");
    setCreateSuccess("");
    setCreatedPasswordResetLink(null);

    try {
      const token = await getIdToken();
      if (!token) {
        throw new Error("Usuario nao autenticado.");
      }

      const payload = {
        ...buildPayload(preparedDraft),
        email: preparedDraft.email.trim().toLowerCase(),
        password: preparedDraft.password,
        displayName: preparedDraft.displayName.trim() || undefined,
        sendPasswordReset: preparedDraft.sendPasswordReset,
      };

      const res = await fetch(`${API_BASE_URL}/api/admin/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.error?.message || body?.error?.details || "Nao foi possivel criar este usuario.");
      }

      setCreateSuccess(`Usuario ${body.item?.email || payload.email} criado com sucesso.`);
      setCreatedPasswordResetLink(body.passwordResetLink || null);
      setCreateDraft(buildCreateDraft());
      await refetch();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Nao foi possivel criar este usuario.");
    } finally {
      setCreating(false);
    }
  };

  const deleteUser = async (user: AdminUserRecord) => {
    if (!canEditUsers || isProtectedAdmin(user)) return;

    const label = user.displayName || user.email || user.uid;
    const confirmMessage = selectedHasChanges
      ? `Apagar ${label}? As alteracoes nao salvas tambem serao perdidas.`
      : `Apagar ${label}? Essa acao nao pode ser desfeita.`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setDeletingUid(user.uid);
    setSaveError("");
    setSaveSuccess("");

    try {
      const token = await getIdToken();
      if (!token) {
        throw new Error("Usuario nao autenticado.");
      }

      const res = await fetch(`${API_BASE_URL}/api/admin/users/${encodeURIComponent(user.uid)}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.error?.message || body?.error?.details || "Nao foi possivel apagar este usuario.");
      }

      setSaveSuccess(`Usuario ${user.email || user.uid} apagado com sucesso.`);
      setDrafts((current) => {
        const next = { ...current };
        delete next[user.uid];
        return next;
      });
      setSelectedUserId((current) => (current === user.uid ? null : current));
      await refetch();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Nao foi possivel apagar este usuario.");
    } finally {
      setDeletingUid(null);
    }
  };

  return (
    <PageShell
      title="Usuarios e Acessos"
      subtitle="Cadastro e associacao por tipo, empresa e paginas liberadas."
      headerRight={
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-[260px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome, e-mail ou empresa"
              className="pl-9"
            />
          </div>

          <Select value={roleFilter} onValueChange={(value: RoleFilter) => setRoleFilter(value)}>
            <SelectTrigger className="min-w-[180px]">
              <SelectValue placeholder="Filtrar perfil" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os perfis</SelectItem>
              <SelectItem value="internal">Interno</SelectItem>
              <SelectItem value="client">Cliente</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
            </SelectContent>
          </Select>
        </div>
      }
      spacing="space-y-6"
    >
      {!canEditUsers && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-700">
          Seu acesso esta em modo leitura. Apenas administradores podem criar ou alterar permissoes.
        </div>
      )}

      <ErrorMessage message={error ? (error as Error).message : null} variant="dashboard" />
      <ErrorMessage message={saveError} variant="banner" />
      <ErrorMessage message={createError} variant="banner" />

      {saveSuccess ? (
        <div className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
          {saveSuccess}
        </div>
      ) : null}

      {createSuccess ? (
        <div className="space-y-2 rounded-2xl border border-[#1A5CFF]/20 bg-[#1A5CFF]/10 px-4 py-3 text-sm text-[#1A5CFF]">
          <p>{createSuccess}</p>
          {createdPasswordResetLink ? <p className="break-all text-xs opacity-90">Link de redefinicao: {createdPasswordResetLink}</p> : null}
        </div>
      ) : null}

      {canEditUsers && (
        <Card className="border-border/80">
          <CardHeader className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Plus className="h-4 w-4 text-primary" />
              Novo usuario
            </CardTitle>
            <CardDescription>Defina os dados basicos, a empresa e as paginas liberadas.</CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-5">
              <Input
                value={createDraft.email}
                onChange={(event) => updateCreateDraft({ email: event.target.value })}
                placeholder="E-mail do usuario"
                type="email"
              />
              <Input
                value={createDraft.password}
                onChange={(event) => updateCreateDraft({ password: event.target.value })}
                placeholder="Senha inicial"
                type="password"
              />
              <Input
                value={createDraft.displayName}
                onChange={(event) => updateCreateDraft({ displayName: event.target.value })}
                placeholder="Nome de exibicao"
              />
              <Select
                value={createDraft.role}
                onValueChange={(value: "internal" | "client") => updateCreateDraft({ role: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tipo de usuario" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">Interno</SelectItem>
                  <SelectItem value="client">Cliente</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={createDraft.clientIds[0] || "__none"}
                onValueChange={(value) => {
                  const selectedClient = clients.find((client) => client.id === value);
                  updateCreateDraft({
                    clientIds: value === "__none" ? [] : [value],
                    companyName: value === "__none" ? "" : selectedClient?.name || "",
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Empresa / tenant" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">
                    {createDraft.role === "client" ? "Selecionar empresa" : "Sem empresa vinculada"}
                  </SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <label className="flex items-center gap-3 text-sm text-muted-foreground">
              <Checkbox
                checked={createDraft.sendPasswordReset}
                onCheckedChange={(checked) => updateCreateDraft({ sendPasswordReset: checked === true })}
              />
              Enviar e-mail de redefinicao de senha apos o cadastro
            </label>

            <AccessPagesTabs
              role={createDraft.role}
              selected={createDraft.role === "client" ? createDraft.allowedViews : createDraft.internalPages}
              disabled={!canEditUsers}
              onChange={(next) =>
                createDraft.role === "client"
                  ? updateCreateDraft({ allowedViews: next as AccessView[] })
                  : updateCreateDraft({ internalPages: next as InternalPage[] })
              }
            />

            <div className="flex justify-end">
              <Button onClick={createUser} disabled={creating}>
                <UserRound className="h-4 w-4" />
                {creating ? "Criando..." : "Criar usuario"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading && <EmptyState message="Carregando usuarios..." />}

      {!isLoading && filteredUsers.length === 0 && (
        <EmptyState
          title="Nenhum usuario encontrado"
          description="Ajuste a busca, troque o filtro de perfil ou cadastre um novo usuario."
        />
      )}

      {!isLoading && filteredUsers.length > 0 ? (
        <Card className="border-border/80">
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <CardTitle className="text-xl">Associacoes e acessos</CardTitle>
                <CardDescription>Edite um usuario por vez com o mesmo fluxo simples do cadastro.</CardDescription>
              </div>
              <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
                {filteredUsers.length} usuarios visiveis
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="grid gap-5 xl:grid-cols-[340px_1fr]">
            <div className="space-y-4">
              <ScrollArea className="h-[720px] pr-3">
                <div className="space-y-3">
                  {filteredUsers.map((user) => {
                    const draft = drafts[user.uid] || buildUserDraft(user);

                    return (
                      <UserListItem
                        key={user.uid}
                        user={user}
                        draft={draft}
                        clients={clients}
                        protectedAccount={isProtectedAdmin(user)}
                        dirty={hasDraftChanges(user, draft)}
                        selected={selectedUserId === user.uid}
                        onSelect={() => setSelectedUserId(user.uid)}
                      />
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            <div>
              {selectedUser && selectedDraft ? (
                <Card className="border-border/80 bg-background/70">
                  <CardHeader className="space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle className="text-xl">
                            {selectedUser.displayName || selectedUser.email || "Usuario sem nome"}
                          </CardTitle>
                          {selectedProtectedAccount ? (
                            <Badge className="gap-1 bg-primary/10 text-primary">
                              <LockKeyhole className="h-3.5 w-3.5" />
                              Admin protegido
                            </Badge>
                          ) : (
                            <Badge className={ROLE_BADGE_CLASS[selectedDraft.role]}>{ROLE_LABELS[selectedDraft.role]}</Badge>
                          )}
                          {selectedHasChanges ? (
                            <Badge variant="outline" className="border-primary/30 text-primary">
                              Alteracoes nao salvas
                            </Badge>
                          ) : null}
                        </div>
                        <CardDescription className="text-sm">
                          {selectedUser.email || "Sem e-mail"} - UID {selectedUser.uid}
                        </CardDescription>
                        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                          <span>Criado em {formatDate(selectedUser.createdAt)}</span>
                          <span>Ultimo login {formatDate(selectedUser.lastSignInAt)}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap justify-end gap-3">
                        <Button
                          variant="outline"
                          onClick={() => updateDraft(selectedUser.uid, buildUserDraft(selectedUser))}
                          disabled={!selectedEditable || savingUid === selectedUser.uid || deletingUid === selectedUser.uid}
                        >
                          Restaurar
                        </Button>
                        <Button
                          onClick={() => saveUser(selectedUser)}
                          disabled={!selectedEditable || savingUid === selectedUser.uid || deletingUid === selectedUser.uid}
                        >
                          <ShieldCheck className="h-4 w-4" />
                          {savingUid === selectedUser.uid ? "Salvando..." : "Salvar acessos"}
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => deleteUser(selectedUser)}
                          disabled={!selectedEditable || savingUid === selectedUser.uid || deletingUid === selectedUser.uid}
                        >
                          <Trash2 className="h-4 w-4" />
                          {deletingUid === selectedUser.uid ? "Apagando..." : "Apagar usuario"}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-5">
                    {selectedHiddenByFilter ? (
                      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-700">
                        O usuario selecionado nao aparece na lista atual por causa da busca ou do filtro ativo, mas permanece aberto para evitar troca silenciosa de contexto.
                      </div>
                    ) : null}

                    <div className="rounded-3xl border border-border/80 bg-background/50 p-4">
                      {selectedProtectedAccount ? (
                        <div className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-4 text-sm text-primary">
                          Esta conta esta protegida por allowlist fixa de admin. A tela permanece apenas como leitura para preservar o acesso raiz do ambiente.
                        </div>
                      ) : (
                        <AccessGovernance
                          draft={selectedDraft}
                          clients={clients}
                          editable={selectedEditable}
                          onChange={(patch) => updateDraft(selectedUser.uid, patch)}
                        />
                      )}
                    </div>

                    <label className="flex items-center gap-3 rounded-3xl border border-border/80 bg-background/60 px-4 py-3 text-sm text-muted-foreground">
                      <Checkbox
                        checked={selectedDraft.disabled}
                        disabled={!selectedEditable}
                        onCheckedChange={(checked) => updateDraft(selectedUser.uid, { disabled: checked === true })}
                      />
                      Desativar login deste usuario
                    </label>
                  </CardContent>
                </Card>
              ) : (
                <EmptyState
                  title="Selecione um usuario"
                  description="Escolha um registro na coluna da esquerda para editar suas associacoes."
                />
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </PageShell>
  );
}
