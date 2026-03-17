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
      <header className="sticky top-0 z-20 flex min-h-[58px] items-center gap-4 border-b border-border/80 bg-[rgba(13,18,32,0.92)] px-7 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">VEXO</span>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-semibold text-foreground">{title}</span>
        </div>

        <div className="hidden items-center gap-2 rounded-md border border-emerald-400/20 bg-secondary/80 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-400 md:flex">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          Sistema online
        </div>

        <div className="relative ml-auto hidden min-w-[240px] max-w-[320px] flex-1 lg:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            readOnly
            value=""
            placeholder="Buscar contatos, negócios, campanhas..."
            className="h-9 w-full rounded-md border border-border/80 bg-secondary/80 pl-9 pr-3 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-primary"
          />
        </div>

        {headerRight && <div className="flex items-center gap-3">{headerRight}</div>}
      </header>

      <div className={`px-7 py-6 ${spacing}`}>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-primary">// Painel</p>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
