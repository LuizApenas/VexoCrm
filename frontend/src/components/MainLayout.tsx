// VexoCrm/frontend/src/components/MainLayout.tsx
// Layout wrapper with sidebar and main content area.
// Extracted from App.tsx for cleaner structure.

import { AppSidebar } from "@/components/AppSidebar";
import { Outlet } from "react-router-dom";

export function MainLayout() {
  return (
    <div className="flex min-h-screen w-full">
      <AppSidebar />
      <Outlet />
    </div>
  );
}
