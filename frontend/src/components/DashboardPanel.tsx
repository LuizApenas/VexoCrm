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
        "rounded-xl border border-[rgba(226,232,240,0.1)] bg-[rgba(11,14,20,0.4)] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-[10px]",
        className
      )}
    >
      {(title || subtitle) && (
        <div className="mb-4 border-b border-white/[0.06] pb-4">
          {title && (
            <h2 className="flex items-center gap-2 text-sm font-semibold text-[#F8FAFC]">
              <span className="h-1.5 w-1.5 rounded-full bg-electric-indigo shadow-[0_0_12px_rgba(99,102,241,0.8)]" />
              {title}
            </h2>
          )}
          {subtitle && <p className="mt-1 text-xs text-[#E2E8F0]/60">{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
}
