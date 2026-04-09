import type { ReactNode } from "react";
import { Bell, ChevronDown, Search } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface PageShellProps {
  title: string;
  subtitle?: string;
  headerRight?: ReactNode;
  children: ReactNode;
  spacing?: string;
  compactHero?: boolean;
  contentClassName?: string;
}

export function PageShell({
  title,
  subtitle,
  headerRight,
  children,
  spacing = "space-y-5",
  compactHero = false,
  contentClassName,
}: PageShellProps) {
  const { user, accessProfile } = useAuth();
  const userEmail = user?.email || accessProfile?.email || "";
  const userName =
    user?.displayName?.trim() ||
    (userEmail.includes("@") ? userEmail.split("@")[0] : userEmail) ||
    "Usuario";
  const userInitials = userName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div className="flex h-full flex-1 flex-col overflow-auto">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[rgba(8,10,34,0.84)] backdrop-blur-2xl">
        <div className="flex items-center gap-4 px-5 py-4 lg:px-8">
          <div className="hidden items-center gap-2 lg:flex">
            <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-cyan-200">
              VEXO
            </span>
            <span className="text-white/25">/</span>
            <span className="text-sm font-semibold text-foreground">{title}</span>
          </div>

          <div className="relative w-full max-w-xl flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              readOnly
              value=""
              placeholder="Pesquisar..."
              className="h-12 w-full rounded-full border border-white/10 bg-white/[0.05] pl-11 pr-4 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-cyan-300/40"
            />
          </div>

          <div className="flex items-center gap-3">
            <button className="hidden h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white md:flex">
              <Bell className="h-4 w-4" />
            </button>
            <button className="hidden h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white md:flex">
              <Bell className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-2 py-1.5 shadow-[0_18px_34px_rgba(0,0,0,0.24)]">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[linear-gradient(135deg,rgba(139,92,246,0.95),rgba(34,211,238,0.95))] text-sm font-bold text-slate-950">
                {userInitials || "UX"}
              </div>
              <div className="hidden min-w-0 lg:block">
                <p className="truncate text-sm font-semibold text-foreground">{userName}</p>
                <p className="text-xs text-muted-foreground">Equipe Vexo</p>
              </div>
              <ChevronDown className="mr-1 hidden h-4 w-4 text-white/40 lg:block" />
            </div>
          </div>
        </div>
      </header>

      <div className={cn("px-5 py-4 lg:px-8 lg:py-5", spacing, contentClassName)}>
        <div
          className={
            compactHero
              ? "mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(12,14,46,0.84),rgba(7,8,28,0.96))] px-5 py-4 shadow-[0_18px_48px_rgba(0,0,0,0.24)]"
              : "mb-6 flex flex-wrap items-start justify-between gap-4 rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(12,14,46,0.84),rgba(7,8,28,0.96))] px-6 py-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]"
          }
        >
          <div className="max-w-3xl">
            <p className={compactHero ? "mb-1 font-mono text-[9px] font-bold uppercase tracking-[0.24em] text-cyan-200" : "mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-cyan-200"}>
              Command center
            </p>
            <h1 className={compactHero ? "text-2xl font-extrabold tracking-[-0.04em] text-foreground" : "text-3xl font-extrabold tracking-[-0.04em] text-foreground"}>
              {title}
            </h1>
            {subtitle && <p className={compactHero ? "mt-1 text-xs text-muted-foreground" : "mt-2 text-sm text-muted-foreground"}>{subtitle}</p>}
          </div>
          {headerRight && <div className="flex flex-wrap items-center gap-3">{headerRight}</div>}
        </div>
        {children}
      </div>
    </div>
  );
}
