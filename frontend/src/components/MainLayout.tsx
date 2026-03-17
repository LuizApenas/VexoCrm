import { AppSidebar } from "@/components/AppSidebar";
import { Outlet } from "react-router-dom";

export function MainLayout() {
  return (
    <div className="flex min-h-screen w-full bg-transparent">
      <AppSidebar />
      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}
