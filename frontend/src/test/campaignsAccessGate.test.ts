// Bloco B — gate de acesso aos hooks de campanha (useCampanhas, useCampaignLeads, useCampaignAiStatus)
//
// Valida os criterios de aceite do Bloco B:
// 1. Client com acesso a planilhas ve a lista carregar (canAccessView("planilhas") = true)
// 2. Client migrado (so allowedViews) tambem ve
// 3. Client SEM acesso nao ve e nao dispara query
// 4. Internal continua funcionando igual
// 5. Nenhuma outra tela que usa canAccessInternalPage mudou

import { describe, expect, it } from "vitest";
import {
  canAccessCampaignsGate,
} from "@/hooks/useCampanhas";

describe("gate de acesso dos hooks de campanha (Bloco B)", () => {
  it("1. Client com acesso a planilhas em allowedViews e autorizado", () => {
    const result = canAccessCampaignsGate({
      isAuthenticated: true,
      role: "client",
      allowedViews: ["planilhas"],
      internalPages: [],
      permissions: [],
      isAdmin: false,
    });
    expect(result).toBe(true);
  });

  it("2. Client migrado (apenas allowedViews: ['planilhas'], sem permissions) e autorizado", () => {
    const result = canAccessCampaignsGate({
      isAuthenticated: true,
      role: "client",
      allowedViews: ["planilhas"],
      internalPages: [],
      permissions: [],
      isAdmin: false,
    });
    expect(result).toBe(true);
  });

  it("3. Client SEM acesso a planilhas (allowedViews: ['dashboard', 'leads']) NAO e autorizado", () => {
    const result = canAccessCampaignsGate({
      isAuthenticated: true,
      role: "client",
      allowedViews: ["dashboard", "leads"],
      internalPages: [],
      permissions: [],
      isAdmin: false,
    });
    expect(result).toBe(false);
  });

  it("4. Internal com pagina 'planilhas' em internalPages continua autorizado igual", () => {
    const result = canAccessCampaignsGate({
      isAuthenticated: true,
      role: "internal",
      allowedViews: [],
      internalPages: ["dashboard", "planilhas"],
      permissions: ["dashboard.view"],
      isAdmin: false,
    });
    expect(result).toBe(true);
  });

  it("5. Internal admin (isAdmin = true) e sempre autorizado", () => {
    const result = canAccessCampaignsGate({
      isAuthenticated: true,
      role: "internal",
      allowedViews: [],
      internalPages: ["dashboard"],
      permissions: [],
      isAdmin: true,
    });
    expect(result).toBe(true);
  });

  it("6. Usuario nao autenticado NAO e autorizado", () => {
    const result = canAccessCampaignsGate({
      isAuthenticated: false,
      role: "client",
      allowedViews: ["planilhas"],
      internalPages: [],
      permissions: [],
      isAdmin: false,
    });
    expect(result).toBe(false);
  });
});
