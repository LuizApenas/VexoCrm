import { useMemo } from "react";
import {
  Activity,
  AlertTriangle,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  BarChart2,
  TrendingUp,
  PieChart as PieChartIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useEvolutionUsageReport } from "@/hooks/useReports";
import { type LeadClient } from "@/hooks/useLeadClients";

const REPORT_DAYS = 14;
const CHIP_PALETTE = ["#6366F1", "#ff7a1a", "#22D3EE", "#8b5cf6", "#f43f5e", "#10b981"];

function formatDiaLabel(dia: string): string {
  const parts = String(dia).split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}` : dia;
}

interface ChipsHealthReportProps {
  tenant: LeadClient;
}

export function ChipsHealthReport({ tenant }: ChipsHealthReportProps) {
  const { resolvedTheme } = useTheme();
  const activeClientId = tenant.id;

  const { data, isLoading } = useEvolutionUsageReport(activeClientId || null, REPORT_DAYS);
  const items = data?.items ?? [];

  const tenantInstances = useMemo(() => {
    return tenant?.n8n_settings?.evolution_instances ?? [];
  }, [tenant]);

  // Pivot chips list
  const chips = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of items) {
      if (!map.has(row.chip_id)) map.set(row.chip_id, row.chip_label);
    }
    return Array.from(map, ([id, label]) => ({ id, label }));
  }, [items]);

  // Pivot values for Recharts (14 dias)
  const chartData = useMemo(() => {
    const byDay = new Map<string, Record<string, number | string>>();
    for (const row of items) {
      if (!byDay.has(row.dia)) byDay.set(row.dia, { dia: row.dia });
      byDay.get(row.dia)![row.chip_id] = row.enviados;
    }
    const rows = Array.from(byDay.values()).sort((a, b) =>
      String(a.dia).localeCompare(String(b.dia))
    );
    for (const r of rows) {
      for (const c of chips) {
        if (r[c.id] == null) r[c.id] = 0;
      }
    }
    return rows;
  }, [items, chips]);

  // Donut chart calculations: total volume per chip
  const pieData = useMemo(() => {
    const map: Record<string, { name: string; value: number }> = {};
    for (const row of items) {
      if (!map[row.chip_id]) {
        map[row.chip_id] = { name: row.chip_label, value: 0 };
      }
      map[row.chip_id].value += row.enviados;
    }
    return Object.values(map).sort((a, b) => b.value - a.value);
  }, [items]);

  // Alerta de Concentração: Últimos 7 dias
  const concentrationAlert = useMemo(() => {
    if (items.length === 0) return null;

    // Pega os últimos 7 dias da lista ordenada de dias
    const uniqueDays = Array.from(new Set(items.map((i) => i.dia))).sort();
    const last7Days = new Set(uniqueDays.slice(-7));

    let total7d = 0;
    const chipTotals7d: Record<string, { label: string; count: number }> = {};

    for (const row of items) {
      if (last7Days.has(row.dia)) {
        total7d += row.enviados;
        if (!chipTotals7d[row.chip_id]) {
          chipTotals7d[row.chip_id] = { label: row.chip_label, count: 0 };
        }
        chipTotals7d[row.chip_id].count += row.enviados;
      }
    }

    if (total7d < 10) return null; // Pouco volume para gerar alerta

    for (const chip of Object.values(chipTotals7d)) {
      const pct = Math.round((chip.count / total7d) * 100);
      if (pct > 50) {
        return {
          chipLabel: chip.label,
          percent: pct,
          total: chip.count,
          totalAll: total7d,
        };
      }
    }

    return null;
  }, [items]);

  // KPI calculations
  const kpis = useMemo(() => {
    let totalEnvios = 0;
    for (const row of items) {
      totalEnvios += row.enviados;
    }

    const mediaDiaria = chartData.length > 0 ? Math.round(totalEnvios / chartData.length) : 0;
    const liderChip = pieData[0]?.name || "Nenhum";

    let rotationStatus = "Estável (1 Chip)";
    if (pieData.length > 1) {
      const maxVal = pieData[0].value;
      const minVal = pieData[pieData.length - 1].value;
      if (maxVal > minVal * 4 && minVal > 0) {
        rotationStatus = "Desbalanceado";
      } else {
        rotationStatus = "Balanceado (Excelente)";
      }
    }

    return { totalEnvios, mediaDiaria, liderChip, rotationStatus };
  }, [items, chartData, pieData]);

  const isDark = resolvedTheme !== "light";
  const axisColor = isDark ? "rgba(255,255,255,0.52)" : "rgba(71,85,105,0.92)";
  const gridColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(148,163,184,0.28)";
  const tooltipStyle = isDark
    ? {
        background: "rgba(8, 12, 32, 0.96)",
        border: "1px solid rgba(255, 255, 255, 0.12)",
        color: "rgba(255,255,255,0.92)",
        borderRadius: 16,
        boxShadow: "0 30px 80px rgba(0,0,0,0.35)",
      }
    : {
        background: "rgba(255,255,255,0.98)",
        border: "1px solid rgba(226,232,240,0.95)",
        color: "rgb(15 23 42)",
        borderRadius: 16,
        boxShadow: "0 20px 50px rgba(15,23,42,0.12)",
      };

  if (isLoading) {
    return (
      <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
        Carregando métricas de saúde dos chips...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* AVISO CRÍTICO DE CONCENTRAÇÃO DE VOLUME (>50% nos últimos 7 dias) */}
      {concentrationAlert && (
        <div
          data-testid="chip-concentration-alert"
          className="flex items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-900 dark:text-amber-200 shadow-sm"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="flex-1 text-xs sm:text-sm">
            <p className="font-semibold">
              Chip {concentrationAlert.chipLabel} concentrou {concentrationAlert.percent}% dos envios. Distribua o volume.
            </p>
            <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5">
              Concentração excessiva aumenta o risco de bloqueio pelo WhatsApp. Adicione ou ative chips secundários para alternar os envios.
            </p>
          </div>
        </div>
      )}

      {/* KPI Analytics Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-slate-200/80 bg-white/90 shadow-[0_10px_30px_rgba(15,23,42,0.04)] dark:border-white/5 dark:bg-white/[0.02] rounded-2xl">
          <CardContent className="p-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Disparado</p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{kpis.totalEnvios.toLocaleString("pt-BR")}</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Últimos {REPORT_DAYS} dias</p>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-500 flex items-center justify-center shrink-0">
              <BarChart2 className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white/90 shadow-[0_10px_30px_rgba(15,23,42,0.04)] dark:border-white/5 dark:bg-white/[0.02] rounded-2xl">
          <CardContent className="p-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Média / Dia</p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{kpis.mediaDiaria.toLocaleString("pt-BR")}</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Disparos ativos/dia</p>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
              <TrendingUp className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white/90 shadow-[0_10px_30px_rgba(15,23,42,0.04)] dark:border-white/5 dark:bg-white/[0.02] rounded-2xl">
          <CardContent className="p-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Chip Líder</p>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-1 truncate max-w-[140px]">{kpis.liderChip}</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Maior tráfego de saída</p>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
              <Smartphone className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white/90 shadow-[0_10px_30px_rgba(15,23,42,0.04)] dark:border-white/5 dark:bg-white/[0.02] rounded-2xl">
          <CardContent className="p-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Balanceamento</p>
              <h3 className={`text-base font-bold mt-1 ${kpis.rotationStatus.includes("Desbalanceado") ? "text-amber-500" : "text-emerald-500"}`}>
                {kpis.rotationStatus}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Distribuição do pool</p>
            </div>
            <div className="h-12 w-12 rounded-2xl bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-500 flex items-center justify-center shrink-0">
              <Activity className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos de Volume e Distribuição */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-slate-200/80 bg-white/90 shadow-[0_10px_30px_rgba(15,23,42,0.04)] dark:border-white/5 dark:bg-white/[0.02] rounded-2xl">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-indigo-500" />
                  Volume Diário por Chip ({REPORT_DAYS} Dias)
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Distribuição diária de mensagens disparadas por cada chip conectado.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {chartData.length === 0 ? (
              <div className="h-[280px] flex items-center justify-center text-xs text-muted-foreground">
                Nenhum disparo registrado nos últimos {REPORT_DAYS} dias.
              </div>
            ) : (
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                    <XAxis dataKey="dia" tickFormatter={formatDiaLabel} stroke={axisColor} tick={{ fontSize: 11 }} />
                    <YAxis stroke={axisColor} tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelFormatter={(label) => `Data: ${formatDiaLabel(String(label))}`}
                    />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                    {chips.map((c, idx) => (
                      <Bar
                        key={c.id}
                        dataKey={c.id}
                        name={c.label}
                        stackId="chips"
                        fill={CHIP_PALETTE[idx % CHIP_PALETTE.length]}
                        radius={idx === chips.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white/90 shadow-[0_10px_30px_rgba(15,23,42,0.04)] dark:border-white/5 dark:bg-white/[0.02] rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <PieChartIcon className="h-4 w-4 text-amber-500" />
              Distribuição Percentual de Volume
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Participação de cada chip no volume total de saída.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {pieData.length === 0 ? (
              <div className="h-[280px] flex items-center justify-center text-xs text-muted-foreground">
                Sem dados de envio.
              </div>
            ) : (
              <div className="h-[280px] w-full flex flex-col items-center justify-center">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {pieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHIP_PALETTE[index % CHIP_PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-2 justify-center mt-2 max-h-[70px] overflow-y-auto">
                  {pieData.map((entry, index) => (
                    <div key={entry.name} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                      <span
                        className="w-2.5 h-2.5 rounded-full inline-block"
                        style={{ backgroundColor: CHIP_PALETTE[index % CHIP_PALETTE.length] }}
                      />
                      <span className="font-medium truncate max-w-[90px]">{entry.name}:</span>
                      <span className="text-slate-400">
                        {kpis.totalEnvios > 0 ? Math.round((entry.value / kpis.totalEnvios) * 100) : 0}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Saúde e Capacidade dos Chips (Tempo Real) */}
      <Card className="border-slate-200/80 bg-white/90 shadow-[0_10px_30px_rgba(15,23,42,0.04)] dark:border-white/5 dark:bg-white/[0.02] rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-500" />
            Saúde e Capacidade dos Chips (Tempo Real)
          </CardTitle>
          <CardDescription className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Status operacional, cotas diárias de segurança e consumo de mensagens hoje.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tenantInstances.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">Nenhum chip conectado neste tenant.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-200/80 dark:border-white/5">
                    <TableHead className="text-xs font-semibold">Identificador</TableHead>
                    <TableHead className="text-xs font-semibold">Estado</TableHead>
                    <TableHead className="text-xs font-semibold">Cota Diária</TableHead>
                    <TableHead className="text-xs font-semibold">Uso Hoje</TableHead>
                    <TableHead className="text-xs font-semibold">Saúde</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenantInstances.map((inst: any) => {
                    const chipState = inst.chipState || "warm";
                    const isWarm = chipState === "warm";
                    const defaultLimit = isWarm ? 500 : 100;
                    const dailyLimit = inst.dailyLimitOverride ? parseInt(inst.dailyLimitOverride, 10) : defaultLimit;
                    const todayStr = new Date().toISOString().slice(0, 10);
                    const todayUsage = items.find((i) => i.dia === todayStr && i.chip_id === inst.id)?.enviados || 0;
                    const usagePercent = Math.min(100, Math.round((todayUsage / dailyLimit) * 100));

                    return (
                      <TableRow key={inst.id} className="border-slate-200/80 dark:border-white/5 text-xs">
                        <TableCell className="font-medium text-slate-900 dark:text-white">
                          {inst.name || inst.id}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={isWarm ? "bg-amber-500/10 text-amber-500 border-amber-500/20" : "bg-blue-500/10 text-blue-500 border-blue-500/20"}>
                            {isWarm ? "Aquecido" : "Frio / Novo"}
                          </Badge>
                        </TableCell>
                        <TableCell>{dailyLimit} msgs/dia</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>{todayUsage} ({usagePercent}%)</span>
                            <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${usagePercent > 80 ? "bg-rose-500" : usagePercent > 50 ? "bg-amber-500" : "bg-emerald-500"}`}
                                style={{ width: `${usagePercent}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {usagePercent < 80 ? (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                <span className="text-emerald-600 dark:text-emerald-400 font-medium">Saudável</span>
                              </>
                            ) : (
                              <>
                                <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                                <span className="text-amber-600 dark:text-amber-400 font-medium">Atenção</span>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
