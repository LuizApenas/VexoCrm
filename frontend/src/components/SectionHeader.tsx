import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  children?: ReactNode;
  className?: string;
}

export function SectionHeader({ title, subtitle, icon: Icon, children, className }: SectionHeaderProps) {
  return (
    <div className={cn("mb-4 flex flex-col md:flex-row md:items-center justify-between gap-4", className)}>
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
          {Icon && <Icon className="h-5 w-5 text-primary" />}
          {title}
        </h2>
        {subtitle && <p className="text-xs leading-5 text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {children && (
        <div className="flex items-center gap-2 flex-wrap justify-start md:justify-end">
          {children}
        </div>
      )}
    </div>
  );
}
