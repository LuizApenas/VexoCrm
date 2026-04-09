import { AppSidebar } from "@/components/AppSidebar";
import { Outlet } from "react-router-dom";

export function MainLayout() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-transparent px-3 py-3 lg:px-6 lg:py-5">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_12%,rgba(168,85,247,0.18),transparent_22%),radial-gradient(circle_at_84%_14%,rgba(34,211,238,0.16),transparent_22%),radial-gradient(circle_at_50%_100%,rgba(59,130,246,0.16),transparent_30%),linear-gradient(180deg,rgba(2,3,24,0.96),rgba(4,6,30,0.98))]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.022)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.022)_1px,transparent_1px)] bg-[size:54px_54px] [mask-image:radial-gradient(circle_at_center,black_38%,transparent_82%)]" />
      </div>
      <div className="relative mx-auto flex min-h-[calc(100vh-1.5rem)] w-full max-w-[1580px] overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,12,40,0.9),rgba(5,6,28,0.96))] shadow-[0_35px_120px_rgba(0,0,0,0.45)] ring-1 ring-white/5">
        <AppSidebar />
        <main className="relative min-w-0 flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
