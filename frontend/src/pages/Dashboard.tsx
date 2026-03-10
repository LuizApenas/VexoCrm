// VexoCrm/frontend/src/pages/Dashboard.tsx
import { useEffect, useState } from "react";
import { Users, Target, TrendingUp, Bot, Snowflake, Flame, Clock, Building2 } from "lucide-react";
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

const Dashboard = () => {
  const { data: clients = [], isLoading: clientsLoading } = useLeadClients();
  const [selectedClientId, setSelectedClientId] = useState("infinie");
  const { data, isLoading, error } = useDashboard(selectedClientId);

  useEffect(() => {
    if (!clients.length) return;
    const selectedStillExists = clients.some((client) => client.id === selectedClientId);
    if (!selectedStillExists) setSelectedClientId(clients[0].id);
  }, [clients, selectedClientId]);

  const summary = data?.summary ?? {
    totalLeads: 0,
    leadsToday: 0,
    emQualificacao: 0,
    qualificationRate: 0,
    botAtivo: 0,
    hotLeads: 0,
    warmLeads: 0,
    coldLeads: 0,
  };

  // Client selector shown in the sticky header
  const headerRight = (
    <div className="flex min-w-[220px] items-center gap-2">
      <Building2 className="h-4 w-4 text-muted-foreground" />
      <Select value={selectedClientId} onValueChange={setSelectedClientId} disabled={clientsLoading}>
        <SelectTrigger>
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

  return (
    <PageShell
      title="Dashboard"
      subtitle="Dados reais do Supabase filtrados pela empresa selecionada"
      headerRight={headerRight}
    >
      <ErrorMessage message={error ? (error as Error).message : null} variant="dashboard" />

      <KpiGrid>
        <KpiCard title="Total de Leads" value={String(summary.totalLeads)} icon={<Users className="h-4 w-4" />} />
        <KpiCard title="Leads Hoje" value={String(summary.leadsToday)} icon={<Clock className="h-4 w-4" />} />
        <KpiCard title="Em Qualificação" value={String(summary.emQualificacao)} icon={<Target className="h-4 w-4" />} />
        <KpiCard title="Taxa Qualificação" value={`${summary.qualificationRate}%`} icon={<TrendingUp className="h-4 w-4" />} />
      </KpiGrid>

      <KpiGrid>
        <KpiCard title="Bot Ativo" value={String(summary.botAtivo)} icon={<Bot className="h-4 w-4" />} />
        <KpiCard title="Quentes" value={String(summary.hotLeads)} icon={<Flame className="h-4 w-4" />} indicator={{ color: "bg-primary", label: "Quentes" }} />
        <KpiCard title="Mornos" value={String(summary.warmLeads)} icon={<Clock className="h-4 w-4" />} indicator={{ color: "bg-warning", label: "Mornos" }} />
        <KpiCard title="Frios" value={String(summary.coldLeads)} icon={<Snowflake className="h-4 w-4" />} indicator={{ color: "bg-success", label: "Frios" }} />
      </KpiGrid>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <DashboardPanel title="Leads por Dia" subtitle="Volume diário e quantos estão em qualificação" className="lg:col-span-3">
          <RevenueChart data={data?.leadsByDay ?? []} />
        </DashboardPanel>
        <DashboardPanel title="Temperatura dos Leads" className="lg:col-span-2">
          <ConversionDonut data={data?.temperatureBreakdown ?? []} />
        </DashboardPanel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <DashboardPanel>
          <TopSellers data={data?.typeBreakdown ?? []} />
        </DashboardPanel>
        <DashboardPanel title="Pipeline por Status">
          <PipelineChart data={data?.statusBreakdown ?? []} />
        </DashboardPanel>
        <DashboardPanel>
          <RecentActivity items={data?.recentLeads ?? []} />
        </DashboardPanel>
      </div>

      {isLoading && <EmptyState message="Carregando indicadores do dashboard..." />}
    </PageShell>
  );
};

export default Dashboard;
