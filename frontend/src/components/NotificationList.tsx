// VexoCrm/frontend/src/components/NotificationList.tsx
// Bordered panel with a header (title + count + action) and a list of items.
// Replaces the outer card + header div in Agente.

import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

interface NotificationListProps {
  /** Number of displayed items (shown in subtitle) */
  count: number;
  /** Number of unread items (used to enable/disable the mark-all button) */
  unreadCount: number;
  /** Called when the user clicks "Marcar todas como lidas" */
  onMarkAllRead: () => void;
  /** List items or empty/loading state */
  children: ReactNode;
}

export function NotificationList({ count, unreadCount, onMarkAllRead, children }: NotificationListProps) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div>
          <p className="text-sm font-medium text-foreground">Notificações</p>
          <p className="text-xs text-muted-foreground">{count} item(ns) filtrado(s)</p>
        </div>
        <Button variant="outline" size="sm" onClick={onMarkAllRead} disabled={unreadCount === 0}>
          Marcar todas como lidas
        </Button>
      </div>
      {children}
    </div>
  );
}
