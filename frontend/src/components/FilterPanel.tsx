import { Filter } from "lucide-react";
import type { ReactNode } from "react";

interface FilterPanelProps {
  children: ReactNode;
  cols?: 2 | 3 | 4;
}

const colsMap: Record<number, string> = {
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
};

export function FilterPanel({ children, cols = 4 }: FilterPanelProps) {
  return (
    <div className="space-y-4 rounded-xl border border-slate-200/90 bg-[rgba(255,255,255,0.88)] p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-[rgba(11,14,20,0.4)] dark:shadow-none">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Filter className="h-4 w-4 text-primary" />
        Filtros
      </div>
      <div className={`grid grid-cols-1 ${colsMap[cols]} gap-3`}>{children}</div>
    </div>
  );
}
