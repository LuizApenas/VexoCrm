// Limite de chips: numero, nao booleano — e recusado pelo backend.
//
// Evidencia (2026-08-17): tenant "Sonhare", badge "🟢 Plano Essencial", abriu
// /crm/chips-whatsapp e viu "🔒 Modulo Nao Contratado no Plano Modular". No mesmo
// print o menu mostrava "Chips WhatsApp" SEM cadeado.
//
// Causa: a tela perguntava hasFeatureUnlocked(client, "multiplos_chips"), que e
// ADVANCED_ONLY_FEATURES, logo false em todo tenant Essencial. O menu perguntava
// pela chave da PAGINA ("chips-whatsapp"), que devolve true. Mesma regra, duas
// implementacoes, respostas opostas — e bloqueava o Essencial de conectar os dois
// chips que ele ja pagou.

import { readFileSync } from "fs";
import { resolve } from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const settingsPorTenant = new Map();

vi.mock("../services/n8nSettings.js", () => ({
  getLeadClientN8nSettings: async (clientId) => settingsPorTenant.get(clientId) ?? null,
}));
vi.mock("../services/database.js", () => ({ supabase: null }));

const {
  chipLimitFor,
  canUseChipsPage,
  chipLimitExceeded,
  normalizeChipLimits,
  CHIP_LIMIT_DEFAULTS,
} = await import("../access/chipLimit.js");
const { makeChipLimitGuard, _resetChipLimitCache } = await import("../access/chipLimitGate.js");

const ESSENCIAL = { plan_tier: "essencial", modulos_avulsos: [] };
const ESSENCIAL_COM_MODULO = { plan_tier: "essencial", modulos_avulsos: ["multiplos_chips"] };
const AVANCADO = { plan_tier: "avancado", modulos_avulsos: [] };
const MODULAR_COM_DISPARADOR = { plan_tier: "modular", modulos_avulsos: ["disparador_campanhas"] };
const MODULAR_COM_AGENTE = { plan_tier: "modular", modulos_avulsos: ["agente_inbound"] };
const MODULAR_PELADO = { plan_tier: "modular", modulos_avulsos: ["relatorios"] };

describe("a matriz de limites definida pelo dono", () => {
  it("Essencial: 2 chips", () => {
    expect(chipLimitFor(ESSENCIAL)).toBe(2);
  });

  it("Essencial + multiplos_chips: ilimitado", () => {
    expect(chipLimitFor(ESSENCIAL_COM_MODULO)).toBe(null);
  });

  it("Avancado: ilimitado", () => {
    expect(chipLimitFor(AVANCADO)).toBe(null);
  });

  it("Modular com disparador OU agente: 2 chips", () => {
    expect(chipLimitFor(MODULAR_COM_DISPARADOR)).toBe(2);
    expect(chipLimitFor(MODULAR_COM_AGENTE)).toBe(2);
  });

  it("Modular sem nenhum dos dois: 0", () => {
    expect(chipLimitFor(MODULAR_PELADO)).toBe(0);
  });

  it("so o 0 fecha a tela inteira", () => {
    expect(canUseChipsPage(ESSENCIAL)).toBe(true);
    expect(canUseChipsPage(AVANCADO)).toBe(true);
    expect(canUseChipsPage(MODULAR_COM_DISPARADOR)).toBe(true);
    expect(canUseChipsPage(ESSENCIAL_COM_MODULO)).toBe(true);
    expect(canUseChipsPage(MODULAR_PELADO)).toBe(false);
  });
});

describe("o numero vem de configuracao, nao do codigo", () => {
  it("limite por plano configurado sobrescreve o default", () => {
    expect(chipLimitFor(ESSENCIAL, { essencial: 5 })).toBe(5);
    expect(chipLimitFor(MODULAR_COM_DISPARADOR, { modular_com_ferramenta: 1 })).toBe(1);
  });

  it("config pode abrir o modular pelado, se o dono quiser", () => {
    expect(chipLimitFor(MODULAR_PELADO, { modular_sem_ferramenta: 1 })).toBe(1);
    expect(canUseChipsPage(MODULAR_PELADO, { modular_sem_ferramenta: 1 })).toBe(true);
  });

  it("override do tenant ganha do plano", () => {
    expect(chipLimitFor({ ...ESSENCIAL, chip_limit: 7 })).toBe(7);
    // Inclusive para cortar: cliente combinado a parte com 1 chip so.
    expect(chipLimitFor({ ...AVANCADO, chip_limit: 1 })).toBe(1);
  });

  it("config invalida cai no default em vez de virar bloqueio", () => {
    expect(normalizeChipLimits(null)).toEqual(CHIP_LIMIT_DEFAULTS);
    expect(normalizeChipLimits({ essencial: "abacaxi" }).essencial).toBe(CHIP_LIMIT_DEFAULTS.essencial);
    expect(normalizeChipLimits({ essencial: -3 }).essencial).toBe(CHIP_LIMIT_DEFAULTS.essencial);
    expect(chipLimitFor({ ...ESSENCIAL, chip_limit: "abacaxi" })).toBe(2);
  });

  it("null configurado de proposito significa ilimitado", () => {
    expect(normalizeChipLimits({ essencial: null }).essencial).toBe(null);
    expect(chipLimitFor(ESSENCIAL, { essencial: null })).toBe(null);
  });
});

describe("cabe mais um?", () => {
  it("compara quantidade com limite, e ilimitado nunca estoura", () => {
    expect(chipLimitExceeded(1, 2)).toBe(false);
    expect(chipLimitExceeded(2, 2)).toBe(true);
    expect(chipLimitExceeded(3, 2)).toBe(true);
    expect(chipLimitExceeded(999, null)).toBe(false);
    expect(chipLimitExceeded(0, 0)).toBe(true);
  });
});

describe("o BACKEND recusa a criacao acima do limite", () => {
  function makeRes() {
    const res = {
      statusCode: null,
      body: null,
      status(code) { res.statusCode = code; return res; },
      json(payload) { res.body = payload; return res; },
    };
    return res;
  }

  async function tentarCriar({ tenantId, access, quantidadeAtual }) {
    const guard = makeChipLimitGuard(() => new Array(quantidadeAtual).fill({}));
    const res = makeRes();
    let chamouNext = false;
    await guard({ params: { tenantId }, authAccess: access }, res, () => { chamouNext = true; });
    return {
      criou: chamouNext,
      status: res.statusCode,
      code: res.body?.error?.code,
      message: res.body?.error?.message,
    };
  }

  const INTERNO = { role: "internal", isAdmin: false, clientId: "t" };

  beforeEach(() => {
    settingsPorTenant.clear();
    _resetChipLimitCache();
  });

  it("essencial com 2 chips recebe recusa DO BACKEND ao criar o 3o", async () => {
    settingsPorTenant.set("sonhare", ESSENCIAL);
    const r = await tentarCriar({ tenantId: "sonhare", access: INTERNO, quantidadeAtual: 2 });
    expect(r.criou).toBe(false);
    expect(r.status).toBe(403);
    expect(r.code).toBe("CHIP_LIMIT_REACHED");
    // A mensagem carrega os numeros reais: o frontend repassa, nao inventa.
    expect(r.message).toContain("2 de 2");
  });

  it("essencial com 1 chip cria o 2o", async () => {
    settingsPorTenant.set("sonhare", ESSENCIAL);
    const r = await tentarCriar({ tenantId: "sonhare", access: INTERNO, quantidadeAtual: 1 });
    expect(r.criou).toBe(true);
  });

  it("essencial + multiplos_chips cria o 3o com sucesso", async () => {
    settingsPorTenant.set("sonhare", ESSENCIAL_COM_MODULO);
    const r = await tentarCriar({ tenantId: "sonhare", access: INTERNO, quantidadeAtual: 2 });
    expect(r.criou).toBe(true);
  });

  it("avancado nao tem limite", async () => {
    settingsPorTenant.set("t", AVANCADO);
    const r = await tentarCriar({ tenantId: "t", access: INTERNO, quantidadeAtual: 42 });
    expect(r.criou).toBe(true);
  });

  it("modular sem disparador e sem agente nao cria nem o primeiro", async () => {
    settingsPorTenant.set("t", MODULAR_PELADO);
    const r = await tentarCriar({ tenantId: "t", access: INTERNO, quantidadeAtual: 0 });
    expect(r.criou).toBe(false);
    expect(r.status).toBe(403);
    expect(r.message).toMatch(/Disparador|Agente/);
  });

  it("modular com disparador cria ate 2", async () => {
    settingsPorTenant.set("t", MODULAR_COM_DISPARADOR);
    expect((await tentarCriar({ tenantId: "t", access: INTERNO, quantidadeAtual: 1 })).criou).toBe(true);
    expect((await tentarCriar({ tenantId: "t", access: INTERNO, quantidadeAtual: 2 })).criou).toBe(false);
  });

  it("override do tenant vale no backend", async () => {
    settingsPorTenant.set("t", { ...ESSENCIAL, chip_limit: 4 });
    expect((await tentarCriar({ tenantId: "t", access: INTERNO, quantidadeAtual: 3 })).criou).toBe(true);
    expect((await tentarCriar({ tenantId: "t", access: INTERNO, quantidadeAtual: 4 })).criou).toBe(false);
  });

  it("admin da Vexo provisiona para o cliente sem passar pelo limite", async () => {
    settingsPorTenant.set("t", MODULAR_PELADO);
    const r = await tentarCriar({
      tenantId: "t",
      access: { role: "internal", isAdmin: true },
      quantidadeAtual: 9,
    });
    expect(r.criou).toBe(true);
  });

  it("falha ao apurar o limite LIBERA — sem chip nada funciona", async () => {
    const guard = makeChipLimitGuard(() => { throw new Error("banco fora"); });
    const res = makeRes();
    let chamouNext = false;
    settingsPorTenant.set("t", ESSENCIAL);
    await guard({ params: { tenantId: "t" }, authAccess: INTERNO }, res, () => { chamouNext = true; });
    expect(chamouNext).toBe(true);
  });
});

// Guard certo com teste verde nao vale nada se a rota nao o veste.
describe("as rotas que criam chip realmente vestem o guard", () => {
  const fonte = readFileSync(resolve("src/domains/integrations/routes.js"), "utf8");

  function blocoDaRota(assinatura) {
    const i = fonte.indexOf(assinatura);
    return i === -1 ? null : fonte.slice(i, i + 400);
  }

  it.each([
    '"/api/lead-clients/:tenantId/evolution-instances",',
    '"/api/lead-clients/:tenantId/evolution-instances/provision",',
  ])("%s exige quota", (assinatura) => {
    const bloco = blocoDaRota(`app.post(\n    ${assinatura}`);
    expect(bloco, `rota POST ${assinatura} sumiu do fonte`).toBeTruthy();
    expect(bloco.slice(0, bloco.indexOf("async (req")), `${assinatura} sem requireChipQuota`).toContain(
      "requireChipQuota"
    );
  });
});

describe("a tela e o menu chamam a MESMA funcao", () => {
  const chips = readFileSync(resolve("../frontend/src/pages/ChipsWhatsapp.tsx"), "utf8");
  const sidebar = readFileSync(resolve("../frontend/src/components/AppSidebar.tsx"), "utf8");
  const moduleAccess = readFileSync(resolve("../frontend/src/lib/moduleAccess.ts"), "utf8");

  it("a tela nao pergunta mais pelo modulo pago", () => {
    expect(chips).not.toContain('hasFeatureUnlocked(crmClient?.selectedClient, "multiplos_chips")');
    expect(chips).toContain("canUseChipsPage");
  });

  it("a tela nao diz mais 'Plano Modular' para tenant essencial", () => {
    expect(chips).not.toContain("Módulo Não Contratado no Plano Modular");
  });

  it("o menu delega para moduleAccess em vez de reimplementar a regra", () => {
    expect(sidebar).toContain("isModuleLocked");
    // A lista propria de paginas universais saiu do AppSidebar.
    expect(sidebar).not.toContain('item.key === "dashboard"');
    expect(sidebar).not.toContain('planTier !== "modular"');
  });

  it("moduleAccess trata chip por limite, nao por booleano de modulo", () => {
    expect(moduleAccess).toContain("canUseChipsPage");
  });
});

describe("paridade entre o limite do backend e o do frontend", () => {
  const ts = readFileSync(resolve("../frontend/src/lib/chipLimit.ts"), "utf8");

  it("os defaults sao os mesmos nos dois lados", () => {
    for (const [chave, valor] of Object.entries(CHIP_LIMIT_DEFAULTS)) {
      expect(ts, `${chave} divergiu entre backend e frontend`).toContain(`${chave}: ${valor}`);
    }
  });

  it("a matriz do frontend cobre as mesmas condicoes", () => {
    for (const trecho of ["multiplos_chips", "disparador_campanhas", "agente_inbound", "avancado"]) {
      expect(ts).toContain(trecho);
    }
  });
});
