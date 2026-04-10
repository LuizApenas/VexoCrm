import type { ComponentType } from "react";
import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Bot,
  LogOut,
  Megaphone,
  ShieldCheck,
  PanelLeftClose,
  PanelLeft,
  FileSpreadsheet,
  MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/NotificationBell";
import { useAuth } from "@/contexts/AuthContext";
import { type InternalPage } from "@/lib/access";

const navItems = [
  { title: "Dashboard", url: "/crm/dashboard", icon: LayoutDashboard, page: "dashboard" as const },
  { title: "Leads", url: "/crm/leads", icon: Users, badge: "CRM", page: "leads" as const },
  { title: "Planilhas", url: "/crm/planilhas", icon: FileSpreadsheet, page: "planilhas" as const },
  { title: "WhatsApp", url: "/crm/whatsapp", icon: MessageCircle, page: "whatsapp" as const },
  { title: "Agente", url: "/crm/agente", icon: Bot, page: "agente" as const },
  { title: "Campanhas", url: "/crm/campanhas", icon: Megaphone, page: "campanhas" as const },
  { title: "Usuarios", url: "/crm/usuarios", icon: ShieldCheck, page: "usuarios" as const },
] satisfies Array<{
  title: string;
  url: string;
  icon: ComponentType<{ className?: string }>;
  badge?: string;
  page: InternalPage;
}>;

export function AppSidebar() {
  const { logout, canAccessInternalPage, user, accessProfile } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const visibleNavItems = navItems.filter((item) => canAccessInternalPage(item.page));
  const canSeeAgentNotifications = canAccessInternalPage("agente");
  const userEmail = user?.email || accessProfile?.email || "";
  const userLogin = userEmail.includes("@") ? userEmail.split("@")[0] : userEmail;
  const userName = user?.displayName?.trim() || userLogin || "Usuario";

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout();
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <aside
      className={cn(
        "relative flex min-h-full flex-col overflow-hidden border-r border-slate-200/80 bg-[linear-gradient(180deg,rgba(248,250,255,0.98),rgba(237,242,255,0.98))] text-slate-700 backdrop-blur-xl transition-all duration-200 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(8,10,34,0.98),rgba(5,6,24,0.98))] dark:text-slate-100",
        collapsed ? "w-[92px]" : "w-[240px]"
      )}
    >
      <div className="relative shrink-0 border-b border-slate-200/80 px-5 py-6 dark:border-white/10">
        <div className="absolute -left-10 -top-10 h-32 w-32 rounded-full bg-fuchsia-500/10 blur-3xl dark:bg-fuchsia-500/16" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200/80 bg-white/90 shadow-[0_10px_30px_rgba(34,211,238,0.12)] dark:border-white/10 dark:bg-white/5 dark:shadow-[0_10px_30px_rgba(34,211,238,0.16)]">
            <span className="bg-[linear-gradient(135deg,#8b5cf6,#22d3ee)] bg-clip-text text-lg font-black text-transparent">
              V
            </span>
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="text-lg font-extrabold tracking-tight text-foreground">Vexo CRM</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.26em] text-slate-500 dark:text-white/45">
                Control hub
              </p>
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-5">
        {!collapsed && (
          <p className="px-3 pb-3 font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-muted-foreground/70">
            Principal
          </p>
        )}

        <div className="space-y-1.5">
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.url}
              to={item.url}
              className={({ isActive }) =>
                cn(
                  "group relative flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-medium transition-all",
                  isActive
                    ? "bg-[linear-gradient(90deg,rgba(99,102,241,0.18),rgba(59,130,246,0.10))] text-slate-900 shadow-[inset_0_0_0_1px_rgba(129,140,248,0.24),0_18px_34px_rgba(15,23,42,0.10)] dark:text-white dark:shadow-[inset_0_0_0_1px_rgba(129,140,248,0.34),0_20px_36px_rgba(15,23,42,0.35)]"
                    : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 dark:text-sidebar-foreground dark:hover:bg-white/[0.04] dark:hover:text-foreground"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      isActive ? "text-cyan-600 dark:text-cyan-200" : "text-slate-500 group-hover:text-slate-900 dark:text-sidebar-foreground dark:group-hover:text-foreground"
                    )}
                  />
                  {!collapsed && <span className="truncate">{item.title}</span>}
                  {!collapsed && item.badge && (
                    <span className="ml-auto rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 font-mono text-[10px] font-bold text-cyan-700 dark:text-cyan-200">
                      {item.badge}
                    </span>
                  )}
                  {isActive && (
                    <span className="absolute left-0 top-2 h-[calc(100%-16px)] w-1 rounded-r-full bg-[linear-gradient(180deg,#8b5cf6,#22d3ee)] shadow-[0_0_16px_rgba(139,92,246,0.8)]" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>

        {!collapsed && (
          <p className="px-3 pb-3 pt-6 font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-muted-foreground/70">
            Sistema
          </p>
        )}

        <div className="space-y-1.5">
          {canSeeAgentNotifications ? <NotificationBell collapsed={collapsed} /> : null}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-medium text-slate-600 transition-all hover:bg-slate-100/80 hover:text-slate-900 dark:text-sidebar-foreground dark:hover:bg-white/[0.04] dark:hover:text-foreground"
          >
            {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            {!collapsed && <span>Recolher</span>}
          </button>
        </div>
      </nav>

      <div className="shrink-0 border-t border-slate-200/80 px-4 py-4 dark:border-sidebar-border/20">
        <div
          className={cn(
            "mb-3 rounded-2xl border border-slate-200/80 bg-white/80 p-3 dark:border-white/8 dark:bg-white/[0.03]",
            collapsed && "hidden"
          )}
        >
          {!collapsed && (
            <div>
              <p className="text-sm font-semibold text-foreground">{userName}</p>
              <p className="mt-1 text-xs text-muted-foreground">Workspace principal</p>
            </div>
          )}
        </div>

        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="flex w-full items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/80 px-3.5 py-3 text-sm font-medium text-slate-600 transition-all hover:bg-slate-100 hover:text-slate-900 disabled:pointer-events-none disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/72 dark:hover:bg-white/[0.06] dark:hover:text-white"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>{isLoggingOut ? "Saindo..." : "Sair"}</span>}
        </button>
      </div>
    </aside>
  );
}
