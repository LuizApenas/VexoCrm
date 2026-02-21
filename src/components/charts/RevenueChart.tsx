import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const data = [
  { month: "Ago", receita: 82000, meta: 90000 },
  { month: "Set", receita: 78000, meta: 95000 },
  { month: "Out", receita: 95000, meta: 100000 },
  { month: "Nov", receita: 110000, meta: 105000 },
  { month: "Dez", receita: 125000, meta: 115000 },
  { month: "Jan", receita: 140000, meta: 120000 },
  { month: "Fev", receita: 157000, meta: 130000 },
];

export function RevenueChart() {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="gradientReceita" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(187, 80%, 48%)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(187, 80%, 48%)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 30%, 20%)" />
        <XAxis dataKey="month" tick={{ fill: "hsl(215, 20%, 55%)", fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "hsl(215, 20%, 55%)", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$ ${v / 1000}k`} />
        <Tooltip
          contentStyle={{ background: "hsl(222, 47%, 14%)", border: "1px solid hsl(222, 30%, 20%)", borderRadius: 8, color: "hsl(210, 40%, 98%)" }}
          formatter={(value: number) => [`R$ ${(value / 1000).toFixed(0)}k`, ""]}
        />
        <Area type="monotone" dataKey="meta" stroke="hsl(215, 20%, 35%)" strokeDasharray="5 5" fill="none" strokeWidth={2} />
        <Area type="monotone" dataKey="receita" stroke="hsl(187, 80%, 48%)" fill="url(#gradientReceita)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
