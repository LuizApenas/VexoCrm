import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock das funções de banco de instâncias
vi.mock("../services/evolution.js", () => {
  return {
    getLeadClientEvolutionInstances: vi.fn(async (clientId) => {
      if (clientId === "tenant-sem-chip") return [];
      if (clientId === "geracao-digital") {
        return [
          {
            id: "inst-1",
            client_id: "geracao-digital",
            name: "GD Priscila",
            dispatch_webhook_url: "https://evolution.vexo.com.br/message/sendText/geracao-digital-gd-priscila",
            dispatch_webhook_token: "token-priscila",
            active: true,
            is_default: true,
          },
          {
            id: "inst-2",
            client_id: "geracao-digital",
            name: "GD Atendimento",
            dispatch_webhook_url: "https://evolution.vexo.com.br/message/sendText/geracao-digital-gd-atendimento",
            dispatch_webhook_token: "token-atendimento",
            active: true,
            is_default: false,
          },
        ];
      }
      return [];
    }),
    parseEvolutionWebhookEndpoint: (webhookUrl) => {
      if (!webhookUrl) return null;
      try {
        const url = new URL(webhookUrl);
        const parts = url.pathname.split("/").filter(Boolean);
        const idx = parts.findIndex((p) => p === "message");
        const instance = idx >= 0 ? decodeURIComponent(parts[idx + 2] || "") : "";
        return { origin: url.origin, instance };
      } catch {
        return null;
      }
    },
  };
});

import { resolveEvolutionInstanceForFollowup } from "../followup/worker.js";

describe("Follow-up Evolution Instance Resolver", () => {
  it("resolves exact instance slug from friendly display name 'GD Priscila'", async () => {
    const config = await resolveEvolutionInstanceForFollowup("geracao-digital", "GD Priscila");
    expect(config.instanceSlug).toBe("geracao-digital-gd-priscila");
    expect(config.displayName).toBe("GD Priscila");
    expect(config.apiKey).toBe("token-priscila");
    expect(config.baseUrl).toBe("https://evolution.vexo.com.br");
  });

  it("safely falls back to default active instance when company has a legacy or duplicated slug", async () => {
    // Caso de 'geracao-digital-geracao-digital' salvo na company
    const config = await resolveEvolutionInstanceForFollowup("geracao-digital", "geracao-digital-geracao-digital");
    expect(config.instanceSlug).toBe("geracao-digital-gd-priscila");
    expect(config.displayName).toBe("GD Priscila");
  });

  it("throws clear Portuguese error if tenant has no active chips connected", async () => {
    await expect(
      resolveEvolutionInstanceForFollowup("tenant-sem-chip", "Chip Desconhecido")
    ).rejects.toThrow(/Nenhum WhatsApp\/chip ativo conectado para o tenant 'tenant-sem-chip'/);
  });
});
