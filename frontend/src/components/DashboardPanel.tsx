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
    <div className={cn("rounded-xl border border-border/90 bg-card/95 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.22)]", className)}>
      {(title || subtitle) && (
        <div className="mb-4 border-b border-border/70 pb-4">
          {title && (
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(0,212,255,0.9)]" />
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
