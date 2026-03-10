// VexoCrm/frontend/src/components/PageBanner.tsx
// Highlighted banner section with label, title, and description.
// Used in Index page (and reusable for other intro banners).

import { cn } from "@/lib/utils";

interface PageBannerProps {
  /** Small label above the title (e.g. "Menu principal") */
  label?: string;
  /** Main heading */
  title: string;
  /** Descriptive text below the title */
  description?: string;
  /** Additional Tailwind classes */
  className?: string;
}

export function PageBanner({ label, title, description, className }: PageBannerProps) {
  return (
    <section className={cn("rounded-2xl border border-border bg-card p-6", className)}>
      {label && <p className="text-sm font-medium text-primary">{label}</p>}
      <h2 className="mt-2 text-3xl font-semibold text-foreground">{title}</h2>
      {description && (
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>
      )}
    </section>
  );
}
