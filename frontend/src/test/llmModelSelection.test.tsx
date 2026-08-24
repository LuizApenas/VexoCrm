import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TabGeral } from "@/pages/ChatbotSettings/TabGeral";
import { TooltipProvider } from "@/components/ui/tooltip";

const mockModels = [
  { id: "openai/gpt-oss-120b", name: "GPT-OSS 120B (Groq)", provider: "groq" as const, providerName: "Groq" },
  { id: "openai/gpt-oss-20b", name: "GPT-OSS 20B (Groq)", provider: "groq" as const, providerName: "Groq" },
  { id: "qwen/qwen3.6-27b", name: "Qwen 3.6 27B", provider: "groq" as const, providerName: "Groq" },
  { id: "gpt-4o", name: "GPT-4o (Omni)", provider: "openai" as const, providerName: "ChatGPT / OpenAI" },
];

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    clientId: "geracao-digital",
    isInternalUser: true,
    getIdToken: async () => "mock-token",
  }),
}));

vi.mock("@/hooks/useCrmClient", () => ({
  useCrmClient: () => ({
    selectedClientId: "geracao-digital",
    selectedClient: { id: "geracao-digital", name: "Geração Digital" },
    clients: [],
    isLoading: false,
  }),
  useOptionalCrmClient: () => ({
    selectedClientId: "geracao-digital",
    selectedClient: { id: "geracao-digital", name: "Geração Digital" },
    clients: [],
    isLoading: false,
  }),
}));

vi.mock("@/hooks/useLeadClients", () => ({
  useLeadClients: () => ({ data: [], isLoading: false }),
  useUpdateLeadClientN8nSettings: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("@/hooks/useChatbotTemplates", () => ({
  useChatbotTemplates: () => ({ data: [], isLoading: false }),
  useBuiltinTemplates: () => ({ data: [], isLoading: false }),
  useLlmModels: () => ({
    data: {
      models: mockModels,
      defaultModel: "openai/gpt-oss-120b",
      providerStatus: { groq: true, openai: false, anthropic: false, gemini: false },
    },
    isLoading: false,
  }),
  useSaveChatbotTemplate: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteChatbotTemplate: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

function renderTabGeral(clientData: any) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <TabGeral clientId="geracao-digital" clientName="Geração Digital" client={clientData} />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

describe("DEFEITO 3 — A tela mostra o modelo efetivo e diz o que está valendo", () => {
  it("quando o tenant não tem escolha própria (null/vazio), mostra o Padrão do Sistema", () => {
    const clientSemModelo = {
      id: "geracao-digital",
      name: "Geração Digital",
      n8n_settings: {
        chatbot_enabled: true,
        chatbot_model: "generico",
        chatbot_llm_model: null,
      },
    };

    renderTabGeral(clientSemModelo);

    // Deve exibir o selo de Padrão do Sistema com o nome do modelo
    expect(screen.getByText(/Padrão do Sistema/i)).toBeInTheDocument();
    expect(screen.getAllByText(/GPT-OSS 120B/i).length).toBeGreaterThan(0);
  });

  it("quando o tenant tem modelo válido escolhido, não exibe selo de padrão e usa o modelo do tenant", () => {
    const clientComModelo = {
      id: "geracao-digital",
      name: "Geração Digital",
      n8n_settings: {
        chatbot_enabled: true,
        chatbot_model: "generico",
        chatbot_llm_model: "qwen/qwen3.6-27b",
      },
    };

    renderTabGeral(clientComModelo);

    expect(screen.queryByText(/Padrão do Sistema/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/Qwen 3.6 27B/i).length).toBeGreaterThan(0);
  });

  it("quando o tenant tem modelo morto salvo (ex: llama-3.3-70b-versatile), exibe aviso e usa padrão", () => {
    const clientComModeloMorto = {
      id: "geracao-digital",
      name: "Geração Digital",
      n8n_settings: {
        chatbot_enabled: true,
        chatbot_model: "generico",
        chatbot_llm_model: "llama-3.3-70b-versatile",
      },
    };

    renderTabGeral(clientComModeloMorto);

    // Deve alertar sobre o modelo descontinuado e indicar o padrão
    expect(
      screen.getByText(/não está mais disponível/i)
    ).toBeInTheDocument();
    expect(screen.getAllByText(/GPT-OSS 120B/i).length).toBeGreaterThan(0);
  });
});
