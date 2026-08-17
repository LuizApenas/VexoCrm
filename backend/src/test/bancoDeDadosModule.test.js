// Banco de Dados virou modulo vendavel — sem tirar de quem ja tinha.
//
// O risco desta mudanca nao e o gate falhar; e o gate funcionar demais. Tirar
// "banco-de-dados" da base universal removeria a tela de todo tenant existente
// no instante do deploy. A garantia esta em duas pontas: a migration de direito
// adquirido (20260817120000) e os testes ADITIVO daqui.

import { readFileSync } from "fs";
import { resolve } from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const settingsPorTenant = new Map();

vi.mock("../services/n8nSettings.js", () => ({
  getLeadClientN8nSettings: async (clientId) => settingsPorTenant.get(clientId) ?? null,
}));

const {
  applyModularPlanGate,
  requireContractedModulePage,
  _resetModularGateCache,
} = await import("../access/modularGate.js");
const { MODULAR_BASE_PAGES, MODULE_CATALOG, pagesForContractedModules } = await import(
  "../access/permissionsRegistry.js"
);
const { INTERNAL_PAGE_KEYS } = await import("../access/claims.js");

const TODAS = [
  "dashboard", "leads", "banco-de-dados", "whatsapp", "onboarding-wizard",
  "campanhas", "planilhas", "disparos", "fila-de-followup", "relatorios",
];

function usuario(clientId, internalPages = TODAS) {
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

function passouNoGuard(access, page) {
  const res = makeRes();
  let chamouNext = false;
  requireContractedModulePage(page)({ authAccess: access }, res, () => { chamouNext = true; });
  return { passou: chamouNext, status: res.statusCode, code: res.body?.error?.code };
}

beforeEach(() => {
  settingsPorTenant.clear();
  _resetModularGateCache();
});

describe("banco-de-dados saiu da base universal e virou modulo", () => {
  it("nao esta mais na base do plano modular", () => {
    expect(MODULAR_BASE_PAGES).not.toContain("banco-de-dados");
  });

  it("a base restante e dashboard, leads e conversas (mais o Treinamento)", () => {
    expect([...MODULAR_BASE_PAGES].sort()).toEqual(
      ["dashboard", "leads", "onboarding-wizard", "whatsapp"].sort()
    );
  });

  it("existe como modulo do catalogo, com chave canonica unica e sem apelido novo", () => {
    const modulo = MODULE_CATALOG.find((m) => m.id === "banco-de-dados");
    expect(modulo).toBeTruthy();
    expect(modulo.pages).toEqual(["banco-de-dados"]);
    expect(modulo.aliases).toEqual([]);
  });

  it("a chave existe nas DUAS listas de paginas, backend e frontend", () => {
    expect(INTERNAL_PAGE_KEYS).toContain("banco-de-dados");
    const acessoFrontend = readFileSync(resolve("../frontend/src/lib/access.ts"), "utf8");
    expect(acessoFrontend).toContain('"banco-de-dados"');
  });

  it("e INDEPENDENTE do Disparador: contratar um nao libera o outro", () => {
    expect(pagesForContractedModules(["disparador_campanhas"])).not.toContain("banco-de-dados");
    expect(pagesForContractedModules(["banco-de-dados"])).not.toContain("campanhas");
    expect(pagesForContractedModules(["banco-de-dados"])).toEqual(["banco-de-dados"]);
  });
});

describe("gate das rotas exclusivas do Banco de Dados", () => {
  it("tenant modular SEM o modulo recebe 403", async () => {
    settingsPorTenant.set("t", { plan_tier: "modular", modulos_avulsos: ["disparador_campanhas"] });
    const access = await applyModularPlanGate(usuario("t"));
    const r = passouNoGuard(access, "banco-de-dados");
    expect(r.passou).toBe(false);
    expect(r.status).toBe(403);
    expect(r.code).toBe("FORBIDDEN");
  });

  it("tenant modular COM o modulo passa", async () => {
    settingsPorTenant.set("t", { plan_tier: "modular", modulos_avulsos: ["banco-de-dados"] });
    const access = await applyModularPlanGate(usuario("t"));
    expect(passouNoGuard(access, "banco-de-dados").passou).toBe(true);
  });

  it("contratar so o Disparador nao abre o Banco, e vice-versa", async () => {
    settingsPorTenant.set("disp", { plan_tier: "modular", modulos_avulsos: ["disparador_campanhas"] });
    settingsPorTenant.set("banco", { plan_tier: "modular", modulos_avulsos: ["banco-de-dados"] });

    const soDisparador = await applyModularPlanGate(usuario("disp"));
    expect(soDisparador.internalPages).not.toContain("banco-de-dados");
    expect(soDisparador.internalPages).toContain("campanhas");

    const soBanco = await applyModularPlanGate(usuario("banco"));
    expect(soBanco.internalPages).toContain("banco-de-dados");
    expect(soBanco.internalPages).not.toContain("campanhas");
  });

  it("a tela Leads continua na base universal — nao pode cair junto", async () => {
    settingsPorTenant.set("t", { plan_tier: "modular", modulos_avulsos: [] });
    const access = await applyModularPlanGate(usuario("t"));
    expect(access.internalPages).toContain("leads");
    expect(access.internalPages).toContain("dashboard");
    expect(access.internalPages).toContain("whatsapp");
  });
});

describe("ADITIVO: ninguem que hoje enxerga o Banco pode perder a tela", () => {
  it("tenant essencial passa — modulos_avulsos nunca governou esse plano", async () => {
    settingsPorTenant.set("ess", { plan_tier: "essencial", modulos_avulsos: [] });
    const access = await applyModularPlanGate(usuario("ess"));
    expect(passouNoGuard(access, "banco-de-dados").passou).toBe(true);
  });

  it("tenant avancado passa", async () => {
    settingsPorTenant.set("av", { plan_tier: "avancado", modulos_avulsos: [] });
    const access = await applyModularPlanGate(usuario("av"));
    expect(passouNoGuard(access, "banco-de-dados").passou).toBe(true);
  });

  it("tenant sem registro de settings passa", async () => {
    const access = await applyModularPlanGate(usuario("sem-registro"));
    expect(passouNoGuard(access, "banco-de-dados").passou).toBe(true);
  });

  it("administrador passa mesmo em tenant modular sem o modulo", async () => {
    settingsPorTenant.set("t", { plan_tier: "modular", modulos_avulsos: [] });
    const access = { ...(await applyModularPlanGate(usuario("t"))), isAdmin: true };
    expect(passouNoGuard(access, "banco-de-dados").passou).toBe(true);
  });

  it("o guard nao cobra a chave da claim: claim antiga nao tem 'banco-de-dados'", async () => {
    // Usuario de tenant essencial cuja claim foi escrita antes de a chave existir.
    settingsPorTenant.set("ess", { plan_tier: "essencial", modulos_avulsos: [] });
    const access = await applyModularPlanGate(usuario("ess", ["dashboard", "leads", "whatsapp"]));
    expect(access.internalPages).not.toContain("banco-de-dados");
    // Ainda assim passa — cobrar a chave hoje derrubaria tenant pagante.
    expect(passouNoGuard(access, "banco-de-dados").passou).toBe(true);
  });
});

describe("as rotas exclusivas realmente vestem o guard", () => {
  const fonte = readFileSync(resolve("src/domains/leads/routes.js"), "utf8");

  const exclusivas = [
    'app.post("/api/leads/extract-wa-contacts"',
    'app.post("/api/leads/import-csv"',
    'app.get("/api/leads/export"',
    'app.post("/api/leads/create"',
    'app.post("/api/leads/bulk-update"',
    'app.post("/api/leads/bulk-delete"',
  ];

  it.each(exclusivas)("%s exige o modulo", (assinatura) => {
    const linha = fonte.split("\n").find((l) => l.includes(assinatura));
    expect(linha, `rota ${assinatura} sumiu do fonte`).toBeTruthy();
    expect(linha, `${assinatura} sem requireBancoDeDados`).toContain("requireBancoDeDados");
  });

  it("GET /api/leads NAO foi gateado — e compartilhada com a tela Leads", () => {
    const linha = fonte.split("\n").find((l) => l.includes('app.get("/api/leads", '));
    expect(linha).toBeTruthy();
    expect(linha).not.toContain("requireBancoDeDados");
  });
});

describe("direito adquirido esta gravado no dado, nao num default escondido", () => {
  const migration = readFileSync(
    resolve("supabase/migrations/20260817120000_grandfather_banco_de_dados_module.sql"),
    "utf8"
  );

  it("a migration grava o modulo para quem ainda nao tem", () => {
    expect(migration).toContain("UPDATE public.lead_client_n8n_settings");
    expect(migration).toContain('\'["banco-de-dados"]\'::jsonb');
  });

  it("e idempotente: nao duplica em quem ja tem", () => {
    expect(migration).toMatch(/WHERE NOT \(COALESCE\(modulos_avulsos/);
  });

  it("NAO tem sentinela em migrate.js — sentinela aqui a faria ser pulada", () => {
    const migrateJs = readFileSync(resolve("src/migrate.js"), "utf8");
    expect(migrateJs).not.toContain("20260817120000");
  });
});
