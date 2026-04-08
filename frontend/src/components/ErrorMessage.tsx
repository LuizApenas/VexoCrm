import { cn } from "@/lib/utils";

interface ErrorMessageProps {
  message?: string | null;
  variant?: "inline" | "banner" | "dashboard";
  className?: string;
}

export function ErrorMessage({ message, variant = "inline", className }: ErrorMessageProps) {
  if (!message) return null;

  if (variant === "banner") {
    return (
      <div
        className={cn(
          "mb-4 flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive",
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
          "rounded-[1.25rem] border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive",
          className
        )}
      >
        {message}
      </div>
    );
  }

  return <p className={cn("text-sm text-destructive", className)}>{message}</p>;
}
