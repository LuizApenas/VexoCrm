import { describe, expect, it } from "vitest";
import { extractManagedAccessClaims } from "../access/claims.js";

describe("Dual-Format Claim Expansion (Old Full Lists vs New Preset + Grant/Revoke)", () => {
  it("lê perfeitamente o formato antigo com lista completa de permissões e páginas", () => {
    const oldClaim = {
      role: "internal",
      isAdmin: false,
      accessPreset: "gestor",
      scopeMode: "assigned_clients",
      approvalLevel: "manager",
      clientId: "tinge-brasil",
      clientIds: ["tinge-brasil"],
      internalPages: ["dashboard", "whatsapp", "campanhas"],
      permissions: ["dashboard.view", "whatsapp.view", "whatsapp.reply"],
    };

    const extracted = extractManagedAccessClaims(oldClaim, { uid: "u1", email: "user@test.com" });
    expect(extracted.role).toBe("internal");
    expect(extracted.accessPreset).toBe("gestor");
    expect(extracted.internalPages).toContain("dashboard");
    expect(extracted.internalPages).toContain("whatsapp");
    expect(extracted.internalPages).toContain("campanhas");
    expect(extracted.permissions).toContain("dashboard.view");
    expect(extracted.permissions).toContain("whatsapp.view");
    expect(extracted.permissions).toContain("whatsapp.reply");
  });

  it("expande formato novo (preset + grant/revoke) sem precisar de lista estática gravada", () => {
    const newClaim = {
      role: "internal",
      isAdmin: false,
      accessPreset: "gestor",
      scopeMode: "assigned_clients",
      approvalLevel: "manager",
      clientId: "tinge-brasil",
      clientIds: ["tinge-brasil"],
      grant: [],
      revoke: ["geracao_digital.proposals", "geracao_digital.prices"],
    };

    const extracted = extractManagedAccessClaims(newClaim, { uid: "u2", email: "carlos@test.com" });
    expect(extracted.role).toBe("internal");
    expect(extracted.accessPreset).toBe("gestor");

    // Deve conter todas as permissões padrão do gestor
    expect(extracted.permissions).toContain("dashboard.view");
    expect(extracted.permissions).toContain("leads.view");
    expect(extracted.permissions).toContain("banco_dados.import");
    expect(extracted.permissions).toContain("whatsapp.view");
    expect(extracted.permissions).toContain("whatsapp.reply");
    expect(extracted.permissions).toContain("agente.view");
    expect(extracted.permissions).toContain("users.view");
    expect(extracted.permissions).toContain("users.manage");

    // E não deve conter as permissões revogadas
    expect(extracted.permissions).not.toContain("geracao_digital.proposals");
    expect(extracted.permissions).not.toContain("geracao_digital.prices");
  });

  it("garante que revogações explícitas (ex.: Gabriel sem gestão de usuários) funcionam", () => {
    const gabrielClaim = {
      role: "internal",
      isAdmin: false,
      accessPreset: "gestor",
      scopeMode: "assigned_clients",
      approvalLevel: "manager",
      clientId: "geracao-digital",
      clientIds: ["geracao-digital"],
      grant: [],
      revoke: ["users.view", "users.manage", "geracao_digital.proposals", "geracao_digital.prices"],
    };

    const extracted = extractManagedAccessClaims(gabrielClaim, { uid: "u3", email: "gabriel@test.com" });
    expect(extracted.permissions).not.toContain("users.view");
    expect(extracted.permissions).not.toContain("users.manage");
    expect(extracted.permissions).not.toContain("geracao_digital.proposals");
    expect(extracted.permissions).toContain("dashboard.view");
    expect(extracted.permissions).toContain("whatsapp.view");
  });

  it("garante que concessões explícitas além do preset (grant) são adicionadas", () => {
    const operadorWithExtra = {
      role: "internal",
      isAdmin: false,
      accessPreset: "operador",
      scopeMode: "assigned_clients",
      approvalLevel: "operator",
      clientId: "sonhare",
      clientIds: ["sonhare"],
      grant: ["campaigns.view", "campaigns.create", "dispatches.execute"],
      revoke: [],
    };

    const extracted = extractManagedAccessClaims(operadorWithExtra, { uid: "u4", email: "sonhare@test.com" });
    // Permissões padrão do operador
    expect(extracted.permissions).toContain("dashboard.view");
    expect(extracted.permissions).toContain("whatsapp.view");
    // Permissões extras concedidas via grant
    expect(extracted.permissions).toContain("campaigns.view");
    expect(extracted.permissions).toContain("campaigns.create");
    expect(extracted.permissions).toContain("dispatches.execute");
  });

  it("admin_vexo sempre recebe todas as permissões", () => {
    const adminClaim = {
      role: "internal",
      isAdmin: true,
      accessPreset: "admin_vexo",
      scopeMode: "all_clients",
      clientId: "vexo",
      clientIds: ["vexo"],
    };

    const extracted = extractManagedAccessClaims(adminClaim, { uid: "u5", email: "admin@vexo.com.br" });
    expect(extracted.isAdmin).toBe(true);
    expect(extracted.permissions).toContain("dashboard.view");
    expect(extracted.permissions).toContain("users.manage");
    expect(extracted.permissions).toContain("tenants.manage");
  });
});
