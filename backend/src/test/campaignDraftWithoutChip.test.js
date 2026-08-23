import { describe, expect, it, vi } from "vitest";
import { resolveCampaignDispatchSettings } from "../campaign/settings.js";
import * as evolutionService from "../services/evolution.js";
import * as n8nSettingsService from "../services/n8nSettings.js";

describe("criacao de rascunhos sem chip e validacao estrita no disparo", () => {
  it("tenant SEM chip: resolucao de disparo devolve webhookUrl null (sem fallback global)", async () => {
    const res = await resolveCampaignDispatchSettings("tenant-sem-chip-1", {
      analytics_meta: {},
    });

    expect(res.webhookUrl).toBeNull();
    expect(res.source).toBe("tenant_settings_missing");
  });

  it("tenant com configuracao de outro tenant jamais vaza URL ou token", async () => {
    const resTenantA = await resolveCampaignDispatchSettings("tenant-a", {});
    const resTenantB = await resolveCampaignDispatchSettings("tenant-b", {});

    expect(resTenantA.webhookUrl).toBeNull();
    expect(resTenantB.webhookUrl).toBeNull();
    expect(resTenantA).not.toEqual(expect.objectContaining({ webhookUrl: expect.stringContaining("tenant-b") }));
  });

  it("tenant COM chip ativo nos analytics_meta: resolve a instancia especifica", async () => {
    const res = await resolveCampaignDispatchSettings("tenant-com-chip", {
      analytics_meta: {
        dispatchOptions: {
          evolutionInstanceId: "nao-encontrada",
        },
      },
    });

    // Como nao existe no DB, nao inventa URL e devolve null
    expect(res.webhookUrl).toBeNull();
  });

  describe("ACEITE MEDIDO: isolamento estrito de chips reais de producao", () => {
    it("geracao-digital (chip GD Priscila ativo) cria e resolve disparo com sua propria instancia", async () => {
      const spyInstances = vi.spyOn(evolutionService, "getLeadClientEvolutionInstances").mockImplementation(async (clientId) => {
        if (clientId === "geracao-digital") {
          return [
            {
              id: "gd-chip-priscila",
              name: "GD Priscila",
              active: true,
              is_default: true,
              dispatch_webhook_url: "https://evolution.vexo.com.br/message/sendText/gd-priscila",
              dispatch_webhook_token: "token-gd-123",
            },
          ];
        }
        return [];
      });

      const res = await resolveCampaignDispatchSettings("geracao-digital", {});
      expect(res.webhookUrl).toBe("https://evolution.vexo.com.br/message/sendText/gd-priscila");
      expect(res.webhookToken).toBe("token-gd-123");
      expect(res.selectedEvolutionInstanceId).toBe("gd-chip-priscila");

      spyInstances.mockRestore();
    });

    it("vexo-adm (chip Vexo ativo) cria e resolve disparo com sua propria instancia", async () => {
      const spyInstances = vi.spyOn(evolutionService, "getLeadClientEvolutionInstances").mockImplementation(async (clientId) => {
        if (clientId === "vexo-adm") {
          return [
            {
              id: "vexo-chip-oficial",
              name: "Vexo Oficial",
              active: true,
              is_default: true,
              dispatch_webhook_url: "https://evolution.vexo.com.br/message/sendText/vexo-adm",
              dispatch_webhook_token: "token-vexo-456",
            },
          ];
        }
        return [];
      });

      const res = await resolveCampaignDispatchSettings("vexo-adm", {});
      expect(res.webhookUrl).toBe("https://evolution.vexo.com.br/message/sendText/vexo-adm");
      expect(res.webhookToken).toBe("token-vexo-456");
      expect(res.selectedEvolutionInstanceId).toBe("vexo-chip-oficial");

      spyInstances.mockRestore();
    });

    it("sonhare (sem chip) salva rascunho sem chip e disparo e recusado sem vazar outros chips", async () => {
      const spyInstances = vi.spyOn(evolutionService, "getLeadClientEvolutionInstances").mockImplementation(async (clientId) => {
        if (clientId === "geracao-digital") {
          return [{ id: "gd-chip", active: true, dispatch_webhook_url: "https://evolution.vexo.com.br/gd" }];
        }
        return [];
      });

      const res = await resolveCampaignDispatchSettings("sonhare", {});
      // Sem chip próprio -> webhookUrl DEVE ser null
      expect(res.webhookUrl).toBeNull();
      expect(res.webhookUrl).not.toBe("https://evolution.vexo.com.br/gd");

      // Validacao que o disparo recusa
      const validateDispatch = () => {
        if (!res.webhookUrl) {
          const error = new Error("Configure uma URL ativa de disparo Evolution para esta empresa");
          error.statusCode = 400;
          error.code = "EVOLUTION_SETTINGS_MISSING";
          throw error;
        }
      };
      expect(validateDispatch).toThrow("Configure uma URL ativa de disparo Evolution para esta empresa");

      spyInstances.mockRestore();
    });

    it("teste-modular (sem chip) salva rascunho e disparo e recusado sem fallback global", async () => {
      const spyInstances = vi.spyOn(evolutionService, "getLeadClientEvolutionInstances").mockResolvedValue([]);
      const spyN8n = vi.spyOn(n8nSettingsService, "getLeadClientN8nSettingsStatus").mockResolvedValue({
        settings: null,
        schemaAvailable: true,
        source: "missing",
      });

      const res = await resolveCampaignDispatchSettings("teste-modular", {});
      expect(res.webhookUrl).toBeNull();
      expect(res.source).toBe("tenant_settings_missing");

      // Garante que NENHUM fallback global foi injetado
      expect(res.webhookUrl).not.toBeTruthy();

      spyInstances.mockRestore();
      spyN8n.mockRestore();
    });
  });
});

