import { Bot, Clock } from "lucide-react";

const activities = [
  { text: "Lead qualificado pelo agente", detail: "João Silva - Residencial", time: "há 12min" },
  { text: "Workflow n8n executado", detail: "Nutrição automática", time: "há 28min" },
  { text: "Novo lead recebido", detail: "Maria Oliveira - Empresarial", time: "há 1h" },
  { text: "Agente respondeu WhatsApp", detail: "Carlos Souza", time: "há 2h" },
  { text: "Lead movido para SDR", detail: "Ana Costa - Rural", time: "há 3h" },
];

export function RecentActivity() {
  return (
    <div>
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-foreground">Atividade Recente</h2>
        <p className="text-xs text-muted-foreground">Últimas ações do agente</p>
      </div>
      <div className="space-y-3">
        {activities.map((a, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <Bot className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
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
