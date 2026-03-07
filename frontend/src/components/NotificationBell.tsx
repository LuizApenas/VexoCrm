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
            "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors relative w-full",
            "text-sidebar-foreground hover:bg-sidebar-accent/10 hover:text-sidebar-accent-foreground"
          )}
        >
          <Bell className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Notificações</span>}
          {unreadCount > 0 && (
            <span className="absolute right-2 top-2 min-w-[8px] h-2 rounded-full bg-destructive" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent side="right" align="end" className="w-80 p-0">
        <div className="flex items-center justify-between p-3 border-b">
          <h4 className="text-sm font-semibold text-foreground">Notificações</h4>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllRead}>
              <CheckCheck className="h-3 w-3 mr-1" />
              Marcar todas como lidas
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[320px]">
          {items.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Nenhuma notificação
            </div>
          ) : (
            <div className="divide-y">
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleClick(item)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors flex gap-2",
                    !item.read && "bg-primary/5"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-xs leading-snug", !item.read && "font-medium text-foreground")}>
                      {item.title}
                    </p>
                    {item.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {item.description}
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(item.created_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </p>
                  </div>
                  {item.link && <ExternalLink className="h-3 w-3 shrink-0 mt-0.5 text-muted-foreground" />}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
