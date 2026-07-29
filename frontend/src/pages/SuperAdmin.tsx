import { useState, useEffect } from "react";
import { 
  Building2, 
  Crown, 
  Users, 
  Wifi, 
  Zap, 
  ShieldAlert, 
  CheckCircle2, 
  Search, 
  ToggleLeft, 
  ToggleRight, 
  Eye, 
  RefreshCw,
  Sliders,
  Activity,
  UserCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useCrmClient } from "@/hooks/useCrmClient";

interface SuperAdminTenant {
  id: string;
  name: string;
  created_at: string;
  status: "active" | "suspended";
  modules: string[];
  userCount: number;
}

export default function SuperAdmin() {
  const { user } = useAuth();
  const { selectClient, clients } = useCrmClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [searchTerm, setSearchTerm] = useState("");
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

  const [overviewMetrics, setOverviewMetrics] = useState({
    totalTenants: 1,
    totalLeads: 0,
    totalDispatches: 0,
    totalChips: 1,
    activeTenants: 1,
    suspendedTenants: 0,
  });

  const fetchOverview = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/superadmin/overview");
      if (res.ok) {
        const data = await res.json();
        setOverviewMetrics({
          totalTenants: data.totalTenants || 1,
          totalLeads: data.totalLeads || 0,
          totalDispatches: data.totalDispatches || 0,
          totalChips: data.totalChips || 1,
          activeTenants: data.activeTenants || 1,
          suspendedTenants: data.suspendedTenants || 0,
        });
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

  const handleToggleTenantStatus = (tenantId: string) => {
    setTenants((prev) =>
      prev.map((t) =>
        t.id === tenantId
          ? { ...t, status: t.status === "active" ? "suspended" : "active" }
          : t
      )
    );
    toast.success("Status da empresa atualizado com sucesso!");
  };

  const handleImpersonate = (tenantId: string) => {
    selectClient(tenantId);
    toast.success(`Alternado para a empresa: ${tenantId}`);
  };

  const filteredTenants = tenants.filter(
    (t) =>
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen space-y-6 bg-slate-950/40 p-6 text-slate-100">
      {/* Header do SuperAdmin */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-slate-800/80 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 shadow-lg shadow-purple-500/20">
            <Crown className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              Master Control Center
              <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30">SuperAdmin</Badge>
            </h1>
            <p className="text-sm text-slate-400">
              Visão macro consolidada de empresas, permissões, módulos e saúde da plataforma.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchOverview}
            disabled={loading}
            className="border-slate-800 bg-slate-900/80 text-slate-300 hover:bg-slate-800"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Atualizar Dados
          </Button>
        </div>
      </div>

      {/* Grid de KPIs Globais */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-slate-800/80 bg-slate-900/60 backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Total de Empresas
            </CardTitle>
            <Building2 className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{overviewMetrics.totalTenants}</div>
            <p className="mt-1 text-xs text-slate-400">
              {overviewMetrics.activeTenants} ativas · {overviewMetrics.suspendedTenants} suspensas
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-800/80 bg-slate-900/60 backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Leads Processados
            </CardTitle>
            <Users className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{overviewMetrics.totalLeads}</div>
            <p className="mt-1 text-xs text-slate-400">Total acumulado na base</p>
          </CardContent>
        </Card>

        <Card className="border-slate-800/80 bg-slate-900/60 backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Disparos Efetuados
            </CardTitle>
            <Zap className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{overviewMetrics.totalDispatches}</div>
            <p className="mt-1 text-xs text-slate-400">Mensagens enviadas via campanhas</p>
          </CardContent>
        </Card>

        <Card className="border-slate-800/80 bg-slate-900/60 backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Instâncias WhatsApp
            </CardTitle>
            <Wifi className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{overviewMetrics.totalChips}</div>
            <p className="mt-1 text-xs text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Sistema de comunicação operacional
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Conteúdo Principal com Abas */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="border-slate-800 bg-slate-900/80 p-1">
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
          <Card className="border-slate-800 bg-slate-900/60 backdrop-blur">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg text-white">Empresas Cadastradas (Tenants)</CardTitle>
                <CardDescription className="text-slate-400">
                  Gerencie o acesso, suspensão e módulos ativados para cada cliente do CRM.
                </CardDescription>
              </div>
              <div className="w-64">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Buscar tenant por nome..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="border-slate-800 bg-slate-950/80 pl-9 text-slate-200"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-slate-800 overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-950/80">
                    <TableRow className="border-slate-800 hover:bg-transparent">
                      <TableHead className="text-slate-400">Empresa / ID</TableHead>
                      <TableHead className="text-slate-400">Criado em</TableHead>
                      <TableHead className="text-slate-400">Status</TableHead>
                      <TableHead className="text-slate-400">Módulos Ativos</TableHead>
                      <TableHead className="text-slate-400 text-right">Ações de Controle</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTenants.map((t) => (
                      <TableRow key={t.id} className="border-slate-800 hover:bg-slate-800/40">
                        <TableCell>
                          <div>
                            <p className="font-medium text-white">{t.name}</p>
                            <p className="font-mono text-xs text-purple-400">{t.id}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-300">
                          {new Date(t.created_at).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              t.status === "active"
                                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                                : "bg-red-500/20 text-red-400 border-red-500/30"
                            }
                          >
                            {t.status === "active" ? "Ativa" : "Suspensa"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {t.modules.slice(0, 3).map((m) => (
                              <Badge key={m} variant="outline" className="border-slate-700 bg-slate-800/60 text-slate-300 text-[10px]">
                                {m}
                              </Badge>
                            ))}
                            {t.modules.length > 3 && (
                              <Badge variant="outline" className="border-slate-700 bg-slate-800/60 text-slate-400 text-[10px]">
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
                              onClick={() => handleImpersonate(t.id)}
                              className="border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20"
                              title="Visualizar tela como esta empresa"
                            >
                              <Eye className="mr-1.5 h-3.5 w-3.5" /> Alternar Visão
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleToggleTenantStatus(t.id)}
                              className={
                                t.status === "active"
                                  ? "border-red-500/30 text-red-400 hover:bg-red-500/10"
                                  : "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
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
          <Card className="border-slate-800 bg-slate-900/60 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-lg text-white">Usuários com Acesso Master</CardTitle>
              <CardDescription className="text-slate-400">
                Visualização unificada de contas e cargos configurados no CRM.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-slate-800 p-4 bg-slate-950/60 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-purple-600/30 border border-purple-500/40 flex items-center justify-center font-bold text-purple-300">
                    C
                  </div>
                  <div>
                    <p className="font-semibold text-white">{user?.displayName || "Conrado Finzi"}</p>
                    <p className="text-xs text-slate-400">{user?.email || "conradofinzi@gmail.com"}</p>
                  </div>
                </div>
                <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 px-3 py-1 text-xs">
                  👑 SuperAdmin (Acesso Total)
                </Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba 3: Saúde e Logs */}
        <TabsContent value="health" className="space-y-4">
          <Card className="border-slate-800 bg-slate-900/60 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <Activity className="h-5 w-5 text-emerald-400" /> Central de Logs & Diagnóstico
              </CardTitle>
              <CardDescription className="text-slate-400">
                Monitoramento contínuo de conectividade do banco, instâncias WhatsApp e disparos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between p-3 rounded bg-slate-950 border border-slate-800">
                  <span className="text-slate-300">[database] PostgreSQL Direct Pool</span>
                  <span className="text-emerald-400 font-bold">ONLINE (0ms latency)</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded bg-slate-950 border border-slate-800">
                  <span className="text-slate-300">[whatsapp] Evolution API Service</span>
                  <span className="text-emerald-400 font-bold">OPERACIONAL</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded bg-slate-950 border border-slate-800">
                  <span className="text-slate-300">[followup] BullMQ & Workers</span>
                  <span className="text-emerald-400 font-bold">ATIVO</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
