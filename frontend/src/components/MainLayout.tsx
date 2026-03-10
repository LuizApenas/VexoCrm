// VexoCrm/frontend/src/components/MainLayout.tsx
// Layout wrapper with sidebar and main content area.
// Extracted from App.tsx for cleaner structure.

import { AppSidebar } from "@/components/AppSidebar";
import type { ReactNode } from "react";

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="flex min-h-screen w-full">
      <AppSidebar />
      {children}
    </div>
  );
}
