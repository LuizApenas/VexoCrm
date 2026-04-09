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
  cyan:
    "border-cyan-300/20 text-cyan-200 shadow-[0_20px_40px_rgba(34,211,238,0.12)] before:bg-[radial-gradient(circle_at_18%_20%,rgba(34,211,238,0.24),transparent_34%),linear-gradient(135deg,rgba(34,211,238,0.2),rgba(15,23,42,0))]",
  teal:
    "border-sky-300/20 text-sky-200 shadow-[0_20px_40px_rgba(56,189,248,0.1)] before:bg-[radial-gradient(circle_at_15%_18%,rgba(56,189,248,0.2),transparent_34%),linear-gradient(135deg,rgba(6,182,212,0.18),rgba(15,23,42,0))]",
  amber:
    "border-violet-300/20 text-violet-200 shadow-[0_20px_40px_rgba(139,92,246,0.14)] before:bg-[radial-gradient(circle_at_78%_0%,rgba(168,85,247,0.28),transparent_34%),linear-gradient(135deg,rgba(139,92,246,0.18),rgba(15,23,42,0))]",
  pink:
    "border-fuchsia-300/20 text-fuchsia-200 shadow-[0_20px_40px_rgba(217,70,239,0.14)] before:bg-[radial-gradient(circle_at_85%_0%,rgba(217,70,239,0.24),transparent_36%),linear-gradient(135deg,rgba(217,70,239,0.14),rgba(15,23,42,0))]",
  purple:
    "border-indigo-300/20 text-indigo-100 shadow-[0_20px_40px_rgba(99,102,241,0.12)] before:bg-[radial-gradient(circle_at_20%_20%,rgba(99,102,241,0.24),transparent_36%),linear-gradient(135deg,rgba(99,102,241,0.18),rgba(15,23,42,0))]",
};

export function KpiCard({ title, value, icon, indicator, tone = "cyan", trend }: KpiCardProps) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-[1.25rem] border bg-[linear-gradient(180deg,rgba(11,13,44,0.96),rgba(7,8,28,0.98))] p-3.5 transition-all duration-200 hover:-translate-y-0.5 before:absolute before:inset-0 before:opacity-100 before:content-['']",
        toneClasses[tone]
      )}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-white/20" />
      <div className="absolute -bottom-8 -right-8 h-24 w-24 rounded-full bg-current/12 blur-2xl" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent_22%)]" />

      <div className="relative flex flex-col gap-2.5">
        <div className="flex items-start justify-between">
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/60">
            {title}
          </span>
          <div className="flex items-center gap-1.5">
            {indicator && (
              <span className={cn("h-2 w-2 rounded-full", indicator.color)} title={indicator.label} />
            )}
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-current">
              {icon}
            </div>
          </div>
        </div>

        <div>
          <p className="text-[2rem] font-extrabold tracking-[-0.06em] text-foreground">{value}</p>
          {trend && (
            <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.14em] text-white/65">
              {trend}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
