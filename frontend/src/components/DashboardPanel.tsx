// VexoCrm/frontend/src/components/DashboardPanel.tsx
// Bordered card panel for dashboard charts and widgets.
// Replaces repeated div+title+content pattern in Dashboard.

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface DashboardPanelProps {
  /** Optional panel title */
  title?: string;
  /** Optional subtitle below the title */
  subtitle?: string;
  /** Panel content (chart, widget, etc.) */
  children: ReactNode;
  /** Additional Tailwind classes for the outer wrapper */
  className?: string;
}

export function DashboardPanel({ title, subtitle, children, className }: DashboardPanelProps) {
  return (
    <div className={cn("rounded-lg border border-border bg-card p-5", className)}>
      {(title || subtitle) && (
        <div className="mb-4">
          {title && <h2 className="text-sm font-semibold text-foreground">{title}</h2>}
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
}
