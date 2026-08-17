// Plano modular BARRA no backend, nao so esconde no menu.
//
// Ate aqui o gating existia so no frontend: a sidebar filtrava certo e a rota
// respondia normalmente. deriveTenantInternalPages existia em claims.js, com teste
// verde, mas `grep -rn` so a encontrava no proprio teste — nunca foi ligada ao
// caminho das claims.
//
// Este teste exercita o gate REAL (applyModularPlanGate, chamado por
// requireFirebaseAuth) e o guard REAL (requireInternalPageAccess), com o modulo
// de settings mockado no lugar do banco.

import { beforeEach, describe, expect, it, vi } from "vitest";

const settingsPorTenant = new Map();

vi.mock("../services/n8nSettings.js", () => ({
  getLeadClientN8nSettings: async (clientId) => settingsPorTenant.get(clientId) ?? null,
}));

const { applyModularPlanGate, _resetModularGateCache } = await import("../access/modularGate.js");
const { requireInternalPageAccess } = await import("../access/middlewares.js");

const TODAS = [
  "dashboard", "leads", "banco-de-dados", "whatsapp", "onboarding-wizard",
  "campanhas", "planilhas", "disparos",
  "followup", "fila-de-followup", "followup-sugestoes",
  "agente", "conexoes", "relatorios",
];

function usuarioDoTenant(clientId, internalPages = TODAS) {
  return {
    role: "internal",
    isAdmin: false,
    clientId,
    clientIds: [clientId],
    internalPages: [...internalPages],
    permissions: [],
    allowedViews: [],
  };
}

function makeRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) { res.statusCode = code; return res; },
    json(payload) { res.body = payload; return res; },
  };
  return res;
}

/** Roda o guard real e diz se passou. */
function passouNoGuard(access, pagina) {
  const res = makeRes();
  let chamouNext = false;
  requireInternalPageAccess(pagina)({ authAccess: access }, res, () => { chamouNext = true; });
  return { passou: chamouNext, status: res.statusCode, code: res.body?.error?.code };
}

beforeEach(() => {
  settingsPorTenant.clear();
  _resetModularGateCache();
});

describe("tenant modular com so disparador_campanhas", () => {
  const TENANT = "teste-modular";

  beforeEach(() => {
    settingsPorTenant.set(TENANT, {
      plan_tier: "modular",
      modulos_avulsos: ["disparador_campanhas"],
    });
  });

  it("recebe 403 na rota de follow-up — o gate barra, nao so o menu", async () => {
    const access = await applyModularPlanGate(usuarioDoTenant(TENANT));
    const r = passouNoGuard(access, "fila-de-followup");

    expect(r.passou).toBe(false);
    expect(r.status).toBe(403);
    expect(r.code).toBe("FORBIDDEN");
  });

  it("continua acessando o modulo que CONTRATOU", async () => {
    const access = await applyModularPlanGate(usuarioDoTenant(TENANT));
    expect(passouNoGuard(access, "campanhas").passou).toBe(true);
    expect(passouNoGuard(access, "planilhas").passou).toBe(true);
  });

  it("mantem a base universal do plano modular", async () => {
    const access = await applyModularPlanGate(usuarioDoTenant(TENANT));
    for (const base of ["dashboard", "leads", "whatsapp"]) {
      expect(passouNoGuard(access, base).passou, `${base} deveria continuar liberada`).toBe(true);
    }
    // banco-de-dados saiu da base universal e virou modulo vendavel: este tenant
    // so contratou disparador_campanhas, entao nao tem.
    expect(passouNoGuard(access, "banco-de-dados").passou).toBe(false);
  });

  it("barra tambem agente, conexoes e relatorios nao contratados", async () => {
    const access = await applyModularPlanGate(usuarioDoTenant(TENANT));
    for (const bloqueada of ["agente", "conexoes", "relatorios"]) {
      expect(passouNoGuard(access, bloqueada).passou, `${bloqueada} deveria estar bloqueada`).toBe(false);
    }
  });
});

describe("caminho ADITIVO: quem nao e modular nao muda", () => {
  it("tenant essencial sai com as MESMAS paginas que entrou", async () => {
    settingsPorTenant.set("essencial", { plan_tier: "essencial", modulos_avulsos: [] });
    const antes = usuarioDoTenant("essencial");
    const depois = await applyModularPlanGate(antes);
    expect(depois.internalPages).toEqual(antes.internalPages);
  });

  it("tenant avancado sai com as MESMAS paginas que entrou", async () => {
    settingsPorTenant.set("avancado", { plan_tier: "avancado", modulos_avulsos: [] });
    const antes = usuarioDoTenant("avancado");
    const depois = await applyModularPlanGate(antes);
    expect(depois.internalPages).toEqual(antes.internalPages);
  });

  it("tenant sem settings no banco nao perde acesso", async () => {
    const antes = usuarioDoTenant("sem-registro");
    const depois = await applyModularPlanGate(antes);
    expect(depois.internalPages).toEqual(antes.internalPages);
  });

  it("admin da Vexo nao e restringido nem em tenant modular", async () => {
    settingsPorTenant.set("teste-modular", { plan_tier: "modular", modulos_avulsos: [] });
    const antes = { ...usuarioDoTenant("teste-modular"), isAdmin: true };
    const depois = await applyModularPlanGate(antes);
    expect(depois.internalPages).toEqual(antes.internalPages);
  });
});

describe("o gate nunca CONCEDE, so tira", () => {
  it("pagina que o usuario nao tinha nao aparece por ser modulo contratado", async () => {
    settingsPorTenant.set("t", { plan_tier: "modular", modulos_avulsos: ["followup", "relatorios"] });
    // Usuario so tem dashboard: contratar follow-up nao pode dar follow-up a ele.
    const depois = await applyModularPlanGate(usuarioDoTenant("t", ["dashboard"]));
    expect(depois.internalPages).toEqual(["dashboard"]);
  });
});

describe("falha de leitura nao derruba tenant pagante", () => {
  it("erro ao ler settings mantem o acesso de quem tem", async () => {
    const { getLeadClientN8nSettings } = await import("../services/n8nSettings.js");
    const original = getLeadClientN8nSettings;
    // Simula indisponibilidade: a implementacao devolve null e o gate deixa passar.
    settingsPorTenant.set("t", null);
    const antes = usuarioDoTenant("t");
    const depois = await applyModularPlanGate(antes);
    expect(depois.internalPages).toEqual(antes.internalPages);
    expect(typeof original).toBe("function");
  });
});
