import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Building2, Search, ShieldCheck, UserRound } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/EmptyState";
import { ErrorMessage } from "@/components/ErrorMessage";
import { PageShell } from "@/components/PageShell";
import { useLeadClients } from "@/hooks/useLeadClients";
import { type AdminUserRecord, useAdminUsers } from "@/hooks/useAdminUsers";
import { API_BASE_URL } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

type ManagedRole = "internal" | "client" | "pending";
type ManagedView = "dashboard" | "leads";

interface UserDraft {
  role: ManagedRole;
  companyName: string;
  clientIds: string[];
  allowedViews: ManagedView[];
  disabled: boolean;
}

const VIEW_OPTIONS: Array<{ id: ManagedView; label: string }> = [
  { id: "dashboard", label: "Dashboard" },
  { id: "leads", label: "Leads" },
];

function buildDraft(user: AdminUserRecord): UserDraft {
  return {
    role: user.access.role,
    companyName: user.access.companyName || "",
    clientIds: user.access.clientIds || [],
    allowedViews: user.access.allowedViews || [],
    disabled: user.disabled,
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

export default function UserAccessManagement() {
  const { getIdToken } = useAuth();
  const { data: users = [], isLoading, error, refetch } = useAdminUsers();
  const { data: clients = [] } = useLeadClients();
  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState<Record<string, UserDraft>>({});
  const [savingUid, setSavingUid] = useState<string | null>(null);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");

  useEffect(() => {
    if (!users.length) return;

    setDrafts((current) => {
      const next = { ...current };
      for (const user of users) {
        next[user.uid] = current[user.uid] || buildDraft(user);
      }
      return next;
    });
  }, [users]);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    const ordered = [...users].sort((a, b) => {
      const order = { pending: 0, client: 1, internal: 2 };
      return order[a.access.role] - order[b.access.role];
    });

    if (!term) return ordered;

    return ordered.filter((user) =>
      [user.email, user.displayName, user.access.companyName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [search, users]);

  const updateDraft = (uid: string, patch: Partial<UserDraft>) => {
    setDrafts((current) => ({
      ...current,
      [uid]: {
        ...(current[uid] || {
          role: "pending",
          companyName: "",
          clientIds: [],
          allowedViews: [],
          disabled: false,
        }),
        ...patch,
      },
    }));
  };

  const toggleClient = (uid: string, clientId: string, checked: boolean) => {
    const draft = drafts[uid];
    const next = checked
      ? Array.from(new Set([...(draft?.clientIds || []), clientId]))
      : (draft?.clientIds || []).filter((item) => item !== clientId);

    updateDraft(uid, { clientIds: next });
  };

  const toggleView = (uid: string, view: ManagedView, checked: boolean) => {
    const draft = drafts[uid];
    const next = checked
      ? Array.from(new Set([...(draft?.allowedViews || []), view]))
      : (draft?.allowedViews || []).filter((item) => item !== view);

    updateDraft(uid, { allowedViews: next });
  };

  const saveUser = async (user: AdminUserRecord) => {
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

      const res = await fetch(`${API_BASE_URL}/api/admin/users/${encodeURIComponent(user.uid)}/access`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(draft),
      });

      const payload = await res.json().catch(() => null);

      if (!res.ok) {
        const apiMessage = payload?.error?.message || payload?.error?.details;
        throw new Error(apiMessage || "Nao foi possivel salvar este usuario.");
      }

      setSaveSuccess(`Acessos atualizados para ${user.email || user.uid}.`);
      setDrafts((current) => ({
        ...current,
        [user.uid]: buildDraft(payload.item || user),
      }));
      await refetch();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Nao foi possivel salvar este usuario.");
    } finally {
      setSavingUid(null);
    }
  };

  return (
    <PageShell
      title="Usuarios e Acessos"
      subtitle="Associe usuarios aos clientes, views e perfis da plataforma."
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
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total de usuarios</CardDescription>
            <CardTitle className="text-3xl">{users.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Clientes pendentes</CardDescription>
            <CardTitle className="text-3xl">
              {users.filter((user) => user.access.role === "pending").length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Clientes cadastrados</CardDescription>
            <CardTitle className="text-3xl">{clients.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <ErrorMessage message={error ? (error as Error).message : null} variant="dashboard" />
      <ErrorMessage message={saveError} variant="banner" />
      {saveSuccess ? (
        <div className="rounded-lg border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
          {saveSuccess}
        </div>
      ) : null}

      {isLoading && <EmptyState message="Carregando usuarios..." />}

      {!isLoading && filteredUsers.length === 0 && (
        <EmptyState
          title="Nenhum usuario encontrado"
          description="Ajuste a busca ou aguarde novos cadastros."
        />
      )}

      <div className="space-y-4">
        {filteredUsers.map((user) => {
          const draft = drafts[user.uid] || buildDraft(user);
          const isClientRole = draft.role === "client";

          return (
            <Card key={user.uid} className="border-border/80">
              <CardHeader className="space-y-4 pb-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-lg">
                        {user.displayName || user.email || "Usuario sem nome"}
                      </CardTitle>
                      {user.access.role === "internal" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          Interno
                        </span>
                      )}
                      {user.access.role === "client" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-600">
                          <Building2 className="h-3.5 w-3.5" />
                          Cliente
                        </span>
                      )}
                      {user.access.role === "pending" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs text-amber-600">
                          <BadgeCheck className="h-3.5 w-3.5" />
                          Pendente
                        </span>
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

                  <div className="min-w-[180px] space-y-3">
                    <Select
                      value={draft.role}
                      onValueChange={(value: ManagedRole) => {
                        updateDraft(user.uid, {
                          role: value,
                          clientIds: value === "client" ? draft.clientIds : [],
                          allowedViews: value === "client" ? draft.allowedViews : [],
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar perfil" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="client">Cliente</SelectItem>
                        <SelectItem value="internal">Admin / Gestor</SelectItem>
                      </SelectContent>
                    </Select>

                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Checkbox
                        checked={draft.disabled}
                        onCheckedChange={(checked) =>
                          updateDraft(user.uid, { disabled: checked === true })
                        }
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
                      placeholder="Nome da empresa para identificacao"
                    />
                  </div>

                  <div className="rounded-xl border border-border/80 bg-background/40 px-4 py-3 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">Acesso atual</p>
                    <p className="mt-1 leading-6">
                      Usuarios internos acessam todo o CRM. Usuarios cliente precisam ter clientes
                      associados e pelo menos uma view liberada.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border border-border/80 p-4">
                    <p className="text-sm font-medium text-foreground">Clientes associados</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Selecione uma ou mais unidades/views de cliente para este usuario.
                    </p>
                    <div className="mt-4 grid gap-3">
                      {clients.map((client) => (
                        <label key={client.id} className="flex items-center gap-3 text-sm">
                          <Checkbox
                            checked={draft.clientIds.includes(client.id)}
                            disabled={!isClientRole}
                            onCheckedChange={(checked) =>
                              toggleClient(user.uid, client.id, checked === true)
                            }
                          />
                          <span className={!isClientRole ? "text-muted-foreground" : "text-foreground"}>
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
                      {VIEW_OPTIONS.map((view) => (
                        <label key={view.id} className="flex items-center gap-3 text-sm">
                          <Checkbox
                            checked={draft.allowedViews.includes(view.id)}
                            disabled={!isClientRole}
                            onCheckedChange={(checked) =>
                              toggleView(user.uid, view.id, checked === true)
                            }
                          />
                          <span className={!isClientRole ? "text-muted-foreground" : "text-foreground"}>
                            {view.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() => updateDraft(user.uid, buildDraft(user))}
                    disabled={savingUid === user.uid}
                  >
                    Restaurar
                  </Button>
                  <Button onClick={() => saveUser(user)} disabled={savingUid === user.uid}>
                    <UserRound className="h-4 w-4" />
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
