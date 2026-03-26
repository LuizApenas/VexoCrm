import { Bell, CheckCheck, ExternalLink } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface NotificationBellProps {
  collapsed?: boolean;
}

export function NotificationBell({ collapsed }: NotificationBellProps) {
  const { items, unreadCount, markAsRead, markAllRead } = useNotifications();

  const handleClick = (item: { id: string; link: string | null; read: boolean }) => {
    if (!item.read) markAsRead(item.id);
    if (item.link) window.open(item.link, "_blank");
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
            "text-sidebar-foreground hover:bg-white/[0.04] hover:text-sidebar-accent-foreground"
          )}
        >
          <Bell className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Notificacoes</span>}
          {unreadCount > 0 && <span className="absolute right-2 top-2 h-2 min-w-[8px] rounded-full bg-primary shadow-[0_0_10px_rgba(26,92,255,0.8)]" />}
        </button>
      </PopoverTrigger>
      <PopoverContent side="right" align="end" className="w-80 border-white/10 bg-[rgba(3,5,30,0.96)] p-0 text-foreground">
        <div className="flex items-center justify-between border-b border-white/8 p-3">
          <h4 className="text-sm font-semibold text-foreground">Notificacoes</h4>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-7 rounded-full text-xs" onClick={markAllRead}>
              <CheckCheck className="mr-1 h-3 w-3" />
              Marcar todas como lidas
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[320px]">
          {items.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Nenhuma notificacao</div>
          ) : (
            <div className="divide-y divide-white/8">
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleClick(item)}
                  className={cn(
                    "flex w-full gap-2 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.03]",
                    !item.read && "bg-primary/6"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-xs leading-snug", !item.read && "font-medium text-foreground")}>{item.title}</p>
                    {item.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.description}</p>}
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(item.created_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </p>
                  </div>
                  {item.link && <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
