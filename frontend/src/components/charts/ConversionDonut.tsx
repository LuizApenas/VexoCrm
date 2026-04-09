import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { useTheme } from "next-themes";

interface ConversionDonutProps {
  data: Array<{
    name: string;
    value: number;
    color: string;
  }>;
}

export function ConversionDonut({ data }: ConversionDonutProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== "light";
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
    <div className="flex flex-col items-center">
      <ResponsiveContainer width="100%" height={150}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value" stroke="none">
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ ...tooltipStyle, borderRadius: 12, boxShadow: "0 18px 45px rgba(15,23,42,0.12)" }} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex gap-4 mt-2">
        {data.map((item) => (
          <div key={item.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
            <span>{item.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
