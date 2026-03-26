// VexoCrm/frontend/src/components/AuthLayout.tsx
// Centered fullscreen layout for auth forms (Login, SetPassword).
// Replaces repeated div+form wrapper pattern.

import type { FormEvent, ReactNode } from "react";

interface AuthLayoutProps {
  /** Form submit handler */
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  /** Max width of the form card: sm (max-w-sm) or md (max-w-md) */
  maxWidth?: "sm" | "md";
  /** Form content (fields, buttons, etc.) */
  children: ReactNode;
  /** Tailwind gap class for form (default: gap-6) */
  formGap?: "gap-5" | "gap-6";
  /** Center form content (e.g. for Login with icon) */
  formAlign?: "center" | "stretch";
}

export function AuthLayout({
  onSubmit,
  maxWidth = "md",
  formGap = "gap-6",
  formAlign = "stretch",
  children,
}: AuthLayoutProps) {
  const maxWidthClass = maxWidth === "sm" ? "max-w-sm" : "max-w-md";
  const alignClass = formAlign === "center" ? "items-center" : "";

  return (
    <div className="flex items-center justify-center min-h-screen w-full bg-[#030308] px-4">
      <form
        onSubmit={onSubmit}
        className={`glass-panel flex flex-col p-8 rounded-2xl w-full ${maxWidthClass} ${formGap} ${alignClass} shadow-[0_24px_80px_rgba(0,0,0,0.5)]`}
      >
        {children}
      </form>
    </div>
  );
}
