import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  indicator?: { color: string; label: string };
}

export function KpiCard({ title, value, icon, indicator }: KpiCardProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{title}</span>
        <div className="flex items-center gap-2">
          {indicator && (
            <span className={cn("w-2.5 h-2.5 rounded-full", indicator.color)} title={indicator.label} />
          )}
          <span className="text-muted-foreground">{icon}</span>
        </div>
      </div>
      <p className="text-3xl font-bold text-foreground">{value}</p>
    </div>
  );
}
