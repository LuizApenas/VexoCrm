import { DollarSign, Eye, TrendingUp, Clock } from "lucide-react";
import { KpiCard } from "@/components/KpiCard";
import { RevenueChart } from "@/components/charts/RevenueChart";
import { ConversionDonut } from "@/components/charts/ConversionDonut";
import { PipelineChart } from "@/components/charts/PipelineChart";
import { TopSellers } from "@/components/TopSellers";
import { RecentActivity } from "@/components/RecentActivity";

const Dashboard = () => {
  return (
    <div className="flex-1 overflow-auto">
      {/* Header */}
      <header className="h-14 border-b border-border flex items-center justify-between px-6 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Dashboard</h1>
          <p className="text-xs text-muted-foreground">Visão geral do seu CRM</p>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="Receita do Mês"
            value="R$ 157k"
            subtitle="Meta: R$ 130k (120%)"
            change={{ value: "+18.4%", positive: true }}
            icon={<DollarSign className="h-4 w-4" />}
          />
          <KpiCard
            title="Novos Leads"
            value="284"
            subtitle="142 qualificados"
            change={{ value: "+23%", positive: true }}
            icon={<Eye className="h-4 w-4" />}
          />
          <KpiCard
            title="Taxa de Conversão"
            value="31.2%"
            subtitle="Média setor: 24%"
            change={{ value: "+3.1pp", positive: true }}
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <KpiCard
            title="Ciclo Médio de Venda"
            value="18 dias"
            subtitle="Anterior: 22 dias"
            change={{ value: "-18.2%", positive: false }}
            icon={<Clock className="h-4 w-4" />}
          />
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-lg border border-border bg-card p-5">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-foreground">Receita vs. Meta</h2>
              <p className="text-xs text-muted-foreground">Últimos 7 meses</p>
            </div>
            <RevenueChart />
          </div>
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-foreground">Conversão</h2>
              <p className="text-xs text-muted-foreground">Status dos leads</p>
            </div>
            <ConversionDonut />
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-foreground">Pipeline por Etapa</h2>
              <p className="text-xs text-muted-foreground">Volume de negócios</p>
            </div>
            <PipelineChart />
          </div>
          <div className="rounded-lg border border-border bg-card p-5">
            <TopSellers />
          </div>
          <div className="rounded-lg border border-border bg-card p-5">
            <RecentActivity />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
