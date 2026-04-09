import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTheme } from "next-themes";

interface TopSellersProps {
  data: Array<{
    name: string;
    value: number;
  }>;
}

export function TopSellers({ data }: TopSellersProps) {
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
    <div>
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-foreground">Leads por Perfil</h2>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data}>
          <XAxis dataKey="name" tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ ...tooltipStyle, borderRadius: 12, boxShadow: "0 18px 45px rgba(15,23,42,0.12)" }} />
          <Bar dataKey="value" fill="hsl(32, 95%, 55%)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
