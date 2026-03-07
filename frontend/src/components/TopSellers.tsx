import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";

const data = [
  { tipo: "Residencial", leads: 3 },
  { tipo: "Empresarial", leads: 2 },
  { tipo: "Rural", leads: 1 },
  { tipo: "Industrial", leads: 1 },
  { tipo: "Condomínio", leads: 1 },
];

export function TopSellers() {
  return (
    <div>
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-foreground">Leads por Tipo de Imóvel</h2>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data}>
          <XAxis dataKey="tipo" tick={{ fill: "hsl(220, 12%, 50%)", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "hsl(220, 12%, 50%)", fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: "hsl(230, 22%, 13%)", border: "1px solid hsl(230, 18%, 18%)", borderRadius: 8, color: "hsl(220, 20%, 92%)" }}
          />
          <Bar dataKey="leads" fill="hsl(32, 95%, 55%)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
