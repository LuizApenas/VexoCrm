import { describe, expect, it } from "vitest";
import { resolveCampaignDispatchSettings } from "../campaign/settings.js";

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
});
