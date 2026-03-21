import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title?: string;
  description?: string;
  message?: string;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, message, className }: EmptyStateProps) {
  if (message && !title && !description && !Icon) {
    return (
      <div className={cn("rounded-[1.5rem] border border-white/8 bg-white/[0.03] py-8 text-center text-sm text-muted-foreground", className)}>
        {message}
      </div>
    );
  }

  return (
    <div className={cn("rounded-[1.5rem] border border-white/8 bg-white/[0.03] p-8 text-center", className)}>
      {Icon && <Icon className="mx-auto mb-3 h-6 w-6 text-primary" />}
      {title && <p className="text-sm text-foreground">{title}</p>}
      {description && <p className="mt-2 text-xs leading-6 text-muted-foreground">{description}</p>}
    </div>
  );
}
