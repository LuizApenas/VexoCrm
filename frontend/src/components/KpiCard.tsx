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
  cyan: "border-electric-indigo/20 text-electric-indigo shadow-[0_0_20px_rgba(99,102,241,0.12)]",
  teal: "border-cyan-neon/18 text-cyan-neon shadow-[0_0_20px_rgba(34,211,238,0.10)]",
  amber: "border-white/12 text-[#F8FAFC] shadow-[0_0_20px_rgba(255,255,255,0.04)]",
  pink: "border-electric-indigo/16 text-electric-indigo/80 shadow-[0_0_20px_rgba(99,102,241,0.08)]",
  purple: "border-white/10 text-[#E2E8F0] shadow-[0_0_20px_rgba(226,232,240,0.04)]",
};

export function KpiCard({ title, value, icon, indicator, tone = "cyan", trend }: KpiCardProps) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-[rgba(11,14,20,0.4)] p-5 backdrop-blur-[10px] transition-all duration-300 hover:-translate-y-0.5 hover:border-electric-indigo/30",
        toneClasses[tone]
      )}
    >
      <div className="absolute inset-x-0 top-0 h-0.5 bg-current opacity-80" />
      <div className="absolute -bottom-8 -right-8 h-24 w-24 rounded-full bg-current/8 blur-xl" />

      <div className="relative flex flex-col gap-4">
        <div className="flex items-start justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#E2E8F0]/50">{title}</span>
          <div className="flex items-center gap-2">
            {indicator && (
              <span className={cn("h-2.5 w-2.5 rounded-full", indicator.color)} title={indicator.label} />
            )}
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-current/10 bg-current/10 text-current">
              {icon}
            </div>
          </div>
        </div>

        <div>
          <p className="font-mono text-4xl font-bold tracking-[-0.04em] text-[#F8FAFC]">{value}</p>
          {trend && <p className="mt-2 font-mono text-[11px] text-current">{trend}</p>}
        </div>
      </div>
    </div>
  );
}
