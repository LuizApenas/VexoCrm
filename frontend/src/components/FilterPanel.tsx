// VexoCrm/frontend/src/components/FilterPanel.tsx
// Card panel with a "Filtros" header and a responsive grid of filter controls.
// Replaces repeated div+icon+grid pattern in Agente.

import { Filter } from "lucide-react";
import type { ReactNode } from "react";

interface FilterPanelProps {
  /** Filter controls (Input, Select, etc.) */
  children: ReactNode;
  /** Grid columns for lg breakpoint (default: 4) */
  cols?: 2 | 3 | 4;
}

const colsMap: Record<number, string> = {
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
};

export function FilterPanel({ children, cols = 4 }: FilterPanelProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Filter className="h-4 w-4" />
        Filtros
      </div>
      <div className={`grid grid-cols-1 ${colsMap[cols]} gap-3`}>{children}</div>
    </div>
  );
}
