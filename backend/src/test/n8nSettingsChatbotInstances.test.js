// A marcacao de chip do Agente IA era gravada e depois lida como vazia.
//
// getLeadClientN8nSettingsMap (usado por GET /api/lead-clients, que alimenta
// client.n8n_settings na tela) NAO pedia chatbot_instances no SELECT, enquanto
// getLeadClientN8nSettings pedia. Coluna ausente -> maskN8nSettings devolve [] ->
// a tela reidrata em "Todos sem agente inbound" e a escolha some.
//
// Este teste trava a lista de colunas: qualquer campo que maskN8nSettings exponha
// tem de estar nos DOIS selects.

import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";
import { maskN8nSettings } from "../services/n8nSettings.js";

const source = readFileSync(resolve("src/services/n8nSettings.js"), "utf8");

function selectColumnsOf(functionName) {
  const start = source.indexOf(`export async function ${functionName}`);
  expect(start, `${functionName} nao encontrada`).toBeGreaterThan(-1);
  const slice = source.slice(start, start + 2500);
  const match = slice.match(/\.select\(\s*(?:\/\/[^\n]*\n\s*)*"([^"]+)"/);
  expect(match, `select de ${functionName} nao encontrado`).toBeTruthy();
  return match[1].split(",").map((c) => c.trim());
}

describe("chatbot_instances sobrevive da gravacao ate a tela", () => {
  it("getLeadClientN8nSettingsMap pede chatbot_instances (era o bug)", () => {
    expect(selectColumnsOf("getLeadClientN8nSettingsMap")).toContain("chatbot_instances");
  });

  it("os dois selects cobrem tudo que maskN8nSettings expoe", () => {
    const single = selectColumnsOf("getLeadClientN8nSettings");
    const map = selectColumnsOf("getLeadClientN8nSettingsMap");

    // Campos que a mascara le direto da row (evolution_instances vem de outra query).
    const exposed = ["chatbot_enabled", "chatbot_model", "chatbot_instances", "sdr_whatsapp_number", "allowed_tabs", "segmentation_config", "plan_tier", "modulos_avulsos", "degustacao_expira_em"];
    for (const column of exposed) {
      expect(single, `${column} ausente em getLeadClientN8nSettings`).toContain(column);
      expect(map, `${column} ausente em getLeadClientN8nSettingsMap`).toContain(column);
    }
  });

  it("maskN8nSettings preserva a lista marcada e nao inventa default", () => {
    const marcado = maskN8nSettings({ client_id: "geracao-digital", chatbot_instances: ["geracao-digital"] });
    expect(marcado.chatbot_instances).toEqual(["geracao-digital"]);

    // Coluna ausente vira [] — comportamento correto da mascara. O defeito estava
    // no SELECT que a fazia receber undefined, nao aqui.
    const semColuna = maskN8nSettings({ client_id: "geracao-digital" });
    expect(semColuna.chatbot_instances).toEqual([]);
  });
});
