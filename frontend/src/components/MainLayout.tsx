import { AppSidebar } from "@/components/AppSidebar";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Outlet } from "react-router-dom";

export function MainLayout() {
  return (
    <div className="relative flex min-h-screen w-full overflow-hidden bg-deep-navy">
      {/* Background gradients */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-deep-navy via-[#0B0E14] to-[#0f0a2e]/20" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.08),transparent_28%),radial-gradient(circle_at_85%_10%,rgba(34,211,238,0.04),transparent_18%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:52px_52px] [mask-image:radial-gradient(circle_at_center,black_35%,transparent_80%)]" />
      </div>
      <AppSidebar />
      <main className="relative min-w-0 flex-1">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}
