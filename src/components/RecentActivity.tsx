import { CheckCircle, Send, Clock, Zap, Calendar, UserPlus } from "lucide-react";

const activities = [
  { icon: CheckCircle, text: "Lead qualificado", detail: "Tech Solutions SA", time: "há 12min", color: "text-success" },
  { icon: Send, text: "Proposta enviada", detail: "Grupo Meridian", time: "há 28min", color: "text-primary" },
  { icon: Clock, text: "Follow-up pendente", detail: "Alfa Varejo", time: "há 1h", color: "text-warning" },
  { icon: Zap, text: "Automação disparada", detail: "Nutrição Campanha Q1", time: "há 2h", color: "text-primary" },
  { icon: Calendar, text: "Reunião agendada", detail: "Pedro Carvalho", time: "há 2h", color: "text-info" },
  { icon: UserPlus, text: "Novo lead importado", detail: "Lista MQL Fev", time: "há 3h", color: "text-success" },
];

export function RecentActivity() {
  return (
    <div>
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-foreground">Atividade Recente</h2>
        <p className="text-xs text-muted-foreground">Últimas ações</p>
      </div>
      <div className="space-y-3">
        {activities.map((a, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <a.icon className={`h-4 w-4 mt-0.5 shrink-0 ${a.color}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground">{a.text}</p>
              <p className="text-xs text-muted-foreground truncate">{a.detail}</p>
            </div>
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">{a.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
