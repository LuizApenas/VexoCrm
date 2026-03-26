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
      <header className="sticky top-0 z-20 flex min-h-[64px] items-center gap-4 border-b border-white/10 bg-[rgba(3,5,30,0.86)] px-7 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#3A75FF]">VEXO</span>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-semibold text-foreground">{title}</span>
        </div>

        <div className="hidden items-center gap-2 rounded-full border border-[#1A5CFF]/20 bg-[#1A5CFF]/8 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[#3A75FF] md:flex">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#1A5CFF]" />
          Sistema online
        </div>

        <div className="relative ml-auto hidden min-w-[240px] max-w-[320px] flex-1 lg:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            readOnly
            value=""
            placeholder="Buscar contatos, negocios, campanhas..."
            className="h-10 w-full rounded-full border border-white/10 bg-white/[0.04] pl-9 pr-4 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-primary"
          />
        </div>

        {headerRight && <div className="flex items-center gap-3">{headerRight}</div>}
      </header>

      <div className={`px-7 py-6 ${spacing}`}>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] px-5 py-5 shadow-[0_20px_60px_rgba(0,0,0,0.24)]">
            <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-[#3A75FF]">// Control panel</p>
            <h1 className="text-3xl font-extrabold tracking-[-0.04em] text-foreground">{title}</h1>
            {subtitle && <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
