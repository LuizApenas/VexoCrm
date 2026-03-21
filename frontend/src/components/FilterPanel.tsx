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
    <div className="space-y-4 rounded-[1.5rem] border border-white/10 bg-[linear-gradient(180deg,rgba(9,12,11,0.94),rgba(5,8,7,0.98))] p-5">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Filter className="h-4 w-4 text-primary" />
        Filtros
      </div>
      <div className={`grid grid-cols-1 ${colsMap[cols]} gap-3`}>{children}</div>
    </div>
  );
}
