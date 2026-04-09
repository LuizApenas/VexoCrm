import { useEffect, useState, type ReactNode } from "react";
import {
  Building2,
  Clock,
  Flame,
  MapPin,
  Snowflake,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { KpiCard } from "@/components/KpiCard";
import { RevenueChart } from "@/components/charts/RevenueChart";
import { ConversionDonut } from "@/components/charts/ConversionDonut";
import { PipelineChart } from "@/components/charts/PipelineChart";
import { TopSellers } from "@/components/TopSellers";
import { RecentActivity } from "@/components/RecentActivity";
import { PageShell } from "@/components/PageShell";
import { DashboardPanel } from "@/components/DashboardPanel";
import { ErrorMessage } from "@/components/ErrorMessage";
import { EmptyState } from "@/components/EmptyState";
import { KpiGrid } from "@/components/KpiGrid";
import { useLeadClients } from "@/hooks/useLeadClients";
import { useDashboard } from "@/hooks/useDashboard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface DashboardProps {
  fixedClientId?: string;
  fixedClientName?: string;
  title?: string;
  subtitle?: string;
  headerRight?: ReactNode;
}

const Dashboard = ({
  fixedClientId,
  fixedClientName,
  title = "Dashboard",
  subtitle = "Dados reais do Supabase filtrados pela empresa selecionada",
  headerRight,
}: DashboardProps) => {
  const { data: clients = [], isLoading: clientsLoading } = useLeadClients();
  const [selectedClientId, setSelectedClientId] = useState(fixedClientId ?? "");
  const effectiveClientId = fixedClientId || selectedClientId;
  const selectedClient = clients.find((client) => client.id === effectiveClientId);
  const resolvedClientName = fixedClientName || selectedClient?.name || effectiveClientId;
  const { data, isLoading, error } = useDashboard(effectiveClientId);

  useEffect(() => {
    if (fixedClientId) {
      setSelectedClientId(fixedClientId);
      return;
    }

    if (!clients.length) {
      if (selectedClientId) setSelectedClientId("");
      return;
    }

    const selectedStillExists = clients.some((client) => client.id === selectedClientId);
    if (!selectedClientId || !selectedStillExists) {
      setSelectedClientId(clients[0].id);
    }
  }, [clients, fixedClientId, selectedClientId]);

  const summary = data?.summary ?? {
    totalLeads: 0,
    leadsToday: 0,
    qualifiedLeads: 0,
    qualificationRate: 0,
    activeCities: 0,
    hotLeads: 0,
    warmLeads: 0,
    coldLeads: 0,
  };

  const clientSelector = (
    <div className="flex min-w-[220px] items-center gap-3 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 shadow-[0_18px_34px_rgba(0,0,0,0.2)]">
      <Building2 className="h-4 w-4 text-cyan-200" />
      <Select value={selectedClientId} onValueChange={setSelectedClientId} disabled={clientsLoading}>
        <SelectTrigger className="h-auto border-0 bg-transparent px-0 text-left shadow-none ring-0 focus:ring-0">
          <SelectValue placeholder="Selecionar empresa" />
        </SelectTrigger>
        <SelectContent>
          {clients.map((client) => (
            <SelectItem key={client.id} value={client.id}>
              {client.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const resolvedHeaderRight = headerRight ?? (!fixedClientId ? clientSelector : undefined);
  const activeTone = summary.qualificationRate >= 50 ? "text-cyan-200" : "text-fuchsia-200";

  return (
    <PageShell
      title={title}
      subtitle={subtitle}
      headerRight={resolvedHeaderRight}
      spacing="space-y-4"
      compactHero
      contentClassName="px-4 py-4 lg:px-5 lg:py-4"
    >
      {!effectiveClientId && !clientsLoading && (
        <EmptyState
          title="Nenhum cliente cadastrado"
          description="Cadastre um registro em leads_clients para liberar o dashboard."
        />
      )}

      {effectiveClientId && resolvedClientName && (
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/45">
          Cliente ativo: <span className="text-foreground">{resolvedClientName}</span>
        </p>
      )}

      <ErrorMessage message={error ? (error as Error).message : null} variant="dashboard" />

      {effectiveClientId && (
        <>
          <KpiGrid cols={3} className="gap-2.5">
            <KpiCard
              title="Total de Leads"
              value={String(summary.totalLeads)}
              icon={<Users className="h-4 w-4" />}
              tone="cyan"
              trend="base ativa"
            />
            <KpiCard
              title="Leads Hoje"
              value={String(summary.leadsToday)}
              icon={<Clock className="h-4 w-4" />}
              tone="teal"
              trend="entrada diaria"
            />
            <KpiCard
              title="Taxa de Qualificacao"
              value={`${summary.qualificationRate}%`}
              icon={<TrendingUp className="h-4 w-4" />}
              tone="amber"
              trend="base analisada"
            />
          </KpiGrid>

          <Tabs defaultValue="resumo" className="space-y-3">
            <div className="overflow-x-auto pb-1">
              <TabsList className="h-auto gap-2 rounded-full border border-white/10 bg-white/[0.04] p-1">
                <TabsTrigger
                  value="resumo"
                  className="rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] data-[state=active]:bg-cyan-300/12 data-[state=active]:text-cyan-200"
                >
                  Resumo
                </TabsTrigger>
                <TabsTrigger
                  value="funil"
                  className="rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] data-[state=active]:bg-cyan-300/12 data-[state=active]:text-cyan-200"
                >
                  Funil
                </TabsTrigger>
                <TabsTrigger
                  value="operacao"
                  className="rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] data-[state=active]:bg-cyan-300/12 data-[state=active]:text-cyan-200"
                >
                  Operacao
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="resumo" className="space-y-3">
              <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
                <KpiCard
                  title="Leads qualificados"
                  value={String(summary.qualifiedLeads)}
                  icon={<Target className="h-4 w-4" />}
                  tone="pink"
                  trend="com criterio aplicado"
                />
                <KpiCard
                  title="Cobertura territorial"
                  value={String(summary.activeCities)}
                  icon={<MapPin className="h-4 w-4" />}
                  tone="purple"
                  trend="presenca ativa"
                />
                <KpiCard
                  title="Prioridade quente"
                  value={String(summary.hotLeads)}
                  icon={<Flame className="h-4 w-4" />}
                  indicator={{ color: "bg-cyan-300", label: "Quentes" }}
                  tone="cyan"
                  trend="foco comercial"
                />
                <KpiCard
                  title="Leads mornos"
                  value={String(summary.warmLeads)}
                  icon={<Clock className="h-4 w-4" />}
                  tone="amber"
                  trend="acompanhamento"
                />
                <KpiCard
                  title="Leads frios"
                  value={String(summary.coldLeads)}
                  icon={<Snowflake className="h-4 w-4" />}
                  tone="teal"
                  trend="nutricao ativa"
                />
                <KpiCard
                  title="Cobertura"
                  value={`${summary.qualificationRate}%`}
                  icon={<Users className="h-4 w-4" />}
                  tone="purple"
                  trend="taxa consolidada"
                />
              </div>
            </TabsContent>

            <TabsContent value="funil" className="space-y-3">
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.85fr)]">
                <DashboardPanel
                  title="Sales Pipeline"
                  subtitle="Comparativo entre leads totais e leads qualificados ao longo do tempo"
                  className="min-h-[300px] p-4"
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-white/80">
                        <span className="h-2 w-2 rounded-full bg-violet-400 shadow-[0_0_10px_rgba(167,139,250,0.9)]" />
                        Prospects
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-white/80">
                        <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.9)]" />
                        Closed Deals
                      </span>
                    </div>
                    <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">
                      Dados em tempo real
                    </div>
                  </div>
                  <RevenueChart data={data?.leadsByDay ?? []} />
                </DashboardPanel>

                <DashboardPanel
                  title="Radar de conversao"
                  subtitle="Resumo rapido da operacao"
                  className="min-h-[300px] p-4"
                >
                  <ConversionDonut data={data?.temperatureBreakdown ?? []} />
                  <div className="mt-3 space-y-2.5">
                    <div className="rounded-[1.2rem] border border-white/10 bg-white/[0.04] p-3.5">
                      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-200">
                        Cliente monitorado
                      </p>
                      <p className="mt-2 text-base font-semibold text-foreground">{resolvedClientName}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {summary.totalLeads} leads totais e {summary.qualifiedLeads} qualificados
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="rounded-[1rem] border border-white/10 bg-white/[0.04] p-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Cidades</p>
                        <p className="mt-1.5 text-xl font-bold text-foreground">{summary.activeCities}</p>
                      </div>
                      <div className="rounded-[1rem] border border-white/10 bg-white/[0.04] p-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Taxa</p>
                        <p className={cn("mt-1.5 text-xl font-bold", activeTone)}>{summary.qualificationRate}%</p>
                      </div>
                      <div className="rounded-[1rem] border border-white/10 bg-white/[0.04] p-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Quentes</p>
                        <p className="mt-1.5 text-xl font-bold text-foreground">{summary.hotLeads}</p>
                      </div>
                      <div className="rounded-[1rem] border border-white/10 bg-white/[0.04] p-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Mornos</p>
                        <p className="mt-1.5 text-xl font-bold text-foreground">{summary.warmLeads}</p>
                      </div>
                    </div>
                  </div>
                </DashboardPanel>
              </div>
            </TabsContent>

            <TabsContent value="operacao" className="space-y-3">
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.85fr)]">
                <DashboardPanel
                  title="Leads recentes"
                  subtitle="Leitura operacional do fluxo de entrada"
                  className="min-h-[250px] p-4"
                >
                  <RecentActivity items={data?.recentLeads ?? []} />
                </DashboardPanel>

                <div className="grid gap-3">
                  <DashboardPanel title="Leads por perfil" subtitle="Distribuicao por categoria" className="p-4">
                    <TopSellers data={data?.typeBreakdown ?? []} />
                  </DashboardPanel>
                  <DashboardPanel title="Pipeline por status" className="p-4">
                    <PipelineChart data={data?.statusBreakdown ?? []} />
                  </DashboardPanel>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}

      {isLoading && <EmptyState message="Carregando indicadores do dashboard..." />}
    </PageShell>
  );
};

export default Dashboard;
