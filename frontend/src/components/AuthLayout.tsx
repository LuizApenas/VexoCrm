// VexoCrm/frontend/src/components/AuthLayout.tsx
// Centered fullscreen layout for auth forms (Login, SetPassword).

import type { FormEvent, ReactNode } from "react";

interface AuthLayoutProps {
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  maxWidth?: "sm" | "md";
  children: ReactNode;
  formGap?: "gap-5" | "gap-6";
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
    <div className="flex items-center justify-center min-h-screen w-full bg-deep-navy px-4">
      <form
        onSubmit={onSubmit}
        className={`glass-panel flex flex-col p-8 rounded-xl w-full ${maxWidthClass} ${formGap} ${alignClass}`}
      >
        {children}
      </form>
    </div>
  );
}
