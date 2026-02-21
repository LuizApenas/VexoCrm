import { cn } from "@/lib/utils";

const stages = [
  { name: "Prospecção", count: 142, value: "R$ 284k", percent: 100, color: "bg-primary" },
  { name: "Qualificação", count: 87, value: "R$ 521k", percent: 61, color: "bg-info" },
  { name: "Proposta", count: 53, value: "R$ 795k", percent: 37, color: "bg-success" },
  { name: "Negociação", count: 28, value: "R$ 672k", percent: 20, color: "bg-warning" },
  { name: "Fechamento", count: 12, value: "R$ 348k", percent: 8, color: "bg-destructive" },
];

export function PipelineChart() {
  return (
    <div className="space-y-3">
      {stages.map((stage) => (
        <div key={stage.name} className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{stage.name}</span>
            <span className="text-foreground font-medium">{stage.count} · {stage.value}</span>
          </div>
          <div className="h-2 rounded-full bg-secondary overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", stage.color)}
              style={{ width: `${stage.percent}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
