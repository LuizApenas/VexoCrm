// VexoCrm/frontend/src/components/NotificationItem.tsx
// Single notification row for the Agente page.
// All visual structure is defined here; Agente only maps items to this component.

import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface NotificationItemData {
  id: string;
  type: string;
  title: string;
  description: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
}

interface NotificationItemProps {
  item: NotificationItemData;
  onClick: (item: NotificationItemData) => void;
}

export function NotificationItem({ item, onClick }: NotificationItemProps) {
  const timeAgo = formatDistanceToNow(new Date(item.created_at), {
    addSuffix: true,
    locale: ptBR,
  });

  return (
    <button
      type="button"
      onClick={() => onClick(item)}
      className={cn(
        "w-full text-left p-4 hover:bg-muted/40 transition-colors flex items-start gap-3",
        !item.read && "bg-primary/5"
      )}
    >
      {/* Read indicator dot */}
      <div
        className={cn(
          "mt-1 h-2.5 w-2.5 rounded-full shrink-0",
          item.read ? "bg-muted-foreground/40" : "bg-destructive"
        )}
      />

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        {/* Title row */}
        <div className="flex items-center justify-between gap-2">
          <p className={cn("text-sm", !item.read && "font-semibold text-foreground")}>
            {item.title}
          </p>
          <p className="text-[11px] text-muted-foreground whitespace-nowrap">{timeAgo}</p>
        </div>

        {/* Description */}
        {item.description && (
          <p className="text-xs text-muted-foreground break-words">{item.description}</p>
        )}

        {/* Footer: type badge + optional link */}
        <div className="flex items-center gap-2 pt-1">
          <Badge variant="outline" className="text-[11px] font-normal">
            {item.type}
          </Badge>
          {item.link && (
            <p className="text-[11px] text-primary inline-flex items-center gap-1">
              Abrir execução
              <ExternalLink className="h-3 w-3" />
            </p>
          )}
        </div>
      </div>
    </button>
  );
}
