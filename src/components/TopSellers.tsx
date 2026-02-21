const sellers = [
  { initials: "AL", name: "Ana Lima", deals: 28, value: "R$ 312k", score: 78, color: "bg-primary" },
  { initials: "CM", name: "Carlos Mendes", deals: 22, value: "R$ 245k", score: 71, color: "bg-info" },
  { initials: "JR", name: "Juliana Rocha", deals: 19, value: "R$ 198k", score: 65, color: "bg-success" },
  { initials: "RT", name: "Rafael Torres", deals: 17, value: "R$ 176k", score: 63, color: "bg-warning" },
];

export function TopSellers() {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Top Vendedores</h2>
          <p className="text-xs text-muted-foreground">Mês atual</p>
        </div>
        <button className="text-xs text-primary hover:underline">Ver todos</button>
      </div>
      <div className="space-y-3">
        {sellers.map((s) => (
          <div key={s.initials} className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full ${s.color} flex items-center justify-center text-xs font-bold text-primary-foreground`}>
              {s.initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
              <p className="text-xs text-muted-foreground">{s.deals} deals · {s.value}</p>
            </div>
            <span className="text-sm font-semibold text-primary">{s.score}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
