import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  BarChart3,
  Bot,
  Settings,
  Bell,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Leads", url: "/leads", icon: Users },
  { title: "Relatórios", url: "/relatorios", icon: BarChart3 },
  { title: "Agente Fin", url: "/agente", icon: Bot },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-200 h-screen sticky top-0",
        collapsed ? "w-14" : "w-48"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-3 h-14 border-b border-sidebar-border shrink-0">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <span className="text-primary-foreground font-bold text-sm">⚡</span>
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="text-sm font-semibold text-sidebar-accent-foreground leading-tight">Infinie</p>
            <p className="text-[10px] text-sidebar-foreground">Soluções Renováveis</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {navItems.map((item) => (
          <NavLink
            key={item.url}
            to={item.url}
            end={item.url === "/"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                isActive
                  ? "bg-primary/15 text-primary font-medium"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/10 hover:text-sidebar-accent-foreground"
              )
            }
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="truncate">{item.title}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Bottom */}
      <div className="border-t border-sidebar-border p-2 space-y-0.5 shrink-0">
        <NavLink
          to="/notificacoes"
          className={({ isActive }) =>
            cn(
              "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors relative",
              isActive
                ? "bg-primary/15 text-primary font-medium"
                : "text-sidebar-foreground hover:bg-sidebar-accent/10 hover:text-sidebar-accent-foreground"
            )
          }
        >
          <Bell className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Notificações</span>}
          <span className="absolute right-2 top-2 w-2 h-2 rounded-full bg-destructive" />
        </NavLink>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-2 w-full rounded-md px-2.5 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent/10 hover:text-sidebar-accent-foreground transition-colors"
        >
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          {!collapsed && <span>Recolher</span>}
        </button>
      </div>
    </aside>
  );
}
