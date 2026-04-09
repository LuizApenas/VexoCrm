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
      <div className={cn("rounded-[1.5rem] border border-slate-200/90 bg-white/80 py-8 text-center text-sm text-muted-foreground dark:border-white/8 dark:bg-white/[0.03]", className)}>
        {message}
      </div>
    );
  }

  return (
    <div className={cn("rounded-[1.5rem] border border-slate-200/90 bg-white/80 p-8 text-center dark:border-white/8 dark:bg-white/[0.03]", className)}>
      {Icon && <Icon className="mx-auto mb-3 h-6 w-6 text-primary" />}
      {title && <p className="text-sm text-foreground">{title}</p>}
      {description && <p className="mt-2 text-xs leading-6 text-muted-foreground">{description}</p>}
    </div>
  );
}
