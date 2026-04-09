import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";
import { useTheme } from "next-themes";

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
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== "light";
  const axisColor = isDark ? "rgba(255,255,255,0.52)" : "rgba(71,85,105,0.92)";
  const tooltipStyle = isDark
    ? {
        background: "rgba(8, 12, 32, 0.96)",
        border: "1px solid rgba(255, 255, 255, 0.12)",
        color: "rgba(255,255,255,0.92)",
      }
    : {
        background: "rgba(255,255,255,0.98)",
        border: "1px solid rgba(226,232,240,0.95)",
        color: "rgb(15 23 42)",
      };

  return (
    <ResponsiveContainer width="100%" height={190}>
      <BarChart data={data} layout="vertical" margin={{ left: 10 }}>
        <XAxis type="number" tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} width={100} />
        <Tooltip contentStyle={{ ...tooltipStyle, borderRadius: 12, boxShadow: "0 18px 45px rgba(15,23,42,0.12)" }} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
          {data.map((entry, index) => (
            <Cell key={index} fill={colors[index % colors.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
