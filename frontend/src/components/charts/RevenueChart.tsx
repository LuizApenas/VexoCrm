import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface RevenueChartProps {
  data: Array<{
    day: string;
    leads: number;
    qualifiedLeads: number;
  }>;
}

export function RevenueChart({ data }: RevenueChartProps) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(230, 18%, 18%)" />
        <XAxis dataKey="day" tick={{ fill: "hsl(220, 12%, 50%)", fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "hsl(220, 12%, 50%)", fontSize: 12 }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: "hsl(230, 22%, 13%)", border: "1px solid hsl(230, 18%, 18%)", borderRadius: 8, color: "hsl(220, 20%, 92%)" }}
        />
        <Line type="monotone" dataKey="leads" stroke="hsl(32, 95%, 55%)" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="qualifiedLeads" stroke="hsl(217, 91%, 60%)" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
