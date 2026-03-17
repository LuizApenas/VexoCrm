import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  indicator?: { color: string; label: string };
  tone?: "cyan" | "teal" | "amber" | "pink" | "purple";
  trend?: string;
}

const toneClasses = {
  cyan: "border-cyan-400/20 text-cyan-300 shadow-[0_0_24px_rgba(0,212,255,0.12)]",
  teal: "border-emerald-400/20 text-emerald-300 shadow-[0_0_24px_rgba(0,255,179,0.10)]",
  amber: "border-amber-400/20 text-amber-300 shadow-[0_0_24px_rgba(255,184,0,0.10)]",
  pink: "border-pink-500/20 text-pink-300 shadow-[0_0_24px_rgba(255,45,122,0.10)]",
  purple: "border-violet-500/20 text-violet-300 shadow-[0_0_24px_rgba(124,58,237,0.10)]",
};

export function KpiCard({ title, value, icon, indicator, tone = "cyan", trend }: KpiCardProps) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30",
        toneClasses[tone]
      )}
    >
      <div className="absolute inset-x-0 top-0 h-0.5 bg-current opacity-90" />
      <div className="absolute -bottom-8 -right-8 h-24 w-24 rounded-full bg-current/10 blur-xl" />

      <div className="relative flex flex-col gap-4">
        <div className="flex items-start justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{title}</span>
          <div className="flex items-center gap-2">
            {indicator && (
              <span className={cn("h-2.5 w-2.5 rounded-full", indicator.color)} title={indicator.label} />
            )}
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-current/10 bg-current/10 text-current">
              {icon}
            </div>
          </div>
        </div>

        <div>
          <p className="text-4xl font-extrabold tracking-[-0.06em] text-foreground">{value}</p>
          {trend && <p className="mt-2 font-mono text-[11px] text-current">{trend}</p>}
        </div>
      </div>
    </div>
  );
}
