// O simulador precisa dizer o que houve, não "Failed to fetch".
//
// O caminho do simulador (/api/chatbot-test) usa o MESMO fetchApi já corrigido —
// então o retry cross-origin em 502 não acontece mais. O que sobrava eram dois
// buracos do lado da tela: o timeout padrão de 15s, curto demais para um turno
// de LLM com rotação de modelos, e o catch imprimindo a exceção crua.

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TabTeste } from "@/pages/ChatbotSettings/TabTeste";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ getIdToken: async () => "token-de-teste" }),
}));

const fetchApiMock = vi.fn();
vi.mock("@/lib/api", async () => {
  const real = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...real, fetchApi: (...args: unknown[]) => fetchApiMock(...args) };
});

function respostaJson(status: number, corpo: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => "application/json" },
    json: async () => corpo,
    text: async () => JSON.stringify(corpo),
  };
}

async function enviar(texto = "oi") {
  render(<TabTeste clientId="sonhare" />);
  fireEvent.change(screen.getByPlaceholderText(/mensagem/i), { target: { value: texto } });
  fireEvent.click(screen.getByRole("button", { name: /enviar/i }));
}

beforeEach(() => fetchApiMock.mockReset());
afterEach(() => vi.restoreAllMocks());

describe("erro do chatbot-test chega legível na tela", () => {
  it("mostra o reason do backend, não um genérico", async () => {
    fetchApiMock.mockResolvedValue(
      respostaJson(502, {
        success: false,
        error: "Não foi possível gerar a resposta.",
        reason: "O modelo respondeu, mas sem texto na chave \"mensagem\".",
        code: "MODEL_EMPTY_MESSAGE",
      })
    );

    await enviar();
    await waitFor(() => {
      expect(screen.getByText(/sem texto na chave/i)).toBeTruthy();
    });
  });

  it("timeout vira explicação, não 'Failed to fetch'", async () => {
    const abort = new DOMException("The operation was aborted.", "AbortError");
    fetchApiMock.mockRejectedValue(abort);

    await enviar();
    await waitFor(() => {
      expect(screen.getByText(/demorou demais para responder/i)).toBeTruthy();
    });
  });

  it("falha de rede diz o que verificar", async () => {
    fetchApiMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await enviar();
    await waitFor(() => {
      expect(screen.getByText(/Backend fora do ar, ou a origem/i)).toBeTruthy();
    });
  });
});

describe("resposta boa com problema por trás não passa calada", () => {
  it("avisa quando a resposta saiu mas NÃO foi salva", async () => {
    fetchApiMock.mockResolvedValue(
      respostaJson(200, {
        success: true,
        response: "Oi! Para onde você quer viajar?",
        avisos: ["A resposta foi gerada mas NÃO foi salva (column nao existe). O histórico se perdeu: o próximo turno vai começar sem memória."],
      })
    );

    await enviar();
    await waitFor(() => {
      expect(screen.getByText(/Oi! Para onde você quer viajar\?/)).toBeTruthy();
      expect(screen.getByText(/NÃO foi salva/)).toBeTruthy();
    });
  });

  it("avisa quando a resposta repete a anterior", async () => {
    fetchApiMock.mockResolvedValue(
      respostaJson(200, {
        success: true,
        response: "Você já tem alguma praia em mente?",
        avisos: ["Esta resposta é idêntica à anterior — sinal de que o histórico não chegou ao modelo."],
      })
    );

    await enviar();
    await waitFor(() => {
      expect(screen.getByText(/idêntica à anterior/)).toBeTruthy();
    });
  });
});

describe("o turno da LLM ganha tempo suficiente", () => {
  it("a chamada pede timeout maior que o padrão de 15s", async () => {
    fetchApiMock.mockResolvedValue(respostaJson(200, { success: true, response: "oi" }));
    await enviar();
    await waitFor(() => expect(fetchApiMock).toHaveBeenCalled());
    const [, init] = fetchApiMock.mock.calls[0] as [string, { timeoutMs?: number }];
    expect(init.timeoutMs).toBeGreaterThan(15000);
  });
});
