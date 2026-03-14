import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface TopSellersProps {
  data: Array<{
    name: string;
    value: number;
  }>;
}

export function TopSellers({ data }: TopSellersProps) {
  return (
    <div>
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-foreground">Leads por Perfil</h2>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data}>
          <XAxis dataKey="name" tick={{ fill: "hsl(220, 12%, 50%)", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "hsl(220, 12%, 50%)", fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: "hsl(230, 22%, 13%)", border: "1px solid hsl(230, 18%, 18%)", borderRadius: 8, color: "hsl(220, 20%, 92%)" }}
          />
          <Bar dataKey="value" fill="hsl(32, 95%, 55%)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
