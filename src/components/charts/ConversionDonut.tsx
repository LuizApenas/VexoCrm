import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const data = [
  { name: "Convertidos", value: 31, color: "hsl(187, 80%, 48%)" },
  { name: "Em andamento", value: 45, color: "hsl(270, 60%, 55%)" },
  { name: "Perdidos", value: 24, color: "hsl(215, 20%, 35%)" },
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
            contentStyle={{ background: "hsl(222, 47%, 14%)", border: "1px solid hsl(222, 30%, 20%)", borderRadius: 8, color: "hsl(210, 40%, 98%)" }}
            formatter={(value: number) => [`${value}%`, ""]}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex gap-4 mt-2">
        {data.map((item) => (
          <div key={item.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
            <span>{item.name}</span>
            <span className="font-medium text-foreground">{item.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
