import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";

const colors = [
  "hsl(32, 95%, 55%)",
  "hsl(217, 91%, 60%)",
  "hsl(45, 93%, 58%)",
  "hsl(142, 71%, 45%)",
  "hsl(160, 80%, 50%)",
  "hsl(220, 12%, 60%)",
];

interface PipelineChartProps {
  data: Array<{
    name: string;
    value: number;
  }>;
}

export function PipelineChart({ data }: PipelineChartProps) {
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
            <Cell key={index} fill={colors[index % colors.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
