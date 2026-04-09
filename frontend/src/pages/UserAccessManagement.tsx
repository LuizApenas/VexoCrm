import { useEffect, useMemo, useState } from "react";
import {
  KeyRound,
  LockKeyhole,
  Plus,
  Search,
  ShieldCheck,
  UserRound,
  Workflow,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
  ACCESS_PERMISSION_DEFINITIONS,
  ACCESS_PERMISSION_ORDER,
  ACCESS_PRESET_LABELS,
  ACCESS_SCOPE_LABELS,
  APPROVAL_LEVEL_LABELS,
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

const DEFAULT_INTERNAL_PAGES: InternalPage[] = ["dashboard"];

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
  const defaults = buildPresetDefaults("internal_operator");

  return {
    email: "",
    password: "",
    displayName: "",
    role: "internal",
    accessPreset: "internal_operator",
    scopeMode: defaults.scopeMode,
    approvalLevel: defaults.approvalLevel,
    companyName: "",
    clientIds: [],
    allowedViews: [...defaults.allowedViews],
    internalPages: [...DEFAULT_INTERNAL_PAGES],
    permissions: [...defaults.permissions],
    sendPasswordReset: false,
    disabled: false,
  };
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

function syncInternalCampaignAccess<T extends AccessDraft>(draft: T): T {
  if (draft.role !== "internal") {
    return draft;
  }

  const hasCampaignPage = draft.internalPages.includes("campanhas");
  const hasCampaignPermission = draft.permissions.includes("campaigns.manage");

  if (!hasCampaignPage && !hasCampaignPermission) {
    return draft;
  }

  return {
    ...draft,
    internalPages: hasCampaignPermission
      ? toggleItem(draft.internalPages, "campanhas" as InternalPage, true)
      : draft.internalPages,
    permissions: hasCampaignPage
      ? toggleItem(draft.permissions, "campaigns.manage" as AccessPermission, true)
      : draft.permissions,
  };
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

  const synchronizedDraft = syncInternalCampaignAccess(draft);
  const clientIds = Array.from(new Set(synchronizedDraft.clientIds.map((value) => value.trim()).filter(Boolean)));
  const allowedViews = role === "client" ? filterArray(synchronizedDraft.allowedViews, CLIENT_VIEW_ORDER) : [];
  const internalPages = role === "internal" ? filterArray(synchronizedDraft.internalPages, INTERNAL_PAGE_ORDER) : [];
  const permissions = filterArray(synchronizedDraft.permissions, ROLE_PERMISSIONS[role]);

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
  onToggle: (item: string, checked: boolean) => void;
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
  onToggle,
  renderLabel,
  renderHint,
}: ChecklistPanelProps) {
  return (
    <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
          {selected.length}
        </Badge>
      </div>

      <Separator className="my-4" />

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <ScrollArea className="h-64 pr-3">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <label
                key={item}
                className={cn(
                  "flex items-start gap-3 rounded-xl border border-border/70 bg-background/70 px-3 py-3 text-sm transition-colors",
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

interface AccessGovernanceProps {
  draft: AccessDraft;
  clients: LeadClient[];
  editable: boolean;
  onChange: (patch: Partial<AccessDraft>) => void;
}

function AccessGovernance({ draft, clients, editable, onChange }: AccessGovernanceProps) {
  const matrixDisabled = !editable || draft.role === "pending";

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Preset de acesso</p>
          <Select
            value={draft.accessPreset}
            disabled={!editable}
            onValueChange={(value: AccessPreset) => onChange({ accessPreset: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecionar preset" />
            </SelectTrigger>
            <SelectContent>
              {ROLE_PRESETS[draft.role].map((preset) => (
                <SelectItem key={preset} value={preset}>
                  {ACCESS_PRESET_LABELS[preset]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Role base</p>
          <Select
            value={draft.role}
            disabled={!editable}
            onValueChange={(value: ManagedRole) => onChange({ role: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecionar perfil" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="internal">Interno</SelectItem>
              <SelectItem value="client">Cliente</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Escopo operacional</p>
          <Select
            value={draft.scopeMode}
            disabled={!editable}
            onValueChange={(value: AccessScope) => onChange({ scopeMode: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecionar escopo" />
            </SelectTrigger>
            <SelectContent>
              {ROLE_SCOPES[draft.role].map((scope) => (
                <SelectItem key={scope} value={scope}>
                  {ACCESS_SCOPE_LABELS[scope]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Alcada</p>
          <Select
            value={draft.approvalLevel}
            disabled={!editable}
            onValueChange={(value: ApprovalLevel) => onChange({ approvalLevel: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecionar alcada" />
            </SelectTrigger>
            <SelectContent>
              {ROLE_APPROVAL_LEVELS[draft.role].map((level) => (
                <SelectItem key={level} value={level}>
                  {APPROVAL_LEVEL_LABELS[level]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge className={ROLE_BADGE_CLASS[draft.role]}>{ROLE_LABELS[draft.role]}</Badge>
        <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
          {ACCESS_PRESET_LABELS[draft.accessPreset]}
        </Badge>
        <Badge variant="outline">{ACCESS_SCOPE_LABELS[draft.scopeMode]}</Badge>
        <Badge variant="outline">{APPROVAL_LEVEL_LABELS[draft.approvalLevel]}</Badge>
        <Badge variant="outline">{draft.permissions.length} permissoes</Badge>
        <Badge variant="outline">{draft.clientIds.length} tenants</Badge>
      </div>

      <Tabs defaultValue="tenants" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="tenants">Tenants</TabsTrigger>
          <TabsTrigger value="views">Views</TabsTrigger>
          <TabsTrigger value="pages">Paginas</TabsTrigger>
          <TabsTrigger value="permissions">Permissoes</TabsTrigger>
        </TabsList>

        <TabsContent value="tenants" className="mt-4">
          <ChecklistPanel
            title="Vinculacao de tenants"
            description="Escolha os clientes/tenants que este usuario pode enxergar ou operar."
            items={clients.map((client) => client.id)}
            selected={draft.clientIds}
            disabled={matrixDisabled}
            emptyMessage="Nenhum tenant cadastrado em `leads_clients`."
            onToggle={(item, checked) =>
              onChange({
                clientIds: toggleItem(draft.clientIds, item, checked),
              })
            }
            renderLabel={(item) => clients.find((client) => client.id === item)?.name || item}
          />
        </TabsContent>

        <TabsContent value="views" className="mt-4">
          <ChecklistPanel
            title="Views do portal"
            description="Controla o que o usuario cliente pode visualizar."
            items={CLIENT_VIEW_ORDER}
            selected={draft.allowedViews}
            disabled={matrixDisabled || draft.role !== "client"}
            emptyMessage="Views do cliente nao aplicam para usuarios internos."
            onToggle={(item, checked) =>
              onChange({
                allowedViews: toggleItem(draft.allowedViews, item as AccessView, checked),
              })
            }
            renderLabel={(item) => item}
            renderHint={(item) => {
              if (item === "whatsapp") return "Libera o inbox do cliente";
              if (item === "planilhas") return "Libera importacoes e historico";
              return null;
            }}
          />
        </TabsContent>

        <TabsContent value="pages" className="mt-4">
          <ChecklistPanel
            title="Paginas internas"
            description="Define os modulos do CRM liberados para o usuario interno."
            items={INTERNAL_PAGE_ORDER}
            selected={draft.internalPages}
            disabled={matrixDisabled || draft.role !== "internal"}
            emptyMessage="Paginas internas nao aplicam para usuarios cliente."
            onToggle={(item, checked) =>
              onChange({
                internalPages: toggleItem(draft.internalPages, item as InternalPage, checked),
              })
            }
            renderLabel={(item) => item}
            renderHint={(item) => {
              if (item === "usuarios") return "Painel de governanca";
              if (item === "agente") return "Monitoramento e alertas";
              if (item === "campanhas") return "Execucao e disparo";
              return null;
            }}
          />
        </TabsContent>

        <TabsContent value="permissions" className="mt-4">
          <ChecklistPanel
            title="Permissoes granulares"
            description="Cada permissao se comporta como uma alavanca operacional."
            items={ROLE_PERMISSIONS[draft.role]}
            selected={draft.permissions}
            disabled={matrixDisabled}
            emptyMessage="Usuarios pendentes nao recebem permissoes operacionais."
            onToggle={(item, checked) =>
              onChange({
                permissions: toggleItem(draft.permissions, item as AccessPermission, checked),
              })
            }
            renderLabel={(item) => ACCESS_PERMISSION_DEFINITIONS[item as AccessPermission].label}
            renderHint={(item) => ACCESS_PERMISSION_DEFINITIONS[item as AccessPermission].description}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function isProtectedAdmin(user: AdminUserRecord) {
  return user.access.isAdmin || isFixedAdminAccount(user.uid, user.email);
}

export default function UserAccessManagement() {
  const { getIdToken, isAdminUser } = useAuth();
  const { data: users = [], isLoading, error, refetch } = useAdminUsers();
  const { data: clients = [] } = useLeadClients();
  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState<Record<string, UserDraft>>({});
  const [createDraft, setCreateDraft] = useState<CreateUserDraft>(() => buildCreateDraft());
  const [savingUid, setSavingUid] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [createError, setCreateError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [createdPasswordResetLink, setCreatedPasswordResetLink] = useState<string | null>(null);

  const canEditUsers = isAdminUser;

  useEffect(() => {
    if (!users.length) return;

    setDrafts((current) => {
      const next = { ...current };
      for (const user of users) {
        next[user.uid] = current[user.uid] || buildUserDraft(user);
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

    if (!term) return ordered;

    return ordered.filter((user) =>
      [user.email, user.displayName, user.access.companyName, user.access.accessPreset, user.access.scopeMode]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [search, users]);

  const stats = useMemo(
    () => ({
      total: users.length,
      pending: users.filter((user) => user.access.role === "pending").length,
      clients: clients.length,
      admins: users.filter((user) => user.access.isAdmin).length,
      scoped: users.filter((user) => user.access.scopeMode === "assigned_clients").length,
    }),
    [clients.length, users]
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
      const merged = {
        ...current,
        ...patch,
      };
      return patch.role || patch.accessPreset ? transitionDraft(merged) : normalizeDraft(merged);
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

    const validationError = validateDraft(createDraft);
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
        ...buildPayload(createDraft),
        email: createDraft.email.trim().toLowerCase(),
        password: createDraft.password,
        displayName: createDraft.displayName.trim() || undefined,
        sendPasswordReset: createDraft.sendPasswordReset,
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

  return (
    <PageShell
      title="Usuarios e Acessos"
      subtitle="Governanca de acesso, alcadas e tenants para o CRM multi-tenant."
      headerRight={
        <div className="relative min-w-[260px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, e-mail, preset ou empresa"
            className="pl-9"
          />
        </div>
      }
      spacing="space-y-6"
    >
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total de usuarios</CardDescription>
            <CardTitle className="text-3xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Pendentes</CardDescription>
            <CardTitle className="text-3xl">{stats.pending}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Tenants cadastrados</CardDescription>
            <CardTitle className="text-3xl">{stats.clients}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Admins protegidos</CardDescription>
            <CardTitle className="text-3xl">{stats.admins}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Com escopo vinculado</CardDescription>
            <CardTitle className="text-3xl">{stats.scoped}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {!canEditUsers && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-600">
          Seu acesso esta em modo leitura. Apenas administradores podem criar ou alterar permissoes.
        </div>
      )}

      <ErrorMessage message={error ? (error as Error).message : null} variant="dashboard" />
      <ErrorMessage message={saveError} variant="banner" />
      <ErrorMessage message={createError} variant="banner" />

      {saveSuccess ? (
        <div className="rounded-lg border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
          {saveSuccess}
        </div>
      ) : null}

      {createSuccess ? (
        <div className="space-y-2 rounded-lg border border-[#1A5CFF]/20 bg-[#1A5CFF]/10 px-4 py-3 text-sm text-[#1A5CFF]">
          <p>{createSuccess}</p>
          {createdPasswordResetLink ? (
            <p className="break-all text-xs opacity-90">
              Link de redefinicao: {createdPasswordResetLink}
            </p>
          ) : null}
        </div>
      ) : null}

      {canEditUsers && (
        <Card className="border-border/80">
          <CardHeader className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-xl">Cadastrar novo usuario</CardTitle>
              <Badge variant="outline" className="gap-1 border-primary/30 bg-primary/5 text-primary">
                <Plus className="h-3.5 w-3.5" />
                Painel
              </Badge>
            </div>
            <CardDescription>
              Crie acessos internos ou de cliente sem sair do CRM.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="grid gap-4 lg:grid-cols-2">
              <Input
                value={createDraft.email}
                onChange={(e) => updateCreateDraft({ email: e.target.value })}
                placeholder="E-mail do usuario"
                type="email"
              />
              <Input
                value={createDraft.password}
                onChange={(e) => updateCreateDraft({ password: e.target.value })}
                placeholder="Senha inicial"
                type="password"
              />
              <Input
                value={createDraft.displayName}
                onChange={(e) => updateCreateDraft({ displayName: e.target.value })}
                placeholder="Nome de exibicao"
              />
              <Input
                value={createDraft.companyName}
                onChange={(e) => updateCreateDraft({ companyName: e.target.value })}
                placeholder="Empresa exibida"
              />
            </div>

            <label className="flex items-center gap-3 text-sm text-muted-foreground">
              <Checkbox
                checked={createDraft.sendPasswordReset}
                onCheckedChange={(checked) => updateCreateDraft({ sendPasswordReset: checked === true })}
              />
              Enviar e-mail de redefinicao de senha
            </label>

            <Separator />

            <AccessGovernance draft={createDraft} clients={clients} editable={canEditUsers} onChange={updateCreateDraft} />

            <div className="flex flex-wrap justify-end gap-3">
              <div className="flex items-center gap-2 rounded-full border border-border/70 px-3 py-2 text-xs text-muted-foreground">
                <KeyRound className="h-4 w-4 text-primary" />
                Preset define defaults, mas voce pode ajustar manualmente.
              </div>
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
          description="Ajuste a busca ou cadastre um novo usuario pelo painel."
        />
      )}

      <div className="space-y-4">
        {filteredUsers.map((user) => {
          const draft = drafts[user.uid] || buildUserDraft(user);
          const protectedAccount = isProtectedAdmin(user);
          const editable = canEditUsers && !protectedAccount;

          return (
            <Card key={user.uid} className="border-border/80">
              <CardHeader className="space-y-4 pb-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-lg">
                        {user.displayName || user.email || "Usuario sem nome"}
                      </CardTitle>
                      {protectedAccount ? (
                        <Badge className="gap-1 bg-primary/10 text-primary">
                          <LockKeyhole className="h-3.5 w-3.5" />
                          Admin protegido
                        </Badge>
                      ) : (
                        <Badge className={ROLE_BADGE_CLASS[user.access.role]}>{ROLE_LABELS[user.access.role]}</Badge>
                      )}
                    </div>
                    <CardDescription className="text-sm">
                      {user.email || "Sem e-mail"} · UID {user.uid}
                    </CardDescription>
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                      <span>Criado em {formatDate(user.createdAt)}</span>
                      <span>Ultimo login {formatDate(user.lastSignInAt)}</span>
                    </div>
                  </div>

                  <div className="min-w-[220px] space-y-3">
                    {editable ? (
                      <Select
                        value={draft.role}
                        onValueChange={(value: ManagedRole) => updateDraft(user.uid, { role: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecionar perfil" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pendente</SelectItem>
                          <SelectItem value="client">Cliente</SelectItem>
                          <SelectItem value="internal">Interno</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="rounded-md border border-border/80 bg-secondary/60 px-3 py-2 text-sm text-muted-foreground">
                        {protectedAccount ? "Conta protegida" : ROLE_LABELS[user.access.role]}
                      </div>
                    )}

                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Checkbox
                        checked={draft.disabled}
                        disabled={!editable}
                        onCheckedChange={(checked) => updateDraft(user.uid, { disabled: checked === true })}
                      />
                      Desativar login
                    </label>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-5">
                <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">Empresa exibida</p>
                    <Input
                      value={draft.companyName}
                      onChange={(e) => updateDraft(user.uid, { companyName: e.target.value })}
                      disabled={!editable}
                      placeholder="Nome da empresa para identificacao"
                    />
                  </div>

                  <div className="rounded-xl border border-border/80 bg-background/40 px-4 py-3 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">Resumo operacional</p>
                    {protectedAccount ? (
                      <p className="mt-1 leading-6">
                        Esta conta esta protegida por allowlist fixa de admin. Nao e possivel alterar
                        permissao, pagina ou status por esta tela.
                      </p>
                    ) : draft.role === "internal" ? (
                      <p className="mt-1 leading-6">
                        Usuarios internos operam com alcada, escopo e tenants vinculados. O preset serve como
                        atalho, nao como muleta.
                      </p>
                    ) : draft.role === "client" ? (
                      <p className="mt-1 leading-6">
                        Usuarios cliente precisam de tenants, views e permissoes coerentes com o preset.
                      </p>
                    ) : (
                      <p className="mt-1 leading-6">
                        Usuarios pendentes ainda nao acessam modulos operacionais.
                      </p>
                    )}
                  </div>
                </div>

                {!protectedAccount ? (
                  <AccessGovernance draft={draft} clients={clients} editable={editable} onChange={(patch) => updateDraft(user.uid, patch)} />
                ) : null}

                <div className="flex flex-wrap justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() => updateDraft(user.uid, buildUserDraft(user))}
                    disabled={!editable || savingUid === user.uid}
                  >
                    Restaurar
                  </Button>
                  <Button onClick={() => saveUser(user)} disabled={!editable || savingUid === user.uid}>
                    <ShieldCheck className="h-4 w-4" />
                    {savingUid === user.uid ? "Salvando..." : "Salvar acessos"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="rounded-2xl border border-primary/10 bg-primary/5 px-4 py-3 text-xs text-muted-foreground">
        <div className="flex items-start gap-2">
          <Workflow className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p>
            Tenants aqui correspondem aos registros em <span className="font-mono">leads_clients</span>. O
            preset organiza acesso, alcada e permissao sem perder compatibilidade com o backend atual.
          </p>
        </div>
      </div>
    </PageShell>
  );
}
