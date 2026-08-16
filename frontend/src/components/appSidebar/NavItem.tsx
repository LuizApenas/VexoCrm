import type { ComponentType } from "react";
import { NavLink } from "react-router-dom";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

function NavItem({
  item,
  collapsed,
  isLocked = false,
}: {
  item: { label: string; url: string; icon: ComponentType<{ className?: string }>; badge?: string };
  collapsed: boolean;
  isLocked?: boolean;
}) {
  return (
    <NavLink
      to={item.url}
      className={({ isActive }) =>
        cn(
          "group relative flex font-medium transition-all",
          collapsed
            ? "h-9 items-center justify-center rounded-xl px-0"
            : "items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-[13px]",
          isLocked && "opacity-60 hover:opacity-90",
          isActive
            ? "bg-[linear-gradient(90deg,rgba(99,102,241,0.18),rgba(59,130,246,0.10))] text-slate-900 shadow-[inset_0_0_0_1px_rgba(129,140,248,0.24),0_14px_28px_rgba(15,23,42,0.08)] dark:text-white dark:shadow-[inset_0_0_0_1px_rgba(129,140,248,0.34),0_16px_28px_rgba(15,23,42,0.26)]"
            : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 dark:text-sidebar-foreground dark:hover:bg-white/[0.04] dark:hover:text-foreground"
        )
      }
    >
      {({ isActive }) => (
        <>
          <item.icon
            className={cn(
              "h-4 w-4 shrink-0",
              isActive
                ? "text-cyan-600 dark:text-cyan-200"
                : "text-slate-500 group-hover:text-slate-900 dark:text-sidebar-foreground dark:group-hover:text-foreground"
            )}
          />
          {!collapsed && <span className="truncate">{item.label}</span>}
          {!collapsed && isLocked && (
            <span className="ml-auto flex items-center text-muted-foreground/70 group-hover:text-foreground transition-colors" title="Módulo Bloqueado no Plano">
              <Lock className="w-3.5 h-3.5" />
            </span>
          )}
          {!collapsed && !isLocked && item.badge && (
            <span className="ml-auto rounded-full border border-cyan-400/20 bg-cyan-400/10 px-1.5 py-0.5 font-mono text-[9px] font-bold text-cyan-700 dark:text-cyan-200">
              {item.badge}
            </span>
          )}
          {isActive && (
            <span
              className={cn(
                "absolute shadow-[0_0_16px_var(--primary-shadow)]",
                collapsed
                  ? "left-1/2 top-auto h-1 w-6 -translate-x-1/2 rounded-full bottom-0.5"
                  : "left-0 top-2 h-[calc(100%-16px)] w-1 rounded-r-full"
              )}
              style={{ background: `linear-gradient(180deg, var(--primary-from, #8b5cf6), var(--primary-to, #22d3ee))` }}
            />
          )}
        </>
      )}
    </NavLink>
  );
}

export { NavItem };
