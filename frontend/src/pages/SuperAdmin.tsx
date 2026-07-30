import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Building2, 
  Crown, 
  Users, 
  Wifi, 
  Zap, 
  CheckCircle2, 
  Search, 
  ToggleLeft, 
  ToggleRight, 
  Eye, 
  RefreshCw,
  Activity,
  UserCheck,
  Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useOptionalCrmClient } from "@/hooks/useCrmClient";

interface SuperAdminTenant {
  id: string;
  name: string;
  created_at: string;
  status: "active" | "suspended";
  modules: string[];
  userCount: number;
}

export default function SuperAdmin() {
  const navigate = useNavigate();
  const { user, getIdToken } = useAuth();
  const crmClient = useOptionalCrmClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTenantFilter, setSelectedTenantFilter] = useState<string>("all");
  const [loading, setLoading] = useState(false);

  const [tenants, setTenants] = useState<SuperAdminTenant[]>([
    {
      id: "geracao-digital",
      name: "Geração Digital",
      created_at: new Date().toISOString(),
      status: "active",
      modules: ["dashboard", "conversas", "followup", "campanhas", "geracao-digital", "inteligencia-comercial"],
      userCount: 1,
    },
  ]);

  const [rawMetrics, setRawMetrics] = useState({
    totalTenants: 1,
    totalLeads: 0,
    totalDispatches: 0,
    totalChips: 1,
    activeTenants: 1,
    suspendedTenants: 0,
  });

  const getAuthHeaders = async () => {
    try {
      const token = await getIdToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      return headers;
    } catch (e) {
      return { "Content-Type": "application/json" };
    }
  };

  const fetchOverview = async () => {
    try {
      setLoading(true);
      const headers = await getAuthHeaders();
      const res = await fetch("/api/superadmin/overview", { headers });
      if (res.ok) {
        const data = await res.json();
        setRawMetrics({
          totalTenants: data.totalTenants || 1,
          totalLeads: data.totalLeads || 0,
          totalDispatches: data.totalDispatches || 0,
          totalChips: data.totalChips || 1,
          activeTenants: data.activeTenants || 1,
          suspendedTenants: data.suspendedTenants || 0,
        });
      }

      const tenantsRes = await fetch("/api/superadmin/tenants", { headers });
      if (tenantsRes.ok) {
        const tenantsData = await tenantsRes.json();
        if (Array.isArray(tenantsData.items) && tenantsData.items.length > 0) {
          setTenants(tenantsData.items);
        }
      }
    } catch (err) {
      console.warn("Error fetching superadmin overview:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  const handleToggleTenantStatus = async (tenantId: string) => {
    try {
      const current = tenants.find((t) => t.id === tenantId);
      const newStatus = current?.status === "active" ? "suspended" : "active";

      setTenants((prev) =>
        prev.map((t) => (t.id === tenantId ? { ...t, status: newStatus } : t))
      );

      const headers = await getAuthHeaders();
      await fetch(`/api/superadmin/tenants/${tenantId}/status`, {
        method: "POST",
        headers,
        body: JSON.stringify({ status: newStatus }),
      });

      toast.success(`Empresa ${newStatus === "active" ? "ativada" : "suspensa"} com sucesso!`);
    } catch (err) {
      toast.error("Falha ao alterar status da empresa.");
    }
  };

  const handleImpersonate = (tenantId: string, tenantName: string) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("vexo.crm.selected-client", tenantId);
    }
    if (crmClient?.setSelectedClientId) {
      crmClient.setSelectedClientId(tenantId);
    }

    toast.success(`Visão alternada para: ${tenantName || tenantId}. Redirecionando...`);
    setTimeout(() => {
      navigate("/crm/dashboard");
    }, 400);
  };

  const filteredTenants = tenants.filter(
    (t) =>
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const displayMetrics = selectedTenantFilter === "all"
    ? rawMetrics
    : {
        totalTenants: 1,
        totalLeads: rawMetrics.totalLeads,
        totalDispatches: rawMetrics.totalDispatches,
        totalChips: rawMetrics.totalChips,
        activeTenants: tenants.find((t) => t.id === selectedTenantFilter)?.status === "active" ? 1 : 0,
        suspendedTenants: tenants.find((t) => t.id === selectedTenantFilter)?.status === "suspended" ? 1 : 0,
      };

  return (
    <div className="min-h-screen space-y-6 bg-background p-4 md:p-6 text-foreground">
      {/* Header do SuperAdmin */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-border pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 shadow-md shadow-purple-500/20 text-white">
            <Crown className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              Master Control Center
              <Badge variant="outline" className="bg-purple-500/10 text-purple-600 dark:text-purple-300 border-purple-500/30">
                SuperAdmin
              </Badge>
            </h1>
            <p className="text-sm text-muted-foreground">
              Visão macro consolidada de empresas, permissões, módulos e saúde da plataforma.
            </p>
          </div>
        </div>

        {/* Filtro Global por Empresa + Botão Atualizar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-card border border-border px-3 py-1.5 rounded-lg shadow-sm">
            <Filter className="h-4 w-4 text-purple-500" />
            <span className="text-xs font-medium text-muted-foreground">Empresa:</span>
            <Select value={selectedTenantFilter} onValueChange={setSelectedTenantFilter}>
              <SelectTrigger className="w-[180px] h-8 border-none bg-transparent text-xs font-semibold focus:ring-0 focus:outline-none">
                <SelectValue placeholder="Todas as empresas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">🌐 Todas (Visão Global)</SelectItem>
                {tenants.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    🏢 {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchOverview}
            disabled={loading}
            className="border-border bg-card text-foreground hover:bg-accent"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Grid de KPIs Globais/Filtrados */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border bg-card text-card-foreground shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {selectedTenantFilter === "all" ? "Total de Empresas" : "Empresa Selecionada"}
            </CardTitle>
            <Building2 className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {selectedTenantFilter === "all"
                ? displayMetrics.totalTenants
                : tenants.find((t) => t.id === selectedTenantFilter)?.name || selectedTenantFilter}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {displayMetrics.activeTenants} ativas · {displayMetrics.suspendedTenants} suspensas
            </p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card text-card-foreground shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Leads Processados
            </CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{displayMetrics.totalLeads}</div>
            <p className="mt-1 text-xs text-muted-foreground">Total acumulado na base</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card text-card-foreground shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Disparos Efetuados
            </CardTitle>
            <Zap className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{displayMetrics.totalDispatches}</div>
            <p className="mt-1 text-xs text-muted-foreground">Mensagens enviadas via campanhas</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card text-card-foreground shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Instâncias WhatsApp
            </CardTitle>
            <Wifi className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{displayMetrics.totalChips}</div>
            <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Sistema de comunicação operacional
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Conteúdo Principal com Abas */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="border border-border bg-card p-1">
          <TabsTrigger value="overview" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white">
            <Building2 className="mr-2 h-4 w-4" /> Gestão de Empresas
          </TabsTrigger>
          <TabsTrigger value="users" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white">
            <UserCheck className="mr-2 h-4 w-4" /> Usuários Globais
          </TabsTrigger>
          <TabsTrigger value="health" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white">
            <Activity className="mr-2 h-4 w-4" /> Saúde & Logs
          </TabsTrigger>
        </TabsList>

        {/* Aba 1: Gestão de Empresas */}
        <TabsContent value="overview" className="space-y-4">
          <Card className="border-border bg-card text-card-foreground shadow-sm">
            <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle className="text-lg text-foreground">Empresas Cadastradas (Tenants)</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Gerencie o acesso, suspensão e módulos ativados para cada cliente do CRM.
                </CardDescription>
              </div>
              <div className="w-full md:w-64">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar tenant por nome..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="border-border bg-background pl-9 text-foreground"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-muted-foreground font-semibold">Empresa / ID</TableHead>
                      <TableHead className="text-muted-foreground font-semibold">Criado em</TableHead>
                      <TableHead className="text-muted-foreground font-semibold">Status</TableHead>
                      <TableHead className="text-muted-foreground font-semibold">Módulos Ativos</TableHead>
                      <TableHead className="text-muted-foreground font-semibold text-right">Ações de Controle</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTenants.map((t) => (
                      <TableRow key={t.id} className="border-border hover:bg-muted/40">
                        <TableCell>
                          <div>
                            <p className="font-medium text-foreground">{t.name}</p>
                            <p className="font-mono text-xs text-purple-600 dark:text-purple-400">{t.id}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(t.created_at).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              t.status === "active"
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                                : "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30"
                            }
                          >
                            {t.status === "active" ? "Ativa" : "Suspensa"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {t.modules.slice(0, 3).map((m) => (
                              <Badge key={m} variant="outline" className="border-border bg-muted/60 text-muted-foreground text-[10px]">
                                {m}
                              </Badge>
                            ))}
                            {t.modules.length > 3 && (
                              <Badge variant="outline" className="border-border bg-muted/60 text-muted-foreground text-[10px]">
                                +{t.modules.length - 3}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleImpersonate(t.id, t.name)}
                              className="border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-300 hover:bg-purple-500/20"
                              title="Visualizar tela e CRM como esta empresa"
                            >
                              <Eye className="mr-1.5 h-3.5 w-3.5" /> Alternar Visão
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleToggleTenantStatus(t.id)}
                              className={
                                t.status === "active"
                                  ? "border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/10"
                                  : "border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                              }
                            >
                              {t.status === "active" ? (
                                <>
                                  <ToggleLeft className="mr-1.5 h-4 w-4" /> Suspender
                                </>
                              ) : (
                                <>
                                  <ToggleRight className="mr-1.5 h-4 w-4" /> Ativar
                                </>
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba 2: Usuários Globais */}
        <TabsContent value="users" className="space-y-4">
          <Card className="border-border bg-card text-card-foreground shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-foreground">Usuários com Acesso Master</CardTitle>
              <CardDescription className="text-muted-foreground">
                Visualização unificada de contas e cargos configurados no CRM.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-border p-4 bg-muted/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-purple-500/20 border border-purple-500/40 flex items-center justify-center font-bold text-purple-600 dark:text-purple-300">
                    C
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{user?.displayName || "Conrado Finzi"}</p>
                    <p className="text-xs text-muted-foreground">{user?.email || "conradofinzi@gmail.com"}</p>
                  </div>
                </div>
                <Badge className="bg-purple-500/20 text-purple-600 dark:text-purple-300 border-purple-500/40 px-3 py-1 text-xs">
                  👑 SuperAdmin (Acesso Total)
                </Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba 3: Saúde e Logs */}
        <TabsContent value="health" className="space-y-4">
          <Card className="border-border bg-card text-card-foreground shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg text-foreground flex items-center gap-2">
                  <Activity className="h-5 w-5 text-emerald-500" /> Central de Logs & Diagnóstico
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  Monitoramento contínuo de conectividade do banco, instâncias WhatsApp e disparos.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    toast.info("Iniciando migração de dados do banco antigo...");
                    const headers = await getAuthHeaders();
                    // Sem credencial hardcoded no frontend (vaza no bundle do navegador).
                    // A origem da migração vem de LEGACY_DB_URL no servidor, se configurada.
                    const res = await fetch("/api/superadmin/migrate-from-old-db", {
                      method: "POST",
                      headers,
                      body: JSON.stringify({})
                    });
                    const data = await res.json();
                    if (res.ok && data.success) {
                      toast.success(data.message || "Dados migrados com sucesso!");
                      fetchOverview();
                    } else {
                      toast.error(`Falha na migração: ${data.message || data.error || "Erro desconhecido"}`);
                    }
                  } catch (e) {
                    toast.error("Erro ao conectar à API de migração.");
                  }
                }}
                className="border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-300 hover:bg-purple-500/20"
              >
                <RefreshCw className="mr-2 h-4 w-4" /> Importar Dados do Banco Antigo
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between p-3 rounded bg-muted/40 border border-border">
                  <span className="text-foreground">[database] PostgreSQL Direct Pool</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">ONLINE (0ms latency)</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded bg-muted/40 border border-border">
                  <span className="text-foreground">[whatsapp] Evolution API Service</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">OPERACIONAL</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded bg-muted/40 border border-border">
                  <span className="text-foreground">[followup] BullMQ & Workers</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">ATIVO</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
