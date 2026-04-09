import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface DashboardPanelProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}

export function DashboardPanel({ title, subtitle, children, className }: DashboardPanelProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[1.85rem] border border-white/10 bg-[linear-gradient(180deg,rgba(11,13,44,0.94),rgba(7,8,28,0.98))] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.28)] before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.14),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(34,211,238,0.09),transparent_24%)] before:content-['']",
        className
      )}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-white/15" />
      {(title || subtitle) && (
        <div className="relative mb-4 border-b border-white/8 pb-4">
          {title && (
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.8)]" />
              {title}
            </h2>
          )}
          {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      )}
      <div className="relative">{children}</div>
    </div>
  );
}
