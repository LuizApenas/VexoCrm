import { Bot } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface RecentActivityItem {
  id: string;
  nome: string;
  tipo_cliente: string | null;
  status: string;
  temperature: string;
  data_hora: string;
}

interface RecentActivityProps {
  items: RecentActivityItem[];
}

export function RecentActivity({ items }: RecentActivityProps) {
  return (
    <div>
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-foreground">Atividade Recente</h2>
        <p className="text-xs text-muted-foreground">Últimos leads recebidos para a empresa selecionada</p>
      </div>
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          Nenhuma atividade recente para a empresa selecionada.
        </div>
      ) : (
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="flex items-start gap-2.5">
            <Bot className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground">{item.nome}</p>
              <p className="text-xs text-muted-foreground truncate">
                {[item.tipo_cliente || "Sem tipo", item.status].join(" • ")}
              </p>
            </div>
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">
              {formatDistanceToNow(new Date(item.data_hora), {
                addSuffix: true,
                locale: ptBR,
              })}
            </span>
          </div>
        ))}
      </div>
      )}
    </div>
  );
}
