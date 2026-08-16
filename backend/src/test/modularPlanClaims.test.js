import { describe, expect, it } from "vitest";
import { deriveTenantInternalPages, INTERNAL_PAGE_KEYS } from "../access/claims.js";
import { AVAILABLE_CUSTOM_MODULES, deriveEffectivePermissions } from "../access/permissionsRegistry.js";

describe("Modular Plan Claims & Gating", () => {
  it("exports all 10 canonical custom modules in registry", () => {
    expect(AVAILABLE_CUSTOM_MODULES).toHaveLength(10);
    const ids = AVAILABLE_CUSTOM_MODULES.map((m) => m.id);
    expect(ids).toContain("disparador_campanhas");
    expect(ids).toContain("agente_inbound");
    expect(ids).toContain("agente_rag");
    expect(ids).toContain("followup");
    expect(ids).toContain("followup_automations");
    expect(ids).toContain("sdr_broadcast");
    expect(ids).toContain("multiplos_chips");
    expect(ids).toContain("origem_leads");
    expect(ids).toContain("antiban_groq");
    expect(ids).toContain("relatorios");
  });

  it("includes banco-de-dados in INTERNAL_PAGE_KEYS", () => {
    expect(INTERNAL_PAGE_KEYS).toContain("banco-de-dados");
  });

  it("derives universal base plus only contracted pages for modular tenant with disparador_campanhas", () => {
    const tenant = {
      id: "teste-modular",
      plan_tier: "modular",
      modulos_avulsos: ["disparador_campanhas"],
    };

    const pages = deriveTenantInternalPages(tenant);

    // Base universal
    expect(pages).toContain("dashboard");
    expect(pages).toContain("leads");
    expect(pages).toContain("banco-de-dados");
    expect(pages).toContain("whatsapp");
    expect(pages).toContain("onboarding-wizard");

    // Contracted module pages
    expect(pages).toContain("campanhas");
    expect(pages).toContain("planilhas");
    expect(pages).toContain("disparos");

    // Uncontracted module pages
    expect(pages).not.toContain("agente");
    expect(pages).not.toContain("chatbot-docs");
    expect(pages).not.toContain("relatorios");
    expect(pages).not.toContain("conexoes");
    expect(pages).not.toContain("inteligencia-comercial");
  });

  it("grants permissions only for contracted modules and universal base", () => {
    const tenant = {
      id: "teste-modular",
      plan_tier: "modular",
      modulos_avulsos: ["disparador_campanhas"],
    };

    const internalPages = deriveTenantInternalPages(tenant);
    const effectivePermissions = deriveEffectivePermissions({
      isAdmin: false,
      role: "internal",
      internalPages,
    });

    // Allowed permissions
    expect(effectivePermissions).toContain("dashboard.view");
    expect(effectivePermissions).toContain("leads.view");
    expect(effectivePermissions).toContain("banco_dados.view");
    expect(effectivePermissions).toContain("campaigns.view");
    expect(effectivePermissions).toContain("campaigns.create");
    expect(effectivePermissions).toContain("dispatches.execute");
    expect(effectivePermissions).toContain("whatsapp.view");

    // Denied permissions for uncontracted modules
    expect(effectivePermissions).not.toContain("agente.view");
    expect(effectivePermissions).not.toContain("agente.toggle");
    expect(effectivePermissions).not.toContain("agente.edit_prompt");
    expect(effectivePermissions).not.toContain("reports.commercial");
    expect(effectivePermissions).not.toContain("reports.export_pdf");
    expect(effectivePermissions).not.toContain("users.manage");
    expect(effectivePermissions).not.toContain("tenants.manage");
  });

  it("derives correct pages for modular tenant with multiple custom modules", () => {
    const tenant = {
      id: "teste-multi",
      plan_tier: "modular",
      n8n_settings: {
        modulos_avulsos: ["agente_rag", "relatorios", "multiplos_chips"],
      },
    };

    const pages = deriveTenantInternalPages(tenant);

    // Universal base
    expect(pages).toContain("dashboard");
    expect(pages).toContain("leads");
    expect(pages).toContain("banco-de-dados");
    expect(pages).toContain("whatsapp");

    // Contracted modules
    expect(pages).toContain("chatbot-docs");
    expect(pages).toContain("agente");
    expect(pages).toContain("relatorios");
    expect(pages).toContain("conexoes");
    expect(pages).toContain("aquecimento");

    // Uncontracted
    expect(pages).not.toContain("campanhas");
    expect(pages).not.toContain("planilhas");
    expect(pages).not.toContain("disparos");
  });

  it("leaves essencial and avancado plans intact", () => {
    const essencialTenant = { plan_tier: "essencial" };
    const avancadoTenant = { plan_tier: "avancado" };

    const essencialPages = deriveTenantInternalPages(essencialTenant);
    expect(essencialPages).toContain("dashboard");
    expect(essencialPages).toContain("campanhas");
    expect(essencialPages).toContain("agente");
    expect(essencialPages).toContain("followup");

    const avancadoPages = deriveTenantInternalPages(avancadoTenant);
    expect(avancadoPages).toEqual(INTERNAL_PAGE_KEYS);
  });
});
