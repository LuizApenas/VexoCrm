import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";

const data = [
  { name: "Recebidos", value: 120, color: "hsl(220, 12%, 60%)" },
  { name: "Filtrados", value: 98, color: "hsl(217, 91%, 60%)" },
  { name: "Em Qualificação", value: 82, color: "hsl(45, 93%, 58%)" },
  { name: "Qualificados", value: 45, color: "hsl(32, 95%, 55%)" },
  { name: "Contatados", value: 32, color: "hsl(142, 71%, 45%)" },
  { name: "Convertidos", value: 18, color: "hsl(160, 80%, 50%)" },
];

export function PipelineChart() {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} layout="vertical" margin={{ left: 10 }}>
        <XAxis type="number" tick={{ fill: "hsl(220, 12%, 50%)", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" tick={{ fill: "hsl(220, 12%, 50%)", fontSize: 11 }} axisLine={false} tickLine={false} width={100} />
        <Tooltip
          contentStyle={{ background: "hsl(230, 22%, 13%)", border: "1px solid hsl(230, 18%, 18%)", borderRadius: 8, color: "hsl(220, 20%, 92%)" }}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
          {data.map((entry, index) => (
            <Cell key={index} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
