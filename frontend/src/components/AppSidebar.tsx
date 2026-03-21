import type { ComponentType } from "react";
import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Bot,
  LogOut,
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
  { title: "Usuarios", url: "/crm/usuarios", icon: ShieldCheck, page: "usuarios" as const },
] satisfies Array<{
  title: string;
  url: string;
  icon: ComponentType<{ className?: string }>;
  badge?: string;
  page: InternalPage;
}>;

export function AppSidebar() {
  const { logout, canAccessInternalPage, isAdminUser } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const visibleNavItems = navItems.filter((item) => canAccessInternalPage(item.page));
  const canSeeAgentNotifications = canAccessInternalPage("agente");

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
        "sticky top-0 flex h-screen flex-col overflow-hidden border-r border-white/8 bg-[linear-gradient(180deg,rgba(4,7,6,0.98),rgba(3,4,4,0.98))] backdrop-blur-xl transition-all duration-200",
        collapsed ? "w-[84px]" : "w-[220px]"
      )}
    >
      <div className="relative shrink-0 border-b border-white/8 px-4 py-5">
        <div className="absolute -left-10 -top-10 h-32 w-32 rounded-full bg-primary/14 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-[linear-gradient(135deg,#19e37d,#97ffd0)] font-mono text-sm font-bold text-background shadow-[0_0_26px_rgba(25,227,125,0.22)]">
            VX
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="text-lg font-extrabold tracking-tight text-foreground">
                Vexo<span className="text-primary">.</span>
              </p>
              <p className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.24em] text-primary">
                CRM system
              </p>
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-4">
        {!collapsed && (
          <p className="px-3 pb-2 font-mono text-[9px] font-bold uppercase tracking-[0.28em] text-muted-foreground/70">
            Principal
          </p>
        )}

        <div className="space-y-1">
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.url}
              to={item.url}
              className={({ isActive }) =>
                cn(
                  "group relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all",
                  isActive
                    ? "bg-primary/12 text-primary shadow-[inset_0_0_0_1px_rgba(25,227,125,0.14)]"
                    : "text-sidebar-foreground hover:bg-white/[0.04] hover:text-foreground"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      isActive ? "text-primary" : "text-sidebar-foreground group-hover:text-foreground"
                    )}
                  />
                  {!collapsed && <span className="truncate">{item.title}</span>}
                  {!collapsed && item.badge && (
                    <span className="ml-auto rounded-sm border border-primary/20 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-primary">
                      {item.badge}
                    </span>
                  )}
                  {isActive && <span className="absolute right-0 top-1.5 h-[calc(100%-12px)] w-0.5 rounded-l bg-primary shadow-[0_0_12px_rgba(25,227,125,0.8)]" />}
                </>
              )}
            </NavLink>
          ))}
        </div>

        {!collapsed && (
          <p className="px-3 pb-2 pt-5 font-mono text-[9px] font-bold uppercase tracking-[0.28em] text-muted-foreground/70">
            Sistema
          </p>
        )}

        <div className="space-y-1">
          {canSeeAgentNotifications ? <NotificationBell collapsed={collapsed} /> : null}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-sidebar-foreground transition-all hover:bg-white/[0.04] hover:text-foreground"
          >
            {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            {!collapsed && <span>Recolher</span>}
          </button>
        </div>
      </nav>

      <div className="shrink-0 border-t border-white/8 px-3 py-4">
        <div className={cn("mb-3 flex items-center gap-3", collapsed && "justify-center")}>
          <div className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-[linear-gradient(135deg,#0f1513,#1b2b24)] text-sm font-bold text-white">
            VS
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0d1220] bg-emerald-400" />
          </div>
          {!collapsed && (
            <div>
              <p className="text-sm font-semibold text-foreground">Vexo Staff</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {isAdminUser ? "Admin" : "Interno"}
              </p>
            </div>
          )}
        </div>

        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="flex w-full items-center gap-3 rounded-md border border-white/10 bg-white/[0.02] px-3 py-2.5 text-sm font-medium text-white/72 transition-all hover:bg-white/[0.05] hover:text-white disabled:pointer-events-none disabled:opacity-60"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>{isLoggingOut ? "Saindo..." : "Sair"}</span>}
        </button>
      </div>
    </aside>
  );
}
