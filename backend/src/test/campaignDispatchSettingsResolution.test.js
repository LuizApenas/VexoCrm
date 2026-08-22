import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

const settingsSource = readFileSync(resolve("src/campaign/settings.js"), "utf8");
const campaignRoutesSource = readFileSync(resolve("src/domains/campaigns/routes.js"), "utf8");

describe("auto-resolucao de instancias evolution em campanhas", () => {
  const bloco = settingsSource.slice(
    settingsSource.indexOf("export async function resolveCampaignDispatchSettings")
  );

  it("seleciona automaticamente a primeira instancia ativa se nenhuma especifica foi definida", () => {
    expect(bloco).toContain("activeInstances.length > 0");
    expect(bloco).toContain("source: \"auto_primary_evolution_instance\"");
    expect(bloco).toContain("selectedEvolutionInstanceName: primaryInstance.name || \"WhatsApp Principal\"");
  });

  it("NAO aplica fallback global de chip para garantir isolamento multi-tenant", () => {
    expect(bloco).not.toContain("https://evolution.vexoia.com");
    expect(bloco).toContain("tenant_settings_missing");
  });
});

describe("flexibilizacao da criacao de campanhas", () => {
  const createCampaignSlice = campaignRoutesSource.slice(
    campaignRoutesSource.indexOf('app.post("/api/campaigns"'),
    campaignRoutesSource.indexOf('app.put("/api/campaigns/:id"')
  );

  it("permite criar campanhas com webhook padrao e nao bloqueia criacao com 400", () => {
    expect(createCampaignSlice).not.toContain("EVOLUTION_SETTINGS_MISSING");
    expect(createCampaignSlice).toContain("lifecycleStatus === \"active\" && webhookUrl && !webhookUrl.includes(\"example\")");
  });
});
