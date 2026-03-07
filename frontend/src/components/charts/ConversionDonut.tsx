import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const data = [
  { name: "Quente", value: 4, color: "hsl(0, 72%, 51%)" },
  { name: "Morno", value: 3, color: "hsl(32, 95%, 55%)" },
  { name: "Frio", value: 1, color: "hsl(217, 91%, 60%)" },
];

export function ConversionDonut() {
  return (
    <div className="flex flex-col items-center">
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value" stroke="none">
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: "hsl(230, 22%, 13%)", border: "1px solid hsl(230, 18%, 18%)", borderRadius: 8, color: "hsl(220, 20%, 92%)" }}
          />
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
