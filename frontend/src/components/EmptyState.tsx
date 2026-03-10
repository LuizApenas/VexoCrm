// VexoCrm/frontend/src/components/EmptyState.tsx
// Standardized empty/loading placeholder for lists and data sections.
// Replaces repeated div+text pattern in Leads, Agente.

import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  /** Optional icon (e.g. AlertTriangle) */
  icon?: LucideIcon;
  /** Main message or title */
  title?: string;
  /** Optional secondary text below title */
  description?: string;
  /** Simple message when no icon/title/description (e.g. "Carregando dados...") */
  message?: string;
  /** Additional Tailwind classes for the wrapper */
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, message, className }: EmptyStateProps) {
  // Simple mode: single message (loading or minimal empty state)
  if (message && !title && !description && !Icon) {
    return (
      <div className={cn("py-8 text-center text-muted-foreground text-sm", className)}>{message}</div>
    );
  }

  // Structured mode: icon + title + description
  return (
    <div className={cn("p-8 text-center", className)}>
      {Icon && <Icon className="h-6 w-6 mx-auto text-muted-foreground mb-2" />}
      {title && <p className="text-sm text-foreground">{title}</p>}
      {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
    </div>
  );
}
