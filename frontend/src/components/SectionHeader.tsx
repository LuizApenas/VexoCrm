// VexoCrm/frontend/src/components/SectionHeader.tsx
// Section title with optional icon and subtitle.
// Replaces repeated h2+p pattern in Index, Leads, Agente.

import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface SectionHeaderProps {
  /** Section title */
  title: string;
  /** Optional subtitle below the title */
  subtitle?: string;
  /** Optional icon before the title */
  icon?: LucideIcon;
  /** Additional Tailwind classes */
  className?: string;
}

export function SectionHeader({ title, subtitle, icon: Icon, className }: SectionHeaderProps) {
  return (
    <div className={cn("mb-4", className)}>
      <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4" />}
        {title}
      </h2>
      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
