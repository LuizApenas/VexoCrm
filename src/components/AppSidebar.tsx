import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Bell,
  Users,
  Contact,
  Building2,
  GitBranch,
  Target,
  CheckSquare,
  Calendar,
  MessageSquare,
  Zap,
  DollarSign,
  BarChart3,
  Plug,
  FileText,
  Settings,
  ChevronDown,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavGroup {
  label: string;
  items: { title: string; url: string; icon: React.ElementType; badge?: number }[];
}

const navGroups: NavGroup[] = [
  {
    label: "PRINCIPAL",
    items: [
      { title: "Dashboard", url: "/", icon: LayoutDashboard },
      { title: "Notificações", url: "/notificacoes", icon: Bell, badge: 5 },
    ],
  },
  {
    label: "COMERCIAL",
    items: [
      { title: "Leads", url: "/leads", icon: Users },
      { title: "Contatos", url: "/contatos", icon: Contact },
      { title: "Empresas", url: "/empresas", icon: Building2 },
      { title: "Pipeline", url: "/pipeline", icon: GitBranch },
      { title: "Oportunidades", url: "/oportunidades", icon: Target },
    ],
  },
  {
    label: "OPERACIONAL",
    items: [
      { title: "Tarefas", url: "/tarefas", icon: CheckSquare },
      { title: "Agenda", url: "/agenda", icon: Calendar },
      { title: "Atendimento", url: "/atendimento", icon: MessageSquare },
    ],
  },
  {
    label: "SISTEMA",
    items: [
      { title: "Automações", url: "/automacoes", icon: Zap },
      { title: "Financeiro", url: "/financeiro", icon: DollarSign },
      { title: "Relatórios", url: "/relatorios", icon: BarChart3 },
      { title: "Integrações", url: "/integracoes", icon: Plug },
      { title: "Logs", url: "/logs", icon: FileText },
      { title: "Configurações", url: "/configuracoes", icon: Settings },
    ],
  },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    PRINCIPAL: true,
    COMERCIAL: true,
    OPERACIONAL: true,
    SISTEMA: true,
  });

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-200 h-screen sticky top-0",
        collapsed ? "w-16" : "w-56"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 h-14 border-b border-sidebar-border shrink-0">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <span className="text-primary-foreground font-bold text-sm">N</span>
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="text-sm font-semibold text-sidebar-accent-foreground leading-tight">NEXUS</p>
            <p className="text-[10px] text-sidebar-foreground uppercase tracking-wider">CRM Enterprise</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
        {navGroups.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <button
                onClick={() => toggleGroup(group.label)}
                className="flex items-center justify-between w-full px-2 pt-4 pb-1 text-[10px] font-semibold tracking-widest text-sidebar-foreground uppercase hover:text-sidebar-accent-foreground transition-colors"
              >
                {group.label}
                <ChevronDown
                  className={cn(
                    "h-3 w-3 transition-transform",
                    !openGroups[group.label] && "-rotate-90"
                  )}
                />
              </button>
            )}

            {(collapsed || openGroups[group.label]) && (
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLink
                    key={item.url}
                    to={item.url}
                    end={item.url === "/"}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                        isActive
                          ? "bg-primary/15 text-primary font-medium"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )
                    }
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!collapsed && (
                      <>
                        <span className="truncate">{item.title}</span>
                        {item.badge && (
                          <span className="ml-auto text-[10px] bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center font-medium">
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-sidebar-border p-2 shrink-0">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-2 w-full rounded-md px-2.5 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
        >
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          {!collapsed && <span>Recolher</span>}
        </button>
      </div>
    </aside>
  );
}
