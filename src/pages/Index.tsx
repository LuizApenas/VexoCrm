import { Users, Target, TrendingUp, Bot, Snowflake, Flame, Clock } from "lucide-react";
import { KpiCard } from "@/components/KpiCard";
import { RevenueChart } from "@/components/charts/RevenueChart";
import { ConversionDonut } from "@/components/charts/ConversionDonut";
import { PipelineChart } from "@/components/charts/PipelineChart";
import { TopSellers } from "@/components/TopSellers";
import { RecentActivity } from "@/components/RecentActivity";

const Dashboard = () => {
  return (
    <div className="flex-1 overflow-auto">
      <header className="h-14 border-b border-border flex items-center px-6 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <h1 className="text-lg font-semibold text-foreground">Dashboard</h1>
      </header>

      <div className="p-6 space-y-5">
        {/* KPI Row 1 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="Leads Hoje" value="8" icon={<Users className="h-4 w-4" />} />
          <KpiCard title="Qualificados" value="3" icon={<Target className="h-4 w-4" />} />
          <KpiCard title="Taxa Qualificação" value="38%" icon={<TrendingUp className="h-4 w-4" />} />
          <KpiCard title="Quentes" value="4" icon={<Flame className="h-4 w-4" />} indicator={{ color: "bg-primary", label: "Quentes" }} />
        </div>

        {/* KPI Row 2 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="Mornos" value="3" icon={<Clock className="h-4 w-4" />} indicator={{ color: "bg-warning", label: "Mornos" }} />
          <KpiCard title="Frios" value="1" icon={<Snowflake className="h-4 w-4" />} indicator={{ color: "bg-success", label: "Frios" }} />
          <KpiCard title="Bot Ativo" value="2" icon={<Bot className="h-4 w-4" />} />
          <KpiCard title="Aguardando SDR" value="3" icon={<Clock className="h-4 w-4" />} />
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 rounded-lg border border-border bg-card p-5">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-foreground">Leads por Dia</h2>
            </div>
            <RevenueChart />
          </div>
          <div className="lg:col-span-2 rounded-lg border border-border bg-card p-5">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-foreground">Temperatura dos Leads</h2>
            </div>
            <ConversionDonut />
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-lg border border-border bg-card p-5">
            <TopSellers />
          </div>
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-foreground">Funil de Conversão</h2>
            </div>
            <PipelineChart />
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
