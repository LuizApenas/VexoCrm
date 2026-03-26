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
        "rounded-[1.75rem] border border-white/10 bg-[linear-gradient(180deg,rgba(5,8,30,0.94),rgba(3,5,24,0.98))] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.28)]",
        className
      )}
    >
      {(title || subtitle) && (
        <div className="mb-4 border-b border-white/8 pb-4">
          {title && (
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_12px_rgba(26,92,255,0.8)]" />
              {title}
            </h2>
          )}
          {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
}
