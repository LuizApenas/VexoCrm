// A marcacao de chip do Agente IA era gravada e depois lida como vazia.
//
// getLeadClientN8nSettingsMap (usado por GET /api/lead-clients, que alimenta
// client.n8n_settings na tela) e getLeadClientN8nSettings / getLeadClientN8nSettingsStatus
// devem expor rigorosamente os MESMOS campos para o mesmo tenant.
//
// Este teste valida o comportamento REAL (invocação de funções e asserção de dados observáveis).

import { describe, expect, it, vi } from "vitest";
import {
  getLeadClientN8nSettingsStatus,
  getLeadClientN8nSettingsMap,
  maskN8nSettings,
  resolveSingleLeadClientSettings,
} from "../services/n8nSettings.js";
import { _setPgDatabasePoolForTesting } from "../services/database.js";

describe("chatbot_instances e configuracoes de Evolution: paridade entre Status e Map", () => {
  it("Status e Map devolvem os MESMOS campos e valores para o mesmo clientId", async () => {
    const CLIENT_ID = "tenant-paridade-test";

    const mockRow = {
      client_id: CLIENT_ID,
      active: true,
      dispatch_webhook_url: "https://evo.vexo.com/message/sendText/chip-default",
      dispatch_webhook_token: "token-default",
      inbound_bearer_token: "inbound-123",
      chatbot_enabled: true,
      chatbot_model: "claude-3-5-sonnet",
      chatbot_llm_model: "gpt-4o",
      chatbot_system_prompt: "Você é um assistente de vendas",
      chatbot_instances: ["chip-principal", "chip-reserva"],
      sdr_whatsapp_number: "5511999999999",
      allowed_tabs: ["dashboard", "campanhas"],
      segmentation_config: { auto: true },
      plan_tier: "modular",
      modulos_avulsos: ["banco-de-dados"],
      degustacao_expira_em: "2026-12-31T23:59:59Z",
      updated_at: "2026-08-23T12:00:00Z",
    };

    const mockEvolutionInstances = [
      {
        id: "chip-uuid-1",
        client_id: CLIENT_ID,
        name: "chip-principal",
        active: true,
        is_default: true,
        dispatch_webhook_url: "https://evo.vexo.com/message/sendText/chip-principal",
        dispatch_webhook_token: "tok-1",
        daily_limit_override: 100,
        chip_state: "warm",
      },
    ];

    const fakePool = {
      query: vi.fn().mockImplementation((queryText, params) => {
        const sql = typeof queryText === "string" ? queryText : queryText?.text || "";
        if (sql.includes("FROM public.lead_client_evolution_instances")) {
          return Promise.resolve({ rows: mockEvolutionInstances });
        }
        if (sql.includes("lead_client_n8n_settings")) {
          return Promise.resolve({ rows: [mockRow] });
        }
        return Promise.resolve({ rows: [] });
      }),
    };
    _setPgDatabasePoolForTesting(fakePool);

    try {
      // 1. Invocação de getLeadClientN8nSettingsStatus (leitura unitária)
      const statusResult = await getLeadClientN8nSettingsStatus(CLIENT_ID);
      expect(statusResult.schemaAvailable).toBe(true);
      const settingsSingle = statusResult.settings;

      // 2. Invocação de getLeadClientN8nSettingsMap (leitura em lote)
      const mapResult = await getLeadClientN8nSettingsMap([CLIENT_ID]);
      const settingsMap = mapResult[CLIENT_ID];

      // 3. Asserção de paridade exata
      expect(settingsSingle).toBeDefined();
      expect(settingsMap).toBeDefined();
      expect(settingsSingle.chatbot_instances).toEqual(["chip-principal", "chip-reserva"]);
      expect(settingsMap.chatbot_instances).toEqual(["chip-principal", "chip-reserva"]);

      expect(settingsSingle.plan_tier).toBe("modular");
      expect(settingsMap.plan_tier).toBe("modular");

      expect(settingsSingle.modulos_avulsos).toEqual(["banco-de-dados"]);
      expect(settingsMap.modulos_avulsos).toEqual(["banco-de-dados"]);

      expect(settingsSingle.sdr_whatsapp_number).toBe("5511999999999");
      expect(settingsMap.sdr_whatsapp_number).toBe("5511999999999");

      expect(settingsSingle).toEqual(settingsMap);
    } finally {
      _setPgDatabasePoolForTesting(null);
    }
  });

  it("maskN8nSettings preserva a lista marcada e nao inventa default", () => {
    const marcado = maskN8nSettings({ client_id: "geracao-digital", chatbot_instances: ["geracao-digital"] });
    expect(marcado.chatbot_instances).toEqual(["geracao-digital"]);

    // Coluna ausente vira [] — comportamento correto da mascara.
    const semColuna = maskN8nSettings({ client_id: "geracao-digital" });
    expect(semColuna.chatbot_instances).toEqual([]);
  });

  it("resolveSingleLeadClientSettings unifica a row com as instancias Evolution mascaradas", () => {
    const row = {
      client_id: "vexo",
      chatbot_instances: ["inst-1"],
      dispatch_webhook_url: "https://evo.vexo.com/default",
    };
    const instances = [
      { id: "i1", name: "inst-1", active: true, dispatch_webhook_url: "https://evo.vexo.com/i1" },
    ];
    const resolved = resolveSingleLeadClientSettings(row, instances);
    expect(resolved.chatbot_instances).toEqual(["inst-1"]);
    expect(resolved.evolution_instances).toHaveLength(1);
    expect(resolved.evolution_instances[0].id).toBe("i1");
    expect(resolved.evolution_instances[0].name).toBe("inst-1");
  });
});
