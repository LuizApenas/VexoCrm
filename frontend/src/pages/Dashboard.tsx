import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { useTheme } from "next-themes";
import {
  FileSpreadsheet,
  FileText,
  Flame,
  Calendar,
  Rocket,
  Inbox,
  RefreshCw,
  Bot,
  ArrowRight,
  MessageSquare,
  Smartphone,
  Star,
  Trophy,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageShell } from "@/components/PageShell";
import { EmptyState } from "@/components/EmptyState";
import { ErrorMessage } from "@/components/ErrorMessage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useOptionalCrmClient } from "@/hooks/useCrmClient";
import { useDashboard } from "@/hooks/useDashboard";
import { useEvolutionUsageReport } from "@/hooks/useReports";
import { useCampanhas } from "@/hooks/useCampanhas";

interface DashboardProps {
  fixedClientId?: string;
  fixedClientName?: string;
  title?: string;
  subtitle?: string;
  headerRight?: ReactNode;
}

// Paleta sólida e harmoniosa
const SOLID = {
  indigo: "#6366F1",
  orange: "#ff7a1a",
  cyan: "#22D3EE",
  emerald: "#10b981",
  amber: "#f59e0b",
  red: "#ef4444",
  slate: "#94a3b8",
};

const TEMP_COLORS: Record<string, string> = {
  Quente: SOLID.red,
  Morno: SOLID.amber,
  Frio: SOLID.cyan,
  "Sem sinal": SOLID.slate,
};

// Placeholder uniforme para métrica sem fonte de dado
const DASH = "—";

function formatMetric(value: number | null | undefined, kind: "int" | "pct" = "int"): string {
  if (value == null || (typeof value === "number" && !Number.isFinite(value))) return DASH;
  return kind === "pct" ? `${value}%` : Number(value).toLocaleString("pt-BR");
}

function formatDiaLabel(dia: string): string {
  const p = String(dia).split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}` : dia;
}

function pctDelta(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export default function Dashboard({
  fixedClientId,
  fixedClientName,
  title = "Central de Comando",
  subtitle = "Visão geral e ações prioritárias do seu funil comercial",
  headerRight,
}: DashboardProps) {
  const navigate = useNavigate();
  const crmClient = useOptionalCrmClient();
  const { resolvedTheme } = useTheme();
  const effectiveClientId = fixedClientId || crmClient?.selectedClientId || "";
  const selectedClient = crmClient?.selectedClient || null;
  const resolvedClientName = fixedClientName || selectedClient?.name || effectiveClientId;

  const [periodDays, setPeriodDays] = useState(14);
  const { data, isLoading, error } = useDashboard(effectiveClientId);
  const usage = useEvolutionUsageReport(effectiveClientId || null, periodDays * 2);
  const { data: campaigns = [] } = useCampanhas(effectiveClientId || undefined);

  const summary = data?.summary;
  const isDark = resolvedTheme !== "light";
  const axisColor = isDark ? "rgba(255,255,255,0.52)" : "rgba(71,85,105,0.92)";
  const gridColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(148,163,184,0.28)";
  const tooltipStyle = {
    background: isDark ? "rgba(8,12,32,0.96)" : "rgba(255,255,255,0.98)",
    border: `1px solid ${isDark ? "rgba(255,255,255,0.12)" : "rgba(226,232,240,0.95)"}`,
    color: isDark ? "rgba(255,255,255,0.92)" : "rgb(15 23 42)",
    borderRadius: 14,
  };

  // Instâncias ativas do tenant
  const connectedInstances = (selectedClient?.n8n_settings?.evolution_instances || []).filter(
    (i: any) => i.active !== false
  );
  const totalChips = connectedInstances.length;

  // Enviados por dia
  const sentByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of usage.data?.items ?? []) {
      map.set(row.dia, (map.get(row.dia) ?? 0) + (row.enviados ?? 0));
    }
    return Array.from(map, ([dia, enviados]) => ({ dia, enviados })).sort((a, b) =>
      a.dia.localeCompare(dia)
    );
  }, [usage.data]);

  // Respostas por dia
  const repliesByDay = useMemo(() => {
    const map = new Map<string, number | null | undefined>();
    for (const p of data?.leadsByDay ?? []) map.set(p.day, p.respostas);
    return map;
  }, [data]);

  const { sentCurrent, sentDelta, currentSeries } = useMemo(() => {
    const withReplies = sentByDay.map((r) => ({ ...r, respostas: repliesByDay.get(r.dia) ?? undefined }));
    if (withReplies.length === 0) {
      return { sentCurrent: null as number | null, sentDelta: null as number | null, currentSeries: [] as typeof withReplies };
    }
    const half = withReplies.slice(-periodDays);
    const prev = withReplies.slice(0, Math.max(0, withReplies.length - periodDays));
    const sum = (arr: typeof withReplies) => arr.reduce((s, r) => s + r.enviados, 0);
    return { sentCurrent: sum(half), sentDelta: pctDelta(sum(half), sum(prev)), currentSeries: half };
  }, [sentByDay, repliesByDay, periodDays]);

  const hasUsage = (usage.data?.items?.length ?? 0) > 0;

  // Composição por temperatura
  const tempData = useMemo(
    () => (data?.temperatureBreakdown ?? []).filter((t) => t.value > 0),
    [data]
  );

  // Pipeline de vendas
  const funnelSteps = useMemo(() => {
    return [
      {
        id: "novos",
        stage: "1. Novos Leads",
        value: summary?.totalLeads,
        icon: Inbox,
        colorClass: "text-sky-600 dark:text-sky-400",
        bgClass: "bg-sky-500/10 border-sky-500/20 hover:border-sky-500/40",
        href: "/crm/banco-de-dados",
        hint: "Base importada",
      },
      {
        id: "contato",
        stage: "2. Em Atendimento",
        value: summary?.contactedLeads,
        icon: MessageSquare,
        colorClass: "text-indigo-600 dark:text-indigo-400",
        bgClass: "bg-indigo-500/10 border-indigo-500/20 hover:border-indigo-500/40",
        href: "/crm/whatsapp",
        hint: "Conversas ativas",
      },
      {
        id: "qualificados",
        stage: "3. Qualificados / Proposta",
        value: summary?.qualifiedLeads,
        icon: Star,
        colorClass: "text-amber-600 dark:text-amber-400",
        bgClass: "bg-amber-500/10 border-amber-500/20 hover:border-amber-500/40",
        href: "/crm/leads",
        hint: "Interesse confirmado",
      },
      {
        id: "fechados",
        stage: "4. Vendas Fechadas",
        value: summary?.conversions,
        icon: Trophy,
        colorClass: "text-emerald-600 dark:text-emerald-400",
        bgClass: "bg-emerald-500/10 border-emerald-500/20 hover:border-emerald-500/40",
        href: "/crm/leads",
        hint: "Clientes convertidos",
      },
    ];
  }, [summary]);

  const handleExportExcel = () => {
    const cell = (v: number | null | undefined) =>
      v == null || (typeof v === "number" && !Number.isFinite(v)) ? DASH : v;
    const wb = XLSX.utils.book_new();
    const kpis = [
      ["Métrica", "Valor"],
      ["Mensagens enviadas (período)", cell(sentCurrent)],
      ["Taxa de resposta (%)", cell(summary?.responseRate)],
      ["Leads quentes", cell(summary?.hotLeads)],
      ["Leads sem contato +3 dias", cell(summary?.noContact3d)],
      ["Conversão (%)", cell(summary?.conversionRate)],
      ["Total de leads", cell(summary?.totalLeads)],
      ["Em contato", cell(summary?.contactedLeads)],
      ["Qualificados", cell(summary?.qualifiedLeads)],
      ["Fechamentos", cell(summary?.conversions)],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(kpis), "KPIs");
    const camp = [
      ["Campanha", "Status", "Enviados", "Respostas", "Conversão (%)"],
      ...campaigns.map((c) => [c.name, c.status, cell(c.sent), cell(c.replies), cell(c.conversionRate)]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(camp), "Campanhas");
    XLSX.writeFile(wb, `dashboard-${effectiveClientId || "cliente"}.xlsx`);
  };

  const handleExportPdf = () => window.print();

  if (!effectiveClientId) {
    return (
      <PageShell title={title} subtitle={subtitle} compactHero spacing="space-y-4">
        <EmptyState title="Selecione uma empresa" description="Escolha um cliente para ver o painel." />
      </PageShell>
    );
  }

  return (
    <PageShell
      title={title}
      subtitle={`${subtitle} · ${resolvedClientName}`}
      compactHero
      spacing="space-y-6"
      headerRight={
        headerRight ?? (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportPdf}>
              <FileText className="mr-1 h-4 w-4" /> Exportar PDF
            </Button>
            <Button size="sm" onClick={handleExportExcel}>
              <FileSpreadsheet className="mr-1 h-4 w-4" /> Exportar Excel
            </Button>
          </div>
        )
      }
    >
      <ErrorMessage message={error ? (error as Error).message : null} variant="banner" />

      {isLoading ? (
        <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">
          Carregando central de comando...
        </div>
      ) : (
        <>
          {/* ── BLOCO A: Barra Superior de Atalhos Rápidos (Ações do Dia) ── */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl bg-card border border-border/80 shadow-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1 mr-1">
                Ações Rápidas:
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/crm/campanhas")}
                className="h-8 gap-1.5 rounded-xl border-indigo-500/30 bg-indigo-500/5 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/15 transition-all text-xs font-semibold"
              >
                <Rocket className="h-3.5 w-3.5 text-indigo-500" />
                Nova Campanha
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/crm/banco-de-dados")}
                className="h-8 gap-1.5 rounded-xl border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/15 transition-all text-xs font-semibold"
              >
                <Inbox className="h-3.5 w-3.5 text-emerald-500" />
                Importar Planilha
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/crm/followup")}
                className="h-8 gap-1.5 rounded-xl border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300 hover:bg-amber-500/15 transition-all text-xs font-semibold"
              >
                <RefreshCw className="h-3.5 w-3.5 text-amber-500" />
                Ativar Follow-up
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/crm/agente")}
                className="h-8 gap-1.5 rounded-xl border-purple-500/30 bg-purple-500/5 text-purple-700 dark:text-purple-300 hover:bg-purple-500/15 transition-all text-xs font-semibold"
              >
                <Bot className="h-3.5 w-3.5 text-purple-500" />
                Agente IA
              </Button>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <Select value={String(periodDays)} onValueChange={(val) => setPeriodDays(Number(val))}>
                <SelectTrigger className="h-8 w-[130px] text-xs rounded-xl border-border bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Últimos 7 dias</SelectItem>
                  <SelectItem value="14">Últimos 14 dias</SelectItem>
                  <SelectItem value="30">Últimos 30 dias</SelectItem>
                  <SelectItem value="90">Últimos 90 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ── BLOCO B: Radar do Dia (Hero Cards Clicáveis) ── */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Radar do Dia · Oportunidades & Alertas
              </h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* 1. Oportunidades Quentes */}
              <button
                type="button"
                onClick={() => navigate("/crm/whatsapp")}
                className="group flex flex-col justify-between rounded-2xl border border-red-500/20 bg-red-500/[0.04] p-4 text-left transition-all hover:border-red-500/50 hover:bg-red-500/[0.08] hover:shadow-md"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 group-hover:scale-110 transition-transform">
                      <Flame className="h-4 w-4" />
                    </span>
                    <Badge variant="outline" className="border-red-500/30 text-red-700 dark:text-red-300 text-[10px] font-semibold">
                      Pronto p/ Fechar
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground">Oportunidades Quentes</p>
                    <p className="text-2xl font-extrabold text-foreground tracking-tight">
                      {formatMetric(summary?.hotLeads)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-red-500/15 pt-2.5 text-xs font-medium text-red-600 dark:text-red-400">
                  <span>Ver conversas</span>
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </div>
              </button>

              {/* 2. Atendimentos em Andamento */}
              <button
                type="button"
                onClick={() => navigate("/crm/whatsapp")}
                className="group flex flex-col justify-between rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.04] p-4 text-left transition-all hover:border-indigo-500/50 hover:bg-indigo-500/[0.08] hover:shadow-md"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
                      <MessageSquare className="h-4 w-4" />
                    </span>
                    <Badge variant="outline" className="border-indigo-500/30 text-indigo-700 dark:text-indigo-300 text-[10px] font-semibold">
                      {formatMetric(summary?.responseRate, "pct")} resposta
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground">Atendimentos em Andamento</p>
                    <p className="text-2xl font-extrabold text-foreground tracking-tight">
                      {formatMetric(sentCurrent)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-indigo-500/15 pt-2.5 text-xs font-medium text-indigo-600 dark:text-indigo-400">
                  <span>Abrir WhatsApp</span>
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </div>
              </button>

              {/* 3. Leads Parados (+3 dias) — com CTA direto de Resgate */}
              <div className="flex flex-col justify-between rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-4 text-left transition-all hover:border-amber-500/60 hover:shadow-md">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                      <AlertCircle className="h-4 w-4" />
                    </span>
                    <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200 text-[10px] font-bold">
                      +3 dias sem contato
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground">Leads Parados</p>
                    <p className="text-2xl font-extrabold text-foreground tracking-tight">
                      {formatMetric(summary?.noContact3d)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 border-t border-amber-500/20 pt-2.5">
                  <Button
                    size="sm"
                    onClick={() => navigate("/crm/followup")}
                    className="w-full h-8 gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shadow-xs"
                  >
                    <Rocket className="h-3.5 w-3.5" />
                    Iniciar Resgate
                  </Button>
                </div>
              </div>

              {/* 4. Saúde dos Canais (WhatsApp) */}
              <button
                type="button"
                onClick={() => navigate("/crm/chips-whatsapp")}
                className="group flex flex-col justify-between rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4 text-left transition-all hover:border-emerald-500/50 hover:bg-emerald-500/[0.08] hover:shadow-md"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                      <Smartphone className="h-4 w-4" />
                    </span>
                    <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[10px] font-semibold gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      {totalChips > 0 ? "Operacional" : "Sem chip"}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground">Canais WhatsApp Conectados</p>
                    <p className="text-2xl font-extrabold text-foreground tracking-tight">
                      {totalChips} {totalChips === 1 ? "chip ativo" : "chips ativos"}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-emerald-500/15 pt-2.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  <span>Gerenciar chips</span>
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </div>
              </button>
            </div>
          </section>

          {/* ── BLOCO C: Pipeline Vivo de Vendas (Funil 100% Clicável) ── */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Pipeline Vivo de Vendas
                </h2>
                <p className="text-xs text-muted-foreground">
                  Clique em qualquer etapa para acessar diretamente os contatos e conversas correspondentes.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {funnelSteps.map((step, i) => {
                const IconComponent = step.icon;
                const prev = i > 0 ? funnelSteps[i - 1] : null;
                const drop =
                  prev && prev.value != null && prev.value > 0 && step.value != null
                    ? Math.round(((prev.value - step.value) / prev.value) * 100)
                    : null;

                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => navigate(step.href)}
                    className={cn(
                      "group relative flex flex-col justify-between rounded-2xl border p-4 text-left transition-all hover:scale-[1.02] hover:shadow-md cursor-pointer",
                      step.bgClass
                    )}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className={cn("flex h-8 w-8 items-center justify-center rounded-xl bg-background/80 shadow-xs", step.colorClass)}>
                          <IconComponent className="h-4 w-4" />
                        </span>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {step.hint}
                        </span>
                      </div>

                      <div>
                        <p className="text-xs font-bold text-foreground">{step.stage}</p>
                        <p className="text-2xl font-extrabold text-foreground tracking-tight mt-0.5">
                          {formatMetric(step.value)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
                      <span>{drop != null ? `↓ ${drop}% da etapa anterior` : "Etapa inicial"}</span>
                      <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1 text-foreground" />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* ── BLOCO D: Gráficos de Engajamento & Desempenho ── */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Enviados vs Respostas por Dia */}
            <Card className="rounded-2xl border border-border/80 shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-indigo-500" />
                  Disparos vs Respostas por Dia
                </CardTitle>
                <CardDescription className="text-xs">
                  Volume diário de mensagens disparadas e respostas capturadas no período.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {hasUsage ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={currentSeries} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" stroke={gridColor} />
                      <XAxis dataKey="dia" tickFormatter={formatDiaLabel} tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
                      <Tooltip contentStyle={tooltipStyle} labelFormatter={(l) => `Dia ${formatDiaLabel(String(l))}`} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="enviados" name="Enviados" fill={SOLID.indigo} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="respostas" name="Respostas" fill={SOLID.orange} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState title="Sem envios no período" description="Nenhum disparo registrado nos últimos dias." />
                )}
              </CardContent>
            </Card>

            {/* Composição por Temperatura */}
            <Card className="rounded-2xl border border-border/80 shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Flame className="h-4 w-4 text-red-500" />
                  Composição da Base por Temperatura
                </CardTitle>
                <CardDescription className="text-xs">
                  Distribuição de leads entre Quente, Morno, Frio e Sem sinal.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {tempData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={tempData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                        {tempData.map((t) => (
                          <Cell key={t.name} fill={TEMP_COLORS[t.name] ?? SOLID.slate} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState title="Sem dados no período" description="A base ainda não possui leads classificados por temperatura." />
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Desempenho por Campanha ── */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Desempenho por Campanha
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/crm/campanhas")}
                className="text-xs text-primary hover:text-primary gap-1"
              >
                <span>Ver todas as campanhas</span>
                <ArrowRight className="h-3 w-3" />
              </Button>
            </div>

            <Card className="rounded-2xl border border-border/80 shadow-xs overflow-hidden">
              <CardContent className="p-0">
                {campaigns.length === 0 ? (
                  <EmptyState title="Nenhuma campanha ativa" description="Crie sua primeira campanha de disparos para visualizar métricas aqui." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/70 text-left text-xs uppercase tracking-wide text-muted-foreground bg-muted/20">
                          <th className="px-4 py-3">Campanha</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3 text-right">Enviados</th>
                          <th className="px-4 py-3 text-right">Respostas</th>
                          <th className="px-4 py-3 text-right">Conversão</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {campaigns.map((c) => (
                          <tr
                            key={c.id}
                            onClick={() => navigate("/crm/campanhas")}
                            className="hover:bg-muted/30 transition-colors cursor-pointer"
                          >
                            <td className="px-4 py-3 font-semibold text-foreground flex items-center gap-2">
                              <Rocket className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                              <span className="truncate hover:underline">{c.name}</span>
                            </td>
                            <td className="px-4 py-3">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] font-semibold",
                                  c.status === "active"
                                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                    : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                                )}
                              >
                                {c.status === "active" ? "Ativa" : c.status === "paused" ? "Pausada" : c.status}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-right text-muted-foreground font-mono">{formatMetric(c.sent)}</td>
                            <td className="px-4 py-3 text-right text-muted-foreground font-mono">{formatMetric(c.replies)}</td>
                            <td className="px-4 py-3 text-right text-muted-foreground font-mono font-medium">{formatMetric(c.conversionRate, "pct")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </PageShell>
  );
}
