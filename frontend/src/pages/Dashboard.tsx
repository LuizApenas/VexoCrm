import { type ReactNode } from "react";
import {
  BadgeDollarSign,
  Bot,
  Clock,
  Flame,
  Handshake,
  MapPinned,
  MessageSquareText,
  Minus,
  Snowflake,
  Sparkles,
  TimerReset,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  Users2,
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
import { useOptionalCrmClient } from "@/hooks/useCrmClient";
import { useDashboard } from "@/hooks/useDashboard";
import { useRevenueOps, type RankingEntry, type RevenueMetric } from "@/hooks/useRevenueOps";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface DashboardProps {
  fixedClientId?: string;
  fixedClientName?: string;
  title?: string;
  subtitle?: string;
  headerRight?: ReactNode;
}

function availabilityClass(value: RevenueMetric["availability"]) {
  if (value === "ready") return "bg-emerald-500/10 text-emerald-600";
  if (value === "partial") return "bg-amber-500/10 text-amber-600";
  return "bg-slate-500/10 text-slate-600 dark:text-slate-300";
}

function TrendMark({ trend }: { trend: RankingEntry["trend"] }) {
  if (trend === "subindo") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-600">
        <TrendingUp className="h-3 w-3" />
        Subindo
      </span>
    );
  }

  if (trend === "caindo") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-rose-600">
        <TrendingDown className="h-3 w-3" />
        Caindo
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-300">
      <Minus className="h-3 w-3" />
      Estavel
    </span>
  );
}

const Dashboard = ({
  fixedClientId,
  fixedClientName,
  title = "Dashboard",
  subtitle = "Dados reais do Supabase filtrados pela empresa selecionada",
  headerRight,
}: DashboardProps) => {
  const crmClient = useOptionalCrmClient();
  const effectiveClientId = fixedClientId || crmClient?.selectedClientId || "";
  const selectedClient = crmClient?.selectedClient || null;
  const resolvedClientName = fixedClientName || selectedClient?.name || effectiveClientId;
  const { data, isLoading, error } = useDashboard(effectiveClientId);
  const { data: revenueOps, isLoading: revenueLoading, error: revenueError } = useRevenueOps(effectiveClientId);

  const summary = data?.summary ?? {
    totalLeads: 0,
    leadsToday: 0,
    qualifiedLeads: 0,
    qualificationRate: 0,
    activeCities: 0,
    hotLeads: 0,
    warmLeads: 0,
    coldLeads: 0,
    noSignalLeads: 0,
  };

  const primaryRevenueMetrics = revenueOps?.essentialMetrics.slice(0, 6) ?? [];

  const activeTone = summary.qualificationRate >= 50 ? "text-cyan-700 dark:text-cyan-200" : "text-fuchsia-700 dark:text-fuchsia-200";

  return (
    <PageShell
      title={title}
      subtitle={subtitle}
      headerRight={headerRight}
      spacing="space-y-4"
      compactHero
      contentClassName="px-4 py-4 lg:px-5 lg:py-4"
      showGlobalClientSelector={!fixedClientId}
    >
      {!effectiveClientId && !(crmClient?.isLoading) && (
        <EmptyState
          title="Nenhum cliente cadastrado"
          description="Cadastre um registro em leads_clients para liberar o dashboard."
        />
      )}

      {effectiveClientId && resolvedClientName && (
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-white/45">
          Cliente ativo: <span className="text-foreground">{resolvedClientName}</span>
        </p>
      )}

      <ErrorMessage message={error ? (error as Error).message : null} variant="dashboard" />
      <ErrorMessage message={revenueError ? (revenueError as Error).message : null} variant="dashboard" />

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
              <TabsList className="h-auto gap-2 rounded-full border border-slate-200/90 bg-white/85 p-1 dark:border-white/10 dark:bg-white/[0.04]">
                <TabsTrigger
                  value="resumo"
                  className="rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] data-[state=active]:bg-cyan-500/12 data-[state=active]:text-cyan-700 dark:data-[state=active]:bg-cyan-300/12 dark:data-[state=active]:text-cyan-200"
                >
                  Resumo
                </TabsTrigger>
                <TabsTrigger
                  value="funil"
                  className="rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] data-[state=active]:bg-cyan-500/12 data-[state=active]:text-cyan-700 dark:data-[state=active]:bg-cyan-300/12 dark:data-[state=active]:text-cyan-200"
                >
                  Funil
                </TabsTrigger>
                <TabsTrigger
                  value="operacao"
                  className="rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] data-[state=active]:bg-cyan-500/12 data-[state=active]:text-cyan-700 dark:data-[state=active]:bg-cyan-300/12 dark:data-[state=active]:text-cyan-200"
                >
                  Operacao
                </TabsTrigger>
                <TabsTrigger
                  value="revenue"
                  className="rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] data-[state=active]:bg-cyan-500/12 data-[state=active]:text-cyan-700 dark:data-[state=active]:bg-cyan-300/12 dark:data-[state=active]:text-cyan-200"
                >
                  Inteligencia Comercial
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="resumo" className="space-y-3">
              <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
                <KpiCard
                  title="Leads qualificados"
                  value={String(summary.qualifiedLeads)}
                  icon={<Target className="h-4 w-4" />}
                  tone="pink"
                  trend="com criterio aplicado"
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
                      <span className="inline-flex items-center gap-2 rounded-full border border-slate-200/90 bg-white/85 px-3 py-1.5 text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/80">
                        <span className="h-2 w-2 rounded-full bg-violet-400 shadow-[0_0_10px_rgba(167,139,250,0.9)]" />
                        Prospects
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-full border border-slate-200/90 bg-white/85 px-3 py-1.5 text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/80">
                        <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.9)]" />
                        Closed Deals
                      </span>
                    </div>
                    <div className="rounded-full border border-slate-200/90 bg-white/85 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/45">
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
                    <div className="rounded-[1.2rem] border border-slate-200/90 bg-white/85 p-3.5 dark:border-white/10 dark:bg-white/[0.04]">
                      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-200">
                        Cliente monitorado
                      </p>
                      <p className="mt-2 text-base font-semibold text-foreground">{resolvedClientName}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {summary.totalLeads} leads totais e {summary.qualifiedLeads} qualificados
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="rounded-[1rem] border border-slate-200/90 bg-slate-50/90 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-white/45">Cidades</p>
                        <p className="mt-1.5 text-xl font-bold text-foreground">{summary.activeCities}</p>
                      </div>
                      <div className="rounded-[1rem] border border-slate-200/90 bg-slate-50/90 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-white/45">Taxa</p>
                        <p className={cn("mt-1.5 text-xl font-bold", activeTone)}>{summary.qualificationRate}%</p>
                      </div>
                      <div className="rounded-[1rem] border border-slate-200/90 bg-slate-50/90 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-white/45">Quentes</p>
                        <p className="mt-1.5 text-xl font-bold text-foreground">{summary.hotLeads}</p>
                      </div>
                      <div className="rounded-[1rem] border border-slate-200/90 bg-slate-50/90 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-white/45">Mornos</p>
                        <p className="mt-1.5 text-xl font-bold text-foreground">{summary.warmLeads}</p>
                      </div>
                      <div className="rounded-[1rem] border border-slate-200/90 bg-slate-50/90 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-white/45">Frios</p>
                        <p className="mt-1.5 text-xl font-bold text-foreground">{summary.coldLeads}</p>
                      </div>
                      <div className="rounded-[1rem] border border-slate-200/90 bg-slate-50/90 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-white/45">Sem sinal</p>
                        <p className="mt-1.5 text-xl font-bold text-foreground">{summary.noSignalLeads}</p>
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

            <TabsContent value="revenue" className="space-y-3">
              {revenueLoading ? (
                <EmptyState message="Carregando inteligencia comercial..." />
              ) : revenueOps ? (
                <>
                  <KpiGrid cols={3} className="gap-2.5">
                    {primaryRevenueMetrics.map((metric, index) => {
                      const icons = [
                        <Target className="h-4 w-4" key="target" />,
                        <BadgeDollarSign className="h-4 w-4" key="money" />,
                        <MessageSquareText className="h-4 w-4" key="msg" />,
                        <Handshake className="h-4 w-4" key="deal" />,
                        <TrendingUp className="h-4 w-4" key="conv" />,
                        <TimerReset className="h-4 w-4" key="time" />,
                      ];

                      return (
                        <KpiCard
                          key={metric.key}
                          title={metric.name}
                          value={metric.displayValue}
                          icon={icons[index] || <Sparkles className="h-4 w-4" />}
                          tone={index % 2 === 0 ? "cyan" : "purple"}
                          trend={metric.availability === "ready" ? metric.frequency : "Aguardando base completa"}
                        />
                      );
                    })}
                  </KpiGrid>

                  <div className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
                    <DashboardPanel
                      title="Metricas essenciais"
                      subtitle="Formulas, fonte, frequencia e exibicao prontas para operacao"
                      className="p-4"
                    >
                      <div className="grid gap-3 md:grid-cols-2">
                        {revenueOps.essentialMetrics.map((metric) => (
                          <div key={metric.key} className="rounded-2xl border border-slate-200/90 bg-white/90 p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-foreground">{metric.name}</p>
                                <p className="mt-1 text-[11px] text-muted-foreground">{metric.displayValue}</p>
                              </div>
                              <span className={cn("rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]", availabilityClass(metric.availability))}>
                                {metric.availability}
                              </span>
                            </div>
                            <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                              <p><span className="font-semibold text-foreground">Formula:</span> {metric.formula}</p>
                              <p><span className="font-semibold text-foreground">Fonte:</span> {metric.source}</p>
                              <p><span className="font-semibold text-foreground">Calculo:</span> {metric.frequency}</p>
                              <p><span className="font-semibold text-foreground">Dashboard:</span> {metric.display}</p>
                              {metric.note ? <p className="text-amber-600 dark:text-amber-300">{metric.note}</p> : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    </DashboardPanel>

                    <DashboardPanel
                      title="Insights automaticos"
                      subtitle="Alertas orientados por dados para campanha, cidade, agente e consultor"
                      className="p-4"
                    >
                      <div className="space-y-3">
                        {revenueOps.insights.length === 0 ? (
                          <EmptyState message="Nenhum insight automatico relevante neste momento." />
                        ) : (
                          revenueOps.insights.map((insight) => (
                            <div key={`${insight.scope}-${insight.title}`} className="rounded-2xl border border-slate-200/90 bg-white/90 p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-semibold text-foreground">{insight.title}</p>
                                <span
                                  className={cn(
                                    "rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
                                    insight.severity === "critical"
                                      ? "bg-rose-500/10 text-rose-600"
                                      : insight.severity === "warning"
                                        ? "bg-amber-500/10 text-amber-600"
                                        : "bg-cyan-500/10 text-cyan-700 dark:text-cyan-200"
                                  )}
                                >
                                  {insight.severity}
                                </span>
                              </div>
                              <p className="mt-2 text-sm text-muted-foreground">{insight.message}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </DashboardPanel>
                  </div>

                  <div className="grid gap-3 xl:grid-cols-3">
                    <DashboardPanel title="Metricas avancadas" subtitle="Vantagem competitiva para agente, campanhas e base" className="p-4">
                      <div className="space-y-3">
                        {revenueOps.advancedMetrics.map((metric) => (
                          <div key={metric.key} className="rounded-2xl border border-slate-200/90 bg-white/90 p-3.5 dark:border-white/10 dark:bg-white/[0.04]">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-medium text-foreground">{metric.name}</p>
                              <span className="text-sm font-semibold text-foreground">{metric.displayValue}</span>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">{metric.formula}</p>
                            <p className="mt-2 text-[11px] text-muted-foreground">{metric.source}</p>
                          </div>
                        ))}
                      </div>
                    </DashboardPanel>

                    <DashboardPanel title="Ranking de cidades" subtitle="Top 5 e bottom 5 por qualificacao, conversao e tempo" className="p-4">
                      <div className="space-y-4">
                        <div>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Top 5</p>
                          <div className="space-y-2">
                            {revenueOps.rankings.cities.top5.map((item) => (
                              <div key={`city-top-${item.name}`} className="rounded-2xl border border-slate-200/90 bg-white/90 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-sm font-semibold text-foreground">{item.name}</p>
                                  <TrendMark trend={item.trend} />
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Qualificacao {item.qualificationRate?.toFixed(1)}% · Conversao {item.conversionRate?.toFixed(1)}% · Fechamento {item.avgCloseHours ? `${item.avgCloseHours.toFixed(1)}h` : "N/A"}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Bottom 5</p>
                          <div className="space-y-2">
                            {revenueOps.rankings.cities.bottom5.map((item) => (
                              <div key={`city-bottom-${item.name}`} className="rounded-2xl border border-slate-200/90 bg-white/90 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-sm font-semibold text-foreground">{item.name}</p>
                                  <TrendMark trend={item.trend} />
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Qualificacao {item.qualificationRate?.toFixed(1)}% · Conversao {item.conversionRate?.toFixed(1)}%
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </DashboardPanel>

                    <DashboardPanel title="Ranking de campanhas" subtitle="Top 5 e bottom 5 por qualidade, ROI potencial e resposta" className="p-4">
                      <div className="space-y-4">
                        <div>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Top 5</p>
                          <div className="space-y-2">
                            {revenueOps.rankings.campaigns.top5.map((item) => (
                              <div key={`campaign-top-${item.id || item.name}`} className="rounded-2xl border border-slate-200/90 bg-white/90 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-sm font-semibold text-foreground">{item.name}</p>
                                  <TrendMark trend={item.trend} />
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Qualificados {item.qualifiedLeads || 0} · Resposta {item.responseRate?.toFixed(1)}% · ROI potencial {item.potentialRoi ? `R$ ${item.potentialRoi.toFixed(0)}` : "N/A"}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Bottom 5</p>
                          <div className="space-y-2">
                            {revenueOps.rankings.campaigns.bottom5.map((item) => (
                              <div key={`campaign-bottom-${item.id || item.name}`} className="rounded-2xl border border-slate-200/90 bg-white/90 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-sm font-semibold text-foreground">{item.name}</p>
                                  <TrendMark trend={item.trend} />
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Qualificados {item.qualifiedLeads || 0} · Resposta {item.responseRate?.toFixed(1)}%
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </DashboardPanel>
                  </div>

                  <div className="grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                    <DashboardPanel title="Ranking de consultores" subtitle="Fechamento, tempo de resposta e conversao por lead" className="p-4">
                      {revenueOps.rankings.consultants.availability === "future" ? (
                        <EmptyState message="Ative crm_consultants, lead_assignments e lead_conversions para liberar o ranking de consultores." />
                      ) : (
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Top 5</p>
                            {revenueOps.rankings.consultants.top5.map((item) => (
                              <div key={`consultant-top-${item.id || item.name}`} className="rounded-2xl border border-slate-200/90 bg-white/90 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-sm font-semibold text-foreground">{item.name}</p>
                                  <TrendMark trend={item.trend} />
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Fechamento {item.conversionRate?.toFixed(1)}% · Resposta {item.responseTimeHours ? `${item.responseTimeHours.toFixed(1)}h` : "N/A"}
                                </p>
                              </div>
                            ))}
                          </div>
                          <div className="space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Bottom 5</p>
                            {revenueOps.rankings.consultants.bottom5.map((item) => (
                              <div key={`consultant-bottom-${item.id || item.name}`} className="rounded-2xl border border-slate-200/90 bg-white/90 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-sm font-semibold text-foreground">{item.name}</p>
                                  <TrendMark trend={item.trend} />
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Fechamento {item.conversionRate?.toFixed(1)}% · Conversao por lead {item.conversionPerLead?.toFixed(1)}%
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </DashboardPanel>

                    <DashboardPanel title="Distribuicao inteligente de leads" subtitle="Regras operacionais para rodizio, peso e prioridade regional" className="p-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200/90 bg-white/90 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                          <p className="text-sm font-semibold text-foreground">Critérios configuráveis</p>
                          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                            {revenueOps.distribution.criteria.map((item) => (
                              <li key={item}>• {item}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="rounded-2xl border border-slate-200/90 bg-white/90 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                          <p className="text-sm font-semibold text-foreground">Resumo operacional</p>
                          <div className="mt-3 grid grid-cols-3 gap-2">
                            <div className="rounded-xl bg-slate-50/90 p-3 text-center dark:bg-white/[0.04]">
                              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Consultores</p>
                              <p className="mt-1 text-lg font-bold text-foreground">{revenueOps.distribution.consultantLoadSummary.totalConsultants}</p>
                            </div>
                            <div className="rounded-xl bg-slate-50/90 p-3 text-center dark:bg-white/[0.04]">
                              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Disponíveis</p>
                              <p className="mt-1 text-lg font-bold text-foreground">{revenueOps.distribution.consultantLoadSummary.availableConsultants}</p>
                            </div>
                            <div className="rounded-xl bg-slate-50/90 p-3 text-center dark:bg-white/[0.04]">
                              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Sobrecarregados</p>
                              <p className="mt-1 text-lg font-bold text-foreground">{revenueOps.distribution.consultantLoadSummary.overloadedConsultants}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-3 md:grid-cols-3">
                        {revenueOps.distribution.models.map((model) => (
                          <div key={model.key} className="rounded-2xl border border-slate-200/90 bg-white/90 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                            <p className="text-sm font-semibold text-foreground">{model.name}</p>
                            <p className="mt-1 text-sm text-muted-foreground">{model.description}</p>
                            <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                              {model.rules.map((rule) => (
                                <li key={rule}>• {rule}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>

                      {revenueOps.distribution.activeRules.length > 0 ? (
                        <div className="mt-3 rounded-2xl border border-slate-200/90 bg-white/90 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                          <p className="text-sm font-semibold text-foreground">Regras ativas no banco</p>
                          <div className="mt-3 space-y-2">
                            {revenueOps.distribution.activeRules.map((rule) => (
                              <div key={rule.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50/90 px-3 py-2 text-sm dark:bg-white/[0.04]">
                                <div>
                                  <p className="font-medium text-foreground">{rule.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {rule.distribution_mode} · SLA {rule.reassign_after_minutes} min · limite {rule.max_open_leads_per_consultant} leads
                                  </p>
                                </div>
                                <span className="rounded-full bg-cyan-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-200">
                                  Ativa
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </DashboardPanel>
                  </div>

                  <div className="grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                    <DashboardPanel title="Modelagem de dados" subtitle="Tabelas e campos principais para suportar todas as metricas" className="p-4">
                      <div className="space-y-3">
                        {revenueOps.dataModel.tables.map((table) => (
                          <div key={table.name} className="rounded-2xl border border-slate-200/90 bg-white/90 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                            <p className="text-sm font-semibold text-foreground">{table.name}</p>
                            <p className="mt-1 text-sm text-muted-foreground">{table.purpose}</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {table.fields.map((field) => (
                                <span key={field} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-700 dark:bg-white/[0.06] dark:text-white/80">
                                  {field}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </DashboardPanel>

                    <DashboardPanel title="Blueprint do dashboard" subtitle="Organizacao visual e alertas para operacao e gestao" className="p-4">
                      <div className="space-y-3">
                        <div className="rounded-2xl border border-slate-200/90 bg-white/90 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                          <p className="text-sm font-semibold text-foreground">Cards principais</p>
                          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                            {revenueOps.dashboardBlueprint.cards.map((item) => (
                              <li key={item}>• {item}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="rounded-2xl border border-slate-200/90 bg-white/90 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                          <p className="text-sm font-semibold text-foreground">Graficos ideais</p>
                          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                            {revenueOps.dashboardBlueprint.charts.map((item) => (
                              <li key={item}>• {item}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="rounded-2xl border border-slate-200/90 bg-white/90 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                          <p className="text-sm font-semibold text-foreground">Alertas e filtros</p>
                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Alertas</p>
                              <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                                {revenueOps.dashboardBlueprint.alerts.map((item) => (
                                  <li key={item}>• {item}</li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Filtros</p>
                              <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                                {revenueOps.dashboardBlueprint.filters.map((item) => (
                                  <li key={item}>• {item}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                    </DashboardPanel>
                  </div>
                </>
              ) : null}
            </TabsContent>
          </Tabs>
        </>
      )}

      {isLoading && <EmptyState message="Carregando indicadores do dashboard..." />}
    </PageShell>
  );
};

export default Dashboard;
