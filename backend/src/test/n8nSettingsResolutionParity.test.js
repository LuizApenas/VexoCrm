import { describe, expect, it } from "vitest";
import {
  resolveSingleLeadClientSettings,
  maskN8nSettings,
} from "../services/n8nSettings.js";
import { selectDefaultEvolutionInstance } from "../services/evolution.js";
import { resolveCampaignDispatchSettings } from "../campaign/settings.js";

describe("paridade de resolucao de settings e merge de evolution instances", () => {
  const mockRow = {
    client_id: "geracao-digital",
    dispatch_webhook_url: null,
    dispatch_webhook_token: null,
    inbound_bearer_token: "token-inbound-123",
    active: true,
    chatbot_enabled: true,
    chatbot_model: "outlier",
    chatbot_instances: ["geracao-digital"],
  };

  it("mergeia chip ativo mesmo quando lead_client_n8n_settings tem dispatch_webhook_url null", () => {
    const instances = [
      {
        id: "inst-1",
        client_id: "geracao-digital",
        name: "WhatsApp Vendas",
        dispatch_webhook_url: "https://evolution.example.com/message/sendText/vendas",
        dispatch_webhook_token: "token-evo-123",
        active: true,
        is_default: true,
      },
    ];

    const resolved = resolveSingleLeadClientSettings(mockRow, instances);

    expect(resolved.client_id).toBe("geracao-digital");
    expect(resolved.dispatch_webhook_url).toBe("https://evolution.example.com/message/sendText/vendas");
    expect(resolved.dispatch_webhook_token).toBe("token-evo-123");
    expect(resolved.evolution_instance_name).toBe("WhatsApp Vendas");
    expect(resolved.evolution_instance_id).toBe("inst-1");
    expect(resolved.evolution_instances).toHaveLength(1);
  });

  it("NUNCA resolve para chip inativo, mesmo se marcado is_default=true", () => {
    const deadInstance = [
      {
        id: "inst-dead",
        client_id: "geracao-digital",
        name: "WhatsApp Morto",
        dispatch_webhook_url: "https://evolution.example.com/message/sendText/morto",
        dispatch_webhook_token: "token-dead",
        active: false,
        is_default: true,
      },
    ];

    const resolved = resolveSingleLeadClientSettings(mockRow, deadInstance);

    expect(resolved.dispatch_webhook_url).toBeNull();
    expect(resolved.has_dispatch_webhook_token).toBe(false);
    expect(resolved.evolution_instance_id).toBeUndefined();
  });

  it("escolhe chip ativo nao-padrao quando o chip padrao esta inativo", () => {
    const instances = [
      {
        id: "inst-dead",
        client_id: "geracao-digital",
        name: "WhatsApp Desconectado",
        dispatch_webhook_url: "https://evolution.example.com/message/sendText/dead",
        active: false,
        is_default: true,
      },
      {
        id: "inst-live",
        client_id: "geracao-digital",
        name: "WhatsApp Reserva Ativo",
        dispatch_webhook_url: "https://evolution.example.com/message/sendText/reserva",
        active: true,
        is_default: false,
      },
    ];

    const resolved = resolveSingleLeadClientSettings(mockRow, instances);

    expect(resolved.dispatch_webhook_url).toBe("https://evolution.example.com/message/sendText/reserva");
    expect(resolved.evolution_instance_name).toBe("WhatsApp Reserva Ativo");
    expect(resolved.evolution_instance_id).toBe("inst-live");
  });

  it("selectDefaultEvolutionInstance devolve null se todos os chips estiverem inativos", () => {
    const selected = selectDefaultEvolutionInstance([
      { id: "1", active: false, is_default: true },
      { id: "2", active: false, is_default: false },
    ]);
    expect(selected).toBeNull();
  });

  it("resolveCampaignDispatchSettings nunca devolve chip de fallback global quando tenant nao tem chip", async () => {
    const res = await resolveCampaignDispatchSettings("tenant-sem-chip", {});
    expect(res.webhookUrl).toBeNull();
    expect(res.source).toBe("tenant_settings_missing");
  });

  it("maskN8nSettings preserva e preenche colunas de send_window com defaults", () => {
    const masked = maskN8nSettings({
      client_id: "tenant-teste",
      send_window_start: "09:00",
      send_window_end: "18:00",
      send_window_days: ["mon", "wed", "fri"],
      send_window_timezone: "America/Manaus",
      send_window_enabled: true,
      agent_replies_outside_window: false,
    });

    expect(masked.send_window_start).toBe("09:00");
    expect(masked.send_window_end).toBe("18:00");
    expect(masked.send_window_days).toEqual(["mon", "wed", "fri"]);
    expect(masked.send_window_timezone).toBe("America/Manaus");
    expect(masked.send_window_enabled).toBe(true);
    expect(masked.agent_replies_outside_window).toBe(false);
  });
});
