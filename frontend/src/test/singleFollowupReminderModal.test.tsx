import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SingleFollowupReminderModal } from "@/components/followup/SingleFollowupReminderModal";

// Mock do contexto de autenticação
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    getIdToken: vi.fn().mockResolvedValue("mock-token"),
  }),
}));

describe("SingleFollowupReminderModal Component", () => {
  it("renders recipient info, shortcuts, variable chips, and live preview", () => {
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <SingleFollowupReminderModal
          open={true}
          onOpenChange={vi.fn()}
          lead={{
            id: "lead-123",
            nome: "João da Silva",
            phone: "553497817660",
          }}
          tenantId="geracao-digital"
        />
      </QueryClientProvider>
    );

    // Destinatário
    expect(screen.getByText("João da Silva")).toBeDefined();
    expect(screen.getByText("553497817660")).toBeDefined();

    // Atalhos
    expect(screen.getByText("Em 1 hora")).toBeDefined();
    expect(screen.getByText("Amanhã às 9h")).toBeDefined();
    expect(screen.getByText("Em 2 dias")).toBeDefined();
    expect(screen.getByText("Próxima segunda às 9h")).toBeDefined();

    // Variáveis
    expect(screen.getByText("+{{nome}}")).toBeDefined();
    expect(screen.getByText("+{{telefone}}")).toBeDefined();
    expect(screen.getByText("+{{scheduling_link}}")).toBeDefined();

    // Prévia em tempo real com o nome substituído
    expect(
      screen.getByText(/Olá João, tudo bem\? Passando para saber se conseguiu dar uma olhada na proposta!/)
    ).toBeDefined();

    // Botão de envio habilitado
    const submitBtn = screen.getByText("Confirmar Lembrete");
    expect(submitBtn).toBeDefined();
  });

  it("blocks submission and shows clear warning when lead has no phone", () => {
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <SingleFollowupReminderModal
          open={true}
          onOpenChange={vi.fn()}
          lead={{
            id: "lead-no-phone",
            nome: "Lead Sem Telefone",
            phone: "",
          }}
          tenantId="geracao-digital"
        />
      </QueryClientProvider>
    );

    expect(screen.getByText("Sem Telefone")).toBeDefined();
    expect(
      screen.getByText("Este lead não possui um número de WhatsApp cadastrado. O agendamento está bloqueado.")
    ).toBeDefined();

    const submitBtn = screen.getByRole("button", { name: /Confirmar Lembrete/i });
    expect(submitBtn.hasAttribute("disabled")).toBe(true);
  });
});
