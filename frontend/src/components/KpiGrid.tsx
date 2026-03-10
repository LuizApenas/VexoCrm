// VexoCrm/frontend/src/components/KpiGrid.tsx
// Responsive grid wrapper for KpiCard components.
// Replaces repeated div.grid pattern in Dashboard.

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface KpiGridProps {
  /** KpiCard components */
  children: ReactNode;
  /** Column count for lg breakpoint (default: 4) */
  cols?: 2 | 3 | 4;
  /** Additional Tailwind classes */
  className?: string;
}

export function KpiGrid({ children, cols = 4, className }: KpiGridProps) {
  const colsClass = {
    2: "lg:grid-cols-2",
    3: "lg:grid-cols-3",
    4: "lg:grid-cols-4",
  }[cols];

  return (
    <div className={cn(`grid grid-cols-2 ${colsClass} gap-4`, className)}>{children}</div>
  );
}
