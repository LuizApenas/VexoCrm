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
  getLeadClientN8nSettings: async (clientId) => {
    const val = settingsPorTenant.get(clientId);
    if (val === "__THROW__") {
      throw new Error("DB_CONNECTION_TIMEOUT: database connection failed");
    }
    return val ?? null;
  },
}));

const { applyModularPlanGate, _resetModularGateCache } = await import("../access/modularGate.js");
const { requireInternalPageAccess } = await import("../access/middlewares.js");
const TENANT = "teste-modular";
const TODAS = [
  "dashboard", "banco-de-dados", "whatsapp", "onboarding-wizard",
  "campanhas", "planilhas", "disparos",
  "followup", "fila-de-followup", "followup-sugestoes",
  "agente", "conexoes", "inteligencia-comercial",
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
  const headers = {};
  const res = {
    statusCode: null,
    body: null,
    status(c) {
      this.statusCode = c;
      return this;
    },
    json(b) {
      this.body = b;
      return this;
    },
    setHeader(k, v) {
      headers[k.toLowerCase()] = v;
    },
    getHeader(k) {
      return headers[k.toLowerCase()];
    },
  };
  return res;
}

function passouNoGuard(access, pagina) {
  const res = makeRes();
  let chamouNext = false;
  requireInternalPageAccess(pagina)({ authAccess: access }, res, () => { chamouNext = true; });
  return { passou: chamouNext, status: res.statusCode, code: res.body?.error?.code };
}

describe("gating em tenant modular", () => {
  beforeEach(() => {
    _resetModularGateCache();
    settingsPorTenant.clear();
    // Tenant modular que SO contratou disparador de campanhas
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
    for (const base of ["dashboard", "whatsapp"]) {
      expect(passouNoGuard(access, base).passou, `${base} deveria continuar liberada`).toBe(true);
    }
    // banco-de-dados saiu da base universal e virou modulo vendavel: este tenant
    // so contratou disparador_campanhas, entao nao tem.
    expect(passouNoGuard(access, "banco-de-dados").passou).toBe(false);
  });

  it("barra tambem agente, conexoes e relatorios/inteligencia nao contratados", async () => {
    const access = await applyModularPlanGate(usuarioDoTenant(TENANT));
    for (const bloqueada of ["agente", "conexoes", "inteligencia-comercial"]) {
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

describe("resiliencia a oscilacao de banco: uso da ultima leitura boa em cache", () => {
  it("tenant essencial com leitura boa em cache + avanco do relogio alem do TTL (5 min) + erro de banco continua acessando via lastGood", async () => {
    vi.useFakeTimers();
    try {
      const TENANT = "tenant-essencial-alem-do-ttl";
      // 1. Leitura bem-sucedida inicial
      settingsPorTenant.set(TENANT, { plan_tier: "essencial", modulos_avulsos: [] });
      const antes = usuarioDoTenant(TENANT);
      const primeiro = await applyModularPlanGate(antes);
      expect(primeiro.internalPages).toEqual(TODAS);
      expect(passouNoGuard(primeiro, "campanhas").passou).toBe(true);

      // 2. Avanca o relogio 5 minutos (bem alem do TTL de revalidacao de 1 minuto)
      vi.advanceTimersByTime(5 * 60 * 1000);

      // 3. Banco oscila e lanca erro
      settingsPorTenant.set(TENANT, "__THROW__");

      // 4. O gate tenta revalidar, captura o erro e recorre ao lastGoodCache (horizonte de 24h)
      const segundo = await applyModularPlanGate(antes);
      expect(segundo.internalPages).toEqual(TODAS);
      expect(segundo.error).toBeUndefined();
      expect(passouNoGuard(segundo, "campanhas").passou).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("se a ultima leitura boa tiver mais de 24 horas (horizonte maximo expirado), o gate nega por seguranca", async () => {
    vi.useFakeTimers();
    try {
      const TENANT = "tenant-expirado-25h";
      settingsPorTenant.set(TENANT, { plan_tier: "essencial", modulos_avulsos: [] });
      const antes = usuarioDoTenant(TENANT);
      await applyModularPlanGate(antes);

      // Avanca 25 horas
      vi.advanceTimersByTime(25 * 60 * 60 * 1000);
      settingsPorTenant.set(TENANT, "__THROW__");

      const depois = await applyModularPlanGate(antes);
      expect(depois.internalPages).toEqual([]);
      expect(depois.error).toBe("TENANT_SETTINGS_READ_FAILED");
      expect(passouNoGuard(depois, "campanhas").passou).toBe(false);
      expect(passouNoGuard(depois, "campanhas").status).toBe(503);
    } finally {
      vi.useRealTimers();
    }
  });

  it("tenant sem leitura prévia + erro no banco é negado com 503 e mensagem amigável", async () => {
    settingsPorTenant.set("tenant-novo-com-erro", "__THROW__");
    const antes = usuarioDoTenant("tenant-novo-com-erro");
    const depois = await applyModularPlanGate(antes);

    expect(depois.internalPages).toEqual([]);
    expect(depois.error).toBe("TENANT_SETTINGS_READ_FAILED");

    const r = passouNoGuard(depois, "campanhas");
    expect(r.passou).toBe(false);
    expect(r.status).toBe(503);
    expect(r.code).toBe("SERVICE_UNAVAILABLE");
  });

  it("admin/superadmin continuam passando mesmo com erro de settings", async () => {
    settingsPorTenant.set("tenant-com-erro", "__THROW__");
    const admin = { ...usuarioDoTenant("tenant-com-erro"), isAdmin: true };
    const depois = await applyModularPlanGate(admin);
    expect(depois.internalPages).toEqual(admin.internalPages);
  });
});
