import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  className?: string;
}

export function SectionHeader({ title, subtitle, icon: Icon, className }: SectionHeaderProps) {
  return (
    <div className={cn("mb-4", className)}>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        {Icon && <Icon className="h-4 w-4 text-primary" />}
        {title}
      </h2>
      {subtitle && <p className="text-xs leading-6 text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
