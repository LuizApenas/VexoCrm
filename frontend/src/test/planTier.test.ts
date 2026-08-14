import { describe, it, expect } from "vitest";
import { resolveTenantPlan, hasFeatureUnlocked } from "../lib/planTier";

describe("planTier resolver", () => {
  it("defaults to essencial when no client or plan is provided", () => {
    expect(resolveTenantPlan(undefined)).toBe("essencial");
    expect(resolveTenantPlan({})).toBe("essencial");
    expect(resolveTenantPlan({ name: "Empresa Solar" })).toBe("essencial");
  });

  it("identifies essencial plan correctly across various fields", () => {
    expect(resolveTenantPlan({ plan_tier: "essencial" })).toBe("essencial");
    expect(resolveTenantPlan({ plan_type: "essencial" })).toBe("essencial");
    expect(resolveTenantPlan({ model_type: "essencial" })).toBe("essencial");
    expect(resolveTenantPlan({ n8n_settings: { plan_tier: "essencial" } })).toBe("essencial");
  });

  it("identifies avancado plan correctly across various fields", () => {
    expect(resolveTenantPlan({ plan_tier: "avancado" })).toBe("avancado");
    expect(resolveTenantPlan({ plan_type: "avancado" })).toBe("avancado");
    expect(resolveTenantPlan({ model_type: "avancado" })).toBe("avancado");
    expect(resolveTenantPlan({ n8n_settings: { plan_tier: "avancado" } })).toBe("avancado");
    expect(resolveTenantPlan({ plan_tier: "advanced" })).toBe("avancado");
    expect(resolveTenantPlan({ plan_tier: "pro" })).toBe("avancado");
  });

  it("unlocks all features when tenant is in Plano Avancado", () => {
    const advancedTenant = { plan_tier: "avancado" };
    expect(hasFeatureUnlocked(advancedTenant, "followup_automations")).toBe(true);
    expect(hasFeatureUnlocked(advancedTenant, "antiban_groq")).toBe(true);
    expect(hasFeatureUnlocked(advancedTenant, "agente_campanha")).toBe(true);
    expect(hasFeatureUnlocked(advancedTenant, "agente_rag")).toBe(true);
  });

  it("locks advanced features when tenant is in Plano Essencial without degustacao", () => {
    const essencialTenant = { plan_tier: "essencial" };
    expect(hasFeatureUnlocked(essencialTenant, "followup_automations")).toBe(false);
    expect(hasFeatureUnlocked(essencialTenant, "antiban_groq")).toBe(false);
    expect(hasFeatureUnlocked(essencialTenant, "agente_campanha")).toBe(false);
    expect(hasFeatureUnlocked(essencialTenant, "agente_rag")).toBe(false);
  });

  it("unlocks specific features when tenant has individual module degustacao in modulos_avulsos", () => {
    const degustacaoTenant = {
      plan_tier: "essencial",
      modulos_avulsos: ["followup_automations", "agente_rag"],
    };
    expect(hasFeatureUnlocked(degustacaoTenant, "followup_automations")).toBe(true);
    expect(hasFeatureUnlocked(degustacaoTenant, "agente_rag")).toBe(true);
    expect(hasFeatureUnlocked(degustacaoTenant, "antiban_groq")).toBe(false);
    expect(hasFeatureUnlocked(degustacaoTenant, "agente_campanha")).toBe(false);
  });

  it("locks features when degustacao is expired (even if module is in modulos_avulsos)", () => {
    const pastDate = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(); // 1 day ago
    const expiredTenant = {
      plan_tier: "essencial",
      modulos_avulsos: ["followup_automations", "agente_rag"],
      degustacao_expira_em: pastDate,
    };
    expect(hasFeatureUnlocked(expiredTenant, "followup_automations")).toBe(false);
    expect(hasFeatureUnlocked(expiredTenant, "agente_rag")).toBe(false);
  });

  it("keeps features unlocked when degustacao is still active in future", () => {
    const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(); // 7 days ahead
    const activeTenant = {
      plan_tier: "essencial",
      modulos_avulsos: ["followup_automations", "agente_rag"],
      degustacao_expira_em: futureDate,
    };
    expect(hasFeatureUnlocked(activeTenant, "followup_automations")).toBe(true);
    expect(hasFeatureUnlocked(activeTenant, "agente_rag")).toBe(true);
  });
});
