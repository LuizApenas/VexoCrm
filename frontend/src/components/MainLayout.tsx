import { AppSidebar } from "@/components/AppSidebar";
import { Outlet } from "react-router-dom";

export function MainLayout() {
  return (
    <div className="relative flex min-h-screen w-full overflow-hidden bg-transparent">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(26,92,255,0.12),transparent_28%),radial-gradient(circle_at_85%_10%,rgba(26,92,255,0.06),transparent_18%),linear-gradient(180deg,rgba(2,3,24,0.92),rgba(3,5,30,0.98))]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:52px_52px] [mask-image:radial-gradient(circle_at_center,black_35%,transparent_80%)]" />
      </div>
      <AppSidebar />
      <main className="relative min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}
