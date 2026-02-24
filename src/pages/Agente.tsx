import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, ExternalLink, Filter, Search } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type ReadFilter = "all" | "unread" | "read";
type TypeFilter = "all" | "n8n_error" | "other";

export default function Agente() {
  const { items, unreadCount, loading, markAsRead, markAllRead } = useNotifications();
  const [search, setSearch] = useState("");
  const [readFilter, setReadFilter] = useState<ReadFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  const filteredItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return items.filter((item) => {
      const matchesRead =
        readFilter === "all" ||
        (readFilter === "unread" && !item.read) ||
        (readFilter === "read" && item.read);

      const matchesType =
        typeFilter === "all" ||
        (typeFilter === "n8n_error" && item.type === "n8n_error") ||
        (typeFilter === "other" && item.type !== "n8n_error");

      const matchesSearch =
        !normalizedSearch ||
        item.title.toLowerCase().includes(normalizedSearch) ||
        (item.description || "").toLowerCase().includes(normalizedSearch);

      return matchesRead && matchesType && matchesSearch;
    });
  }, [items, readFilter, search, typeFilter]);

  const handleNotificationClick = async (item: { id: string; link: string | null; read: boolean }) => {
    if (!item.read) {
      await markAsRead(item.id);
    }
    if (item.link) {
      window.open(item.link, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="flex-1 overflow-auto">
      <header className="h-14 border-b border-border flex items-center px-6 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center justify-between w-full gap-3">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Agente</h1>
            <p className="text-xs text-muted-foreground">Monitoramento de erros e alertas do n8n</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Não lidas</p>
            <p className="text-sm font-semibold text-foreground">{unreadCount}</p>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-4">
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Filter className="h-4 w-4" />
            Filtros
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
            <div className="relative lg:col-span-2">
              <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por título ou descrição"
                className="pl-9"
              />
            </div>

            <Select value={readFilter} onValueChange={(value) => setReadFilter(value as ReadFilter)}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="unread">Não lidas</SelectItem>
                <SelectItem value="read">Lidas</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as TypeFilter)}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="n8n_error">Erros n8n</SelectItem>
                <SelectItem value="other">Outros</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div>
              <p className="text-sm font-medium text-foreground">Notificações</p>
              <p className="text-xs text-muted-foreground">{filteredItems.length} item(ns) filtrado(s)</p>
            </div>
            <Button variant="outline" size="sm" onClick={markAllRead} disabled={unreadCount === 0}>
              Marcar todas como lidas
            </Button>
          </div>

          {loading ? (
            <div className="p-6 text-sm text-muted-foreground">Carregando notificações...</div>
          ) : filteredItems.length === 0 ? (
            <div className="p-8 text-center">
              <AlertTriangle className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-foreground">Nenhuma notificação encontrada</p>
              <p className="text-xs text-muted-foreground mt-1">
                Ajuste os filtros ou aguarde novos eventos do n8n.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => void handleNotificationClick(item)}
                  className={cn(
                    "w-full text-left p-4 hover:bg-muted/40 transition-colors flex items-start gap-3",
                    !item.read && "bg-primary/5"
                  )}
                >
                  <div
                    className={cn(
                      "mt-1 h-2.5 w-2.5 rounded-full shrink-0",
                      item.read ? "bg-muted-foreground/40" : "bg-destructive"
                    )}
                  />
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn("text-sm", !item.read && "font-semibold text-foreground")}>{item.title}</p>
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(item.created_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </span>
                    </div>
                    {item.description && (
                      <p className="text-xs text-muted-foreground break-words">{item.description}</p>
                    )}
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-[11px] px-2 py-0.5 rounded-full border border-border text-muted-foreground">
                        {item.type}
                      </span>
                      {item.link && (
                        <span className="text-[11px] text-primary inline-flex items-center gap-1">
                          Abrir execução
                          <ExternalLink className="h-3 w-3" />
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
