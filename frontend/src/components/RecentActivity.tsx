import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface RecentActivityItem {
  id: string;
  nome: string;
  tipo_cliente: string | null;
  cidade: string | null;
  status: string;
  data_hora: string;
}

interface RecentActivityProps {
  items: RecentActivityItem[];
}

const statusTone = (status: string) => {
  const value = status.trim().toLowerCase();

  if (value.includes("novo")) return "border-emerald-300/40 bg-emerald-100 text-emerald-700 dark:border-emerald-300/20 dark:bg-emerald-400/10 dark:text-emerald-200";
  if (value.includes("qualific")) return "border-cyan-300/40 bg-cyan-100 text-cyan-700 dark:border-cyan-300/20 dark:bg-cyan-400/10 dark:text-cyan-200";
  if (value.includes("fech")) return "border-violet-300/40 bg-violet-100 text-violet-700 dark:border-violet-300/20 dark:bg-violet-400/10 dark:text-violet-200";
  if (value.includes("progress") || value.includes("andamento")) {
    return "border-amber-300/40 bg-amber-100 text-amber-700 dark:border-amber-300/20 dark:bg-amber-400/10 dark:text-amber-100";
  }

  return "border-slate-200/80 bg-slate-100 text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/72";
};

export function RecentActivity({ items }: RecentActivityProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Leads recentes</h2>
          <p className="text-xs text-muted-foreground">
            Ultimos leads recebidos para a empresa selecionada
          </p>
        </div>
        <span className="rounded-full border border-slate-200/90 bg-white/80 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/45">
          Atualizado ao vivo
        </span>
      </div>

      {items.length === 0 ? (
        <div className="rounded-[1.25rem] border border-dashed border-slate-200/90 bg-slate-50/80 p-6 text-sm text-muted-foreground dark:border-white/10 dark:bg-white/[0.03]">
          Nenhuma atividade recente para a empresa selecionada.
        </div>
      ) : (
        <div className="overflow-hidden rounded-[1.35rem] border border-slate-200/90 bg-white/80 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1.3fr)_auto_auto] gap-4 border-b border-slate-200/90 px-5 py-3 text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500 dark:border-white/10 dark:text-white/40 md:grid">
            <span>Nome</span>
            <span>Perfil</span>
            <span>Status</span>
            <span>Atualizado</span>
          </div>

          <div className="max-h-[360px] overflow-y-auto">
            {items.map((item) => {
              const initials = item.nome
                .split(" ")
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part[0]?.toUpperCase())
                .join("");

              return (
                <div
                  key={item.id}
                  className="grid gap-3 border-b border-slate-200/80 px-4 py-4 last:border-b-0 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.3fr)_auto_auto] md:items-center md:px-5 dark:border-white/6"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/90 bg-slate-50 text-sm font-semibold text-cyan-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-cyan-200">
                      {initials || <Users className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{item.nome}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {item.cidade || "Cidade nao informada"}
                      </p>
                    </div>
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-sm text-foreground">
                      {item.tipo_cliente || "Sem perfil"}
                    </p>
                  </div>

                  <div>
                    <span
                      className={cn(
                        "inline-flex rounded-full border px-3 py-1 text-xs font-medium",
                        statusTone(item.status)
                      )}
                    >
                      {item.status}
                    </span>
                  </div>

                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(item.data_hora), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
