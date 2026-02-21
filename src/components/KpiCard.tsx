import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  change?: { value: string; positive: boolean };
  icon: React.ReactNode;
}

export function KpiCard({ title, value, subtitle, change, icon }: KpiCardProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center text-primary">
          {icon}
        </div>
        {change && (
          <span
            className={cn(
              "flex items-center gap-1 text-xs font-medium rounded-full px-2 py-0.5",
              change.positive
                ? "text-success bg-success/10"
                : "text-destructive bg-destructive/10"
            )}
          >
            {change.positive ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {change.value}
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{title}</p>
        {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}
