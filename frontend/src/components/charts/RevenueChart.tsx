import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTheme } from "next-themes";

interface RevenueChartProps {
  data: Array<{
    day: string;
    leads: number;
    qualifiedLeads: number;
  }>;
}

export function RevenueChart({ data }: RevenueChartProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== "light";
  const axisColor = isDark ? "rgba(255,255,255,0.52)" : "rgba(71,85,105,0.92)";
  const gridColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(148,163,184,0.28)";
  const tooltipStyle = isDark
    ? {
        background: "rgba(8, 12, 32, 0.96)",
        border: "1px solid rgba(255, 255, 255, 0.12)",
        color: "rgba(255,255,255,0.92)",
        boxShadow: "0 30px 80px rgba(0,0,0,0.35)",
      }
    : {
        background: "rgba(255,255,255,0.98)",
        border: "1px solid rgba(226,232,240,0.95)",
        color: "rgb(15 23 42)",
        boxShadow: "0 20px 50px rgba(15,23,42,0.12)",
      };

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 rounded-[1.5rem] bg-[radial-gradient(circle_at_20%_20%,rgba(139,92,246,0.16),transparent_28%),radial-gradient(circle_at_82%_16%,rgba(34,211,238,0.12),transparent_24%)]" />
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={{ top: 8, right: 4, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="leadsGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.78} />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.03} />
            </linearGradient>
            <linearGradient id="qualifiedGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#67e8f9" stopOpacity={0.72} />
              <stop offset="100%" stopColor="#67e8f9" stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" stroke={gridColor} />
          <XAxis
            dataKey="day"
            tick={{ fill: axisColor, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: axisColor, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={42}
          />
          <Tooltip
            contentStyle={{
              ...tooltipStyle,
              borderRadius: 16,
            }}
            labelStyle={{ color: isDark ? "rgba(255,255,255,0.7)" : "rgba(71,85,105,0.9)" }}
            itemStyle={{ color: isDark ? "rgba(255,255,255,0.9)" : "rgb(15 23 42)" }}
          />
          <Area
            type="monotone"
            dataKey="leads"
            stroke="#8b5cf6"
            strokeWidth={3}
            fill="url(#leadsGradient)"
            fillOpacity={1}
            dot={false}
            activeDot={{ r: 4, fill: "#8b5cf6" }}
          />
          <Area
            type="monotone"
            dataKey="qualifiedLeads"
            stroke="#67e8f9"
            strokeWidth={3}
            fill="url(#qualifiedGradient)"
            fillOpacity={1}
            dot={false}
            activeDot={{ r: 4, fill: "#67e8f9" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
