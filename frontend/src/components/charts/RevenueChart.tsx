import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const data = [
  { day: "22/1", leads: 4, qualificados: 2, meta: 3 },
  { day: "25/1", leads: 6, qualificados: 4, meta: 3 },
  { day: "27/1", leads: 5, qualificados: 3, meta: 3 },
  { day: "1/2", leads: 7, qualificados: 5, meta: 3 },
  { day: "4/2", leads: 4, qualificados: 3, meta: 3 },
  { day: "6/2", leads: 5, qualificados: 4, meta: 3 },
  { day: "8/2", leads: 3, qualificados: 2, meta: 3 },
  { day: "11/2", leads: 6, qualificados: 3, meta: 3 },
  { day: "14/2", leads: 4, qualificados: 2, meta: 3 },
  { day: "16/2", leads: 2, qualificados: 1, meta: 3 },
];

export function RevenueChart() {
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
        <Line type="monotone" dataKey="qualificados" stroke="hsl(217, 91%, 60%)" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="meta" stroke="hsl(220, 12%, 35%)" strokeDasharray="5 5" strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
