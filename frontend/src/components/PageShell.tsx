import type { ReactNode } from "react";
import { Search } from "lucide-react";

interface PageShellProps {
  title: string;
  subtitle?: string;
  headerRight?: ReactNode;
  children: ReactNode;
  spacing?: string;
}

export function PageShell({ title, subtitle, headerRight, children, spacing = "space-y-5" }: PageShellProps) {
  return (
    <div className="flex-1 overflow-auto">
      {/* Sticky header bar */}
      <header className="sticky top-0 z-20 flex min-h-[64px] items-center gap-4 border-b border-[rgba(226,232,240,0.08)] bg-[rgba(11,14,20,0.6)] px-7 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-electric-indigo">VEXO</span>
          <span className="text-[#E2E8F0]/30">/</span>
          <span className="text-sm font-semibold text-[#F8FAFC]">{title}</span>
        </div>

        <div className="hidden items-center gap-2 rounded-full border border-electric-indigo/20 bg-electric-indigo/8 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-electric-indigo md:flex">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-electric-indigo" />
          Sistema online
        </div>

        <div className="relative ml-auto hidden min-w-[240px] max-w-[320px] flex-1 lg:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#E2E8F0]/40" />
          <input
            readOnly
            value=""
            placeholder="Buscar contatos, negocios, campanhas..."
            className="h-10 w-full rounded-xl border border-[rgba(226,232,240,0.1)] bg-[rgba(11,14,20,0.4)] pl-9 pr-4 text-sm text-[#F8FAFC] outline-none transition-all duration-300 placeholder:text-[#E2E8F0]/30 focus:border-electric-indigo/40"
          />
        </div>

        {headerRight && <div className="flex items-center gap-3">{headerRight}</div>}
      </header>

      {/* Page content */}
      <div className={`px-7 py-6 ${spacing}`}>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="rounded-xl border border-[rgba(226,232,240,0.1)] bg-[rgba(11,14,20,0.4)] px-5 py-5 shadow-[0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-[10px]">
            <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-electric-indigo">// Control panel</p>
            <h1 className="text-3xl font-bold tracking-[-0.04em] text-[#F8FAFC]">{title}</h1>
            {subtitle && <p className="mt-2 max-w-3xl text-sm text-[#E2E8F0]/60">{subtitle}</p>}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
