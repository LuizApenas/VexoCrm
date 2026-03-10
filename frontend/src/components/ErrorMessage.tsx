// VexoCrm/frontend/src/components/ErrorMessage.tsx
// Standardized error display for forms and data sections.
// Replaces repeated error paragraph/div pattern in Login, SetPassword, Leads.

import { cn } from "@/lib/utils";

interface ErrorMessageProps {
  /** Error message to display (nothing rendered if null/undefined/empty) */
  message?: string | null;
  /** inline: simple text. banner: with background. dashboard: with border and background */
  variant?: "inline" | "banner" | "dashboard";
  /** Additional Tailwind classes */
  className?: string;
}

export function ErrorMessage({ message, variant = "inline", className }: ErrorMessageProps) {
  if (!message) return null;

  if (variant === "banner") {
    return (
      <div
        className={cn(
          "flex items-center gap-2 text-destructive text-sm mb-4 p-3 rounded-md bg-destructive/10",
          className
        )}
      >
        {message}
      </div>
    );
  }

  if (variant === "dashboard") {
    return (
      <div
        className={cn(
          "rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive",
          className
        )}
      >
        {message}
      </div>
    );
  }

  return <p className={cn("text-sm text-destructive", className)}>{message}</p>;
}
