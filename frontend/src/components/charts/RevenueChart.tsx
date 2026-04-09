import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface RevenueChartProps {
  data: Array<{
    day: string;
    leads: number;
    qualifiedLeads: number;
  }>;
}

export function RevenueChart({ data }: RevenueChartProps) {
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
          <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
          <XAxis
            dataKey="day"
            tick={{ fill: "rgba(255,255,255,0.52)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "rgba(255,255,255,0.52)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={42}
          />
          <Tooltip
            contentStyle={{
              background: "rgba(8, 12, 32, 0.96)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: 16,
              color: "rgba(255,255,255,0.92)",
              boxShadow: "0 30px 80px rgba(0,0,0,0.35)",
            }}
            labelStyle={{ color: "rgba(255,255,255,0.7)" }}
            itemStyle={{ color: "rgba(255,255,255,0.9)" }}
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
