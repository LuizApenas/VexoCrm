// VexoCrm/frontend/src/components/PageShell.tsx
// Reusable page layout with sticky header and scrollable content.
// Replaces repeated div+header+content pattern across Index, Dashboard, Leads, Agente.

import type { ReactNode } from "react";

interface PageShellProps {
  /** Page title shown in the header */
  title: string;
  /** Optional subtitle below the title */
  subtitle?: string;
  /** Optional content on the right side of the header (e.g. unread counter, client selector) */
  headerRight?: ReactNode;
  /** Page content */
  children: ReactNode;
  /** Tailwind spacing class for content area (default: space-y-5) */
  spacing?: string;
}

export function PageShell({ title, subtitle, headerRight, children, spacing = "space-y-5" }: PageShellProps) {
  return (
    <div className="flex-1 overflow-auto">
      <header className="h-14 border-b border-border flex items-center px-6 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center justify-between w-full gap-3">
          <div>
            <h1 className="text-lg font-semibold text-foreground">{title}</h1>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          {headerRight}
        </div>
      </header>

      <div className={`p-6 ${spacing}`}>{children}</div>
    </div>
  );
}
