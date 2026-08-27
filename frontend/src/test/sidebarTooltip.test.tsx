import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MessageSquare, Users, Database, Sparkles, Send, Calendar, BarChart3, Smartphone, LayoutDashboard } from "lucide-react";
import { NavItem } from "../components/appSidebar/NavItem";
import { TooltipProvider } from "../components/ui/tooltip";

describe("Tooltip no Menu Lateral Recolhido (NavItem)", () => {
  const items = [
    { label: "Dashboard", url: "/crm/dashboard", icon: LayoutDashboard },
    { label: "Leads", url: "/crm/leads", icon: Users },
    { label: "Banco de Dados", url: "/crm/database", icon: Database },
    { label: "Conversas", url: "/crm/conversas", icon: MessageSquare },
    { label: "Follow-up", url: "/crm/followup", icon: Calendar },
    { label: "Campanhas", url: "/crm/campanhas", icon: Send },
    { label: "Relatórios", url: "/crm/relatorios", icon: BarChart3 },
    { label: "Agente IA", url: "/crm/agente", icon: Sparkles },
    { label: "Chips WhatsApp", url: "/crm/chips", icon: Smartphone },
  ];

  it("renderiza todos os itens com aria-label correto e acessibilidade quando recolhido", () => {
    render(
      <MemoryRouter>
        <TooltipProvider>
          {items.map((item) => (
            <NavItem key={item.url} item={item} collapsed={true} />
          ))}
        </TooltipProvider>
      </MemoryRouter>
    );

    for (const item of items) {
      const link = screen.getByRole("link", { name: item.label });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("aria-label", item.label);
      expect(link).toHaveAttribute("href", item.url);
    }
  });

  it("renderiza o texto diretamente no container quando o menu está expandido", () => {
    render(
      <MemoryRouter>
        <TooltipProvider>
          <NavItem
            item={{
              label: "Conversas",
              url: "/crm/conversas",
              icon: MessageSquare,
            }}
            collapsed={false}
          />
        </TooltipProvider>
      </MemoryRouter>
    );

    expect(screen.getByText("Conversas")).toBeInTheDocument();
  });
});
