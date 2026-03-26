import { useEffect, useMemo, useState } from "react";
import { LockKeyhole, Plus, Search, ShieldCheck, UserRound } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import { ErrorMessage } from "@/components/ErrorMessage";
import { PageShell } from "@/components/PageShell";
import { useLeadClients } from "@/hooks/useLeadClients";
import { type AdminUserRecord, useAdminUsers } from "@/hooks/useAdminUsers";
import { API_BASE_URL } from "@/lib/api";
import {
  CLIENT_VIEW_ORDER,
  INTERNAL_PAGE_ORDER,
  isFixedAdminAccount,
  type AccessView,
  type InternalPage,
} from "@/lib/access";
import { useAuth } from "@/contexts/AuthContext";

type ManagedRole = "internal" | "client" | "pending";

interface UserDraft {
  role: ManagedRole;
  companyName: string;
  clientIds: string[];
  allowedViews: AccessView[];
  internalPages: InternalPage[];
  disabled: boolean;
}

interface CreateUserDraft {
  email: string;
  password: string;
  displayName: string;
  role: ManagedRole;
  companyName: string;
  clientIds: string[];
  allowedViews: AccessView[];
  internalPages: InternalPage[];
  sendPasswordReset: boolean;
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

function buildUserDraft(user: AdminUserRecord): UserDraft {
  const internalPages = user.access.internalPages?.length
    ? user.access.internalPages
    : user.access.isAdmin
      ? [...INTERNAL_PAGE_ORDER]
      : [];

  return {
    role: user.access.role,
    companyName: user.access.companyName || "",
    clientIds: user.access.clientIds || [],
    allowedViews: user.access.allowedViews?.length ? user.access.allowedViews : [...CLIENT_VIEW_ORDER],
    internalPages,
    disabled: user.disabled,
  };
}

function buildCreateDraft(): CreateUserDraft {
  return {
    email: "",
    password: "",
    displayName: "",
    role: "internal",
    companyName: "",
    clientIds: [],
    allowedViews: [...CLIENT_VIEW_ORDER],
    internalPages: [...DEFAULT_INTERNAL_PAGES],
    sendPasswordReset: false,
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

function ensureRoleDefaults(draft: CreateUserDraft | UserDraft, role: ManagedRole) {
  if (role === "client") {
    return {
      ...draft,
      role,
      internalPages: [],
      allowedViews: draft.allowedViews.length ? draft.allowedViews : [...CLIENT_VIEW_ORDER],
    };
  }

  if (role === "internal") {
    return {
      ...draft,
      role,
      clientIds: [],
      allowedViews: [],
      internalPages: draft.internalPages.length ? draft.internalPages : [...DEFAULT_INTERNAL_PAGES],
    };
  }

  return {
    ...draft,
    role,
    clientIds: [],
    allowedViews: [],
    internalPages: [],
  };
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
      [user.email, user.displayName, user.access.companyName]
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
    }),
    [clients.length, users]
  );

  const updateDraft = (uid: string, patch: Partial<UserDraft>) => {
    setDrafts((current) => {
      const sourceUser = users.find((user) => user.uid === uid);
      if (!sourceUser) {
        return current;
      }

      const nextRole = patch.role || current[uid]?.role || "pending";
      const merged = {
        ...(current[uid] || buildUserDraft(sourceUser)),
        ...patch,
      };
      return {
        ...current,
        [uid]: ensureRoleDefaults(merged, nextRole),
      };
    });
  };

  const updateCreateDraft = (patch: Partial<CreateUserDraft>) => {
    setCreateDraft((current) => {
      const nextRole = patch.role || current.role;
      const merged = {
        ...current,
        ...patch,
      };
      return ensureRoleDefaults(merged, nextRole);
    });
  };

  const saveUser = async (user: AdminUserRecord) => {
    if (!canEditUsers || isProtectedAdmin(user)) return;

    const draft = drafts[user.uid];
    if (!draft) return;

    setSavingUid(user.uid);
    setSaveError("");
    setSaveSuccess("");

    try {
      const token = await getIdToken();
      if (!token) {
        throw new Error("Usuario nao autenticado.");
      }

      const payload = {
        role: draft.role,
        companyName: draft.companyName,
        clientIds: draft.role === "client" ? draft.clientIds : [],
        allowedViews: draft.role === "client" ? draft.allowedViews : [],
        internalPages: draft.role === "internal" ? draft.internalPages : [],
        disabled: draft.disabled,
      };

      if (draft.role === "client" && payload.clientIds.length === 0) {
        throw new Error("Selecione ao menos um cliente para este usuario.");
      }

      if (draft.role === "internal" && payload.internalPages.length === 0) {
        throw new Error("Selecione ao menos uma pagina interna para este usuario.");
      }

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

    setCreating(true);
    setCreateError("");
    setCreateSuccess("");

    try {
      if (!createDraft.email.trim() || !createDraft.password.trim()) {
        throw new Error("Informe e-mail e senha para criar o usuario.");
      }

      if (createDraft.role === "client" && createDraft.clientIds.length === 0) {
        throw new Error("Selecione ao menos um cliente para o usuario cliente.");
      }

      if (createDraft.role === "internal" && createDraft.internalPages.length === 0) {
        throw new Error("Selecione ao menos uma pagina para o usuario interno.");
      }

      const token = await getIdToken();
      if (!token) {
        throw new Error("Usuario nao autenticado.");
      }

      const payload = {
        email: createDraft.email.trim().toLowerCase(),
        password: createDraft.password,
        displayName: createDraft.displayName.trim() || undefined,
        role: createDraft.role,
        companyName: createDraft.companyName.trim() || undefined,
        clientIds: createDraft.role === "client" ? createDraft.clientIds : [],
        allowedViews: createDraft.role === "client" ? createDraft.allowedViews : [],
        internalPages: createDraft.role === "internal" ? createDraft.internalPages : [],
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
      subtitle="Associe usuarios aos clientes, paginas internas e perfis da plataforma."
      headerRight={
        <div className="relative min-w-[260px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, e-mail ou empresa"
            className="pl-9"
          />
        </div>
      }
      spacing="space-y-6"
    >
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total de usuarios</CardDescription>
            <CardTitle className="text-3xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Clientes pendentes</CardDescription>
            <CardTitle className="text-3xl">{stats.pending}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Clientes cadastrados</CardDescription>
            <CardTitle className="text-3xl">{stats.clients}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Admins protegidos</CardDescription>
            <CardTitle className="text-3xl">{stats.admins}</CardTitle>
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
        <div className="rounded-lg border border-[#1A5CFF]/20 bg-[#1A5CFF]/10 px-4 py-3 text-sm text-[#1A5CFF]">
          {createSuccess}
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
              <Select
                value={createDraft.role}
                onValueChange={(value: ManagedRole) => updateCreateDraft({ role: value })}
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

            <Input
              value={createDraft.companyName}
              onChange={(e) => updateCreateDraft({ companyName: e.target.value })}
              placeholder="Empresa exibida"
            />

            {createDraft.role === "internal" && (
              <div className="rounded-xl border border-border/80 p-4">
                <p className="text-sm font-medium text-foreground">Paginas internas liberadas</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Escolha quais paginas este usuario podera acessar no CRM.
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {INTERNAL_PAGE_ORDER.map((page) => (
                    <label key={page} className="flex items-center gap-3 text-sm">
                      <Checkbox
                        checked={createDraft.internalPages.includes(page)}
                        onCheckedChange={(checked) =>
                          updateCreateDraft({
                            internalPages: toggleItem(createDraft.internalPages, page, checked === true),
                          })
                        }
                      />
                      <span className="capitalize text-foreground">{page}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {createDraft.role === "client" && (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-border/80 p-4">
                  <p className="text-sm font-medium text-foreground">Clientes associados</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Selecione uma ou mais unidades para este usuario.
                  </p>
                  <div className="mt-4 grid gap-3">
                    {clients.map((client) => (
                      <label key={client.id} className="flex items-center gap-3 text-sm">
                        <Checkbox
                          checked={createDraft.clientIds.includes(client.id)}
                          onCheckedChange={(checked) =>
                            updateCreateDraft({
                              clientIds: toggleItem(createDraft.clientIds, client.id, checked === true),
                            })
                          }
                        />
                        <span>{client.name}</span>
                      </label>
                    ))}
                    {!clients.length && (
                      <p className="text-sm text-muted-foreground">
                        Nenhum cliente cadastrado em `leads_clients`.
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-border/80 p-4">
                  <p className="text-sm font-medium text-foreground">Views liberadas</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Controle o que este usuario cliente pode visualizar.
                  </p>
                  <div className="mt-4 grid gap-3">
                    {CLIENT_VIEW_ORDER.map((view) => (
                      <label key={view} className="flex items-center gap-3 text-sm">
                        <Checkbox
                          checked={createDraft.allowedViews.includes(view)}
                          onCheckedChange={(checked) =>
                            updateCreateDraft({
                              allowedViews: toggleItem(createDraft.allowedViews, view, checked === true),
                            })
                          }
                        />
                        <span className="capitalize">{view}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <label className="flex items-center gap-3 text-sm text-muted-foreground">
              <Checkbox
                checked={createDraft.sendPasswordReset}
                onCheckedChange={(checked) => updateCreateDraft({ sendPasswordReset: checked === true })}
              />
              Enviar e-mail de redefinicao de senha
            </label>

            <div className="flex flex-wrap justify-end">
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
                    <p className="font-medium text-foreground">Acesso atual</p>
                    {protectedAccount ? (
                      <p className="mt-1 leading-6">
                        Esta conta esta protegida por allowlist fixa de admin. Nao e possivel alterar
                        permissao, pagina ou status por esta tela.
                      </p>
                    ) : draft.role === "internal" ? (
                      <p className="mt-1 leading-6">
                        Usuarios internos acessam apenas as paginas liberadas em `internalPages`.
                      </p>
                    ) : draft.role === "client" ? (
                      <p className="mt-1 leading-6">
                        Usuarios cliente precisam ter clientes associados e ao menos uma view liberada.
                      </p>
                    ) : (
                      <p className="mt-1 leading-6">
                        Usuarios pendentes aguardam aprovacao e nao devem ter acesso operacional.
                      </p>
                    )}
                  </div>
                </div>

                {!protectedAccount && draft.role === "internal" && (
                  <div className="rounded-xl border border-border/80 p-4">
                    <p className="text-sm font-medium text-foreground">Paginas internas liberadas</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Controle o que este usuario interno pode visualizar.
                    </p>
                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {INTERNAL_PAGE_ORDER.map((page) => (
                        <label key={page} className="flex items-center gap-3 text-sm">
                          <Checkbox
                            checked={draft.internalPages.includes(page)}
                            disabled={!editable}
                            onCheckedChange={(checked) =>
                              updateDraft(user.uid, {
                                internalPages: toggleItem(draft.internalPages, page, checked === true),
                              })
                            }
                          />
                          <span className={!editable ? "text-muted-foreground" : "text-foreground"}>
                            <span className="capitalize">{page}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {!protectedAccount && draft.role === "client" && (
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-xl border border-border/80 p-4">
                      <p className="text-sm font-medium text-foreground">Clientes associados</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Selecione uma ou mais unidades de cliente para este usuario.
                      </p>
                      <div className="mt-4 grid gap-3">
                        {clients.map((client) => (
                          <label key={client.id} className="flex items-center gap-3 text-sm">
                            <Checkbox
                              checked={draft.clientIds.includes(client.id)}
                              disabled={!editable}
                              onCheckedChange={(checked) =>
                                updateDraft(user.uid, {
                                  clientIds: toggleItem(draft.clientIds, client.id, checked === true),
                                })
                              }
                            />
                            <span className={!editable ? "text-muted-foreground" : "text-foreground"}>
                              {client.name}
                            </span>
                          </label>
                        ))}
                        {!clients.length && (
                          <p className="text-sm text-muted-foreground">
                            Nenhum cliente cadastrado em `leads_clients`.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-border/80 p-4">
                      <p className="text-sm font-medium text-foreground">Views liberadas</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Controle o que este usuario cliente pode visualizar.
                      </p>
                      <div className="mt-4 grid gap-3">
                        {CLIENT_VIEW_ORDER.map((view) => (
                          <label key={view} className="flex items-center gap-3 text-sm">
                            <Checkbox
                              checked={draft.allowedViews.includes(view)}
                              disabled={!editable}
                              onCheckedChange={(checked) =>
                                updateDraft(user.uid, {
                                  allowedViews: toggleItem(draft.allowedViews, view, checked === true),
                                })
                              }
                            />
                            <span className={!editable ? "text-muted-foreground" : "text-foreground"}>
                              {view}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

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
    </PageShell>
  );
}
