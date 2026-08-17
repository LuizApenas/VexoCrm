// Comercial Vexo recusa quem nao e administrador — no BACKEND.
//
// Evidencia de producao (2026-08-17): com o tenant "Teste modular" selecionado,
// /crm/comercial-vexo abriu e renderizou a proposta comercial da Geracao Digital
// (R$ 9.564, id 161875f3-...). A sidebar mostrava "Comercial Vexo 🔒" e a rota
// respondeu 200 — o cadeado era cosmetico.
//
// Estes testes exercitam os guards REAIS registrados nas rotas, nao uma copia.

import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it, vi } from "vitest";
import {
  requestedOwnerCompany,
  isVexoCommercialRequest,
  requireVexoCommercialAccess,
  makeVexoCommercialRowGuard,
} from "../access/vexoCommercialGate.js";

const ADMIN = { role: "internal", isAdmin: true };
const INTERNO_COMUM = { role: "internal", isAdmin: false, clientId: "teste-modular" };
const CLIENTE = { role: "client", isAdmin: false, clientId: "teste-modular" };

function makeRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) { res.statusCode = code; return res; },
    json(payload) { res.body = payload; return res; },
  };
  return res;
}

function rodar(middleware, req) {
  const res = makeRes();
  let chamouNext = false;
  const resultado = middleware({ originalUrl: "/api/gd/proposals", ...req }, res, () => { chamouNext = true; });
  return Promise.resolve(resultado).then(() => ({
    passou: chamouNext,
    status: res.statusCode,
    code: res.body?.error?.code,
  }));
}

describe("o dono pedido e lido em todas as formas que os handlers aceitam", () => {
  it("le owner_company, ownerCompany e o booleano isVexo", () => {
    expect(requestedOwnerCompany({ query: { owner_company: "vexo" } })).toBe("vexo");
    expect(requestedOwnerCompany({ query: { ownerCompany: "VEXO" } })).toBe("vexo");
    expect(requestedOwnerCompany({ body: { owner_company: "vexo" } })).toBe("vexo");
    expect(requestedOwnerCompany({ query: { isVexo: "1" } })).toBe("vexo");
    expect(requestedOwnerCompany({ query: { isVexo: "true" } })).toBe("vexo");
    expect(requestedOwnerCompany({ body: { isVexo: true } })).toBe("vexo");
  });

  it("requisicao de Geracao Digital nao e Comercial Vexo", () => {
    expect(isVexoCommercialRequest({ query: { owner_company: "geracao-digital" } })).toBe(false);
    expect(isVexoCommercialRequest({ query: {} })).toBe(false);
  });
});

describe("gate por parametro: owner_company=vexo", () => {
  it("usuario interno de tenant comum recebe 403 — este e o vazamento da evidencia", async () => {
    const r = await rodar(requireVexoCommercialAccess, {
      authAccess: INTERNO_COMUM,
      query: { owner_company: "vexo" },
    });
    expect(r.passou).toBe(false);
    expect(r.status).toBe(403);
    expect(r.code).toBe("FORBIDDEN");
  });

  it("usuario de cliente tambem recebe 403", async () => {
    const r = await rodar(requireVexoCommercialAccess, {
      authAccess: CLIENTE,
      query: { owner_company: "vexo" },
    });
    expect(r.passou).toBe(false);
    expect(r.status).toBe(403);
  });

  it("nao adianta usar o apelido isVexo para escapar", async () => {
    const r = await rodar(requireVexoCommercialAccess, {
      authAccess: INTERNO_COMUM,
      query: { isVexo: "1" },
    });
    expect(r.passou).toBe(false);
    expect(r.status).toBe(403);
  });

  it("administrador passa", async () => {
    const r = await rodar(requireVexoCommercialAccess, {
      authAccess: ADMIN,
      query: { owner_company: "vexo" },
    });
    expect(r.passou).toBe(true);
  });

  it("ADITIVO: Geracao Digital continua passando para usuario nao admin", async () => {
    const r = await rodar(requireVexoCommercialAccess, {
      authAccess: INTERNO_COMUM,
      query: { owner_company: "geracao-digital" },
    });
    expect(r.passou).toBe(true);
  });

  it("ADITIVO: requisicao sem owner_company continua passando", async () => {
    const r = await rodar(requireVexoCommercialAccess, { authAccess: INTERNO_COMUM, query: {} });
    expect(r.passou).toBe(true);
  });
});

describe("gate por linha: rota /:id nao traz o dono na requisicao", () => {
  const poolComDono = (owner) => ({
    query: vi.fn(async () => ({ rows: [{ owner_company: owner }] })),
  });

  it("proposta da Vexo pedida pelo id devolve 403 a quem nao e admin", async () => {
    const guard = makeVexoCommercialRowGuard(poolComDono("vexo"), "gd_proposals");
    const r = await rodar(guard, { authAccess: INTERNO_COMUM, params: { id: "161875f3" } });
    expect(r.passou).toBe(false);
    expect(r.status).toBe(403);
    expect(r.code).toBe("FORBIDDEN");
  });

  it("proposta da Geracao Digital continua acessivel — caminho aditivo", async () => {
    const guard = makeVexoCommercialRowGuard(poolComDono("geracao-digital"), "gd_proposals");
    const r = await rodar(guard, { authAccess: INTERNO_COMUM, params: { id: "abc" } });
    expect(r.passou).toBe(true);
  });

  it("linha sem dono (legado, NULL) continua acessivel", async () => {
    const guard = makeVexoCommercialRowGuard(poolComDono(null), "gd_contracts");
    const r = await rodar(guard, { authAccess: INTERNO_COMUM, params: { id: "abc" } });
    expect(r.passou).toBe(true);
  });

  it("administrador nao chega a consultar o banco", async () => {
    const pool = poolComDono("vexo");
    const guard = makeVexoCommercialRowGuard(pool, "gd_proposals");
    const r = await rodar(guard, { authAccess: ADMIN, params: { id: "161875f3" } });
    expect(r.passou).toBe(true);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it("registro inexistente segue para o handler, que responde 404", async () => {
    const guard = makeVexoCommercialRowGuard({ query: async () => ({ rows: [] }) }, "gd_proposals");
    const r = await rodar(guard, { authAccess: INTERNO_COMUM, params: { id: "sumiu" } });
    expect(r.passou).toBe(true);
  });

  it("falha de leitura FECHA — duvida aqui e vazamento, nao indisponibilidade", async () => {
    const guard = makeVexoCommercialRowGuard(
      { query: async () => { throw new Error("banco fora"); } },
      "gd_proposals"
    );
    const r = await rodar(guard, { authAccess: INTERNO_COMUM, params: { id: "abc" } });
    expect(r.passou).toBe(false);
    expect(r.status).toBe(403);
  });

  it("aceita getter, porque o pool so existe depois do initDatabase", async () => {
    let pool = null;
    const guard = makeVexoCommercialRowGuard(() => pool, "gd_proposals");
    pool = poolComDono("vexo");
    const r = await rodar(guard, { authAccess: INTERNO_COMUM, params: { id: "abc" } });
    expect(r.status).toBe(403);
  });

  it("tabela fora da lista fechada nem constroi o guard", () => {
    expect(() => makeVexoCommercialRowGuard({}, "leads")).toThrow(/tabela nao permitida/);
  });
});

// O guard certo com teste verde nao vale nada se a rota nao o veste — ja
// aconteceu tres vezes neste projeto (dois runCampaignDispatch,
// deriveTenantInternalPages). Este bloco le o fonte das rotas.
describe("as rotas realmente vestem o guard", () => {
  const gdRoutes = readFileSync(resolve("src/domains/geracaoDigitalRoutes.js"), "utf8");
  const contractRoutes = readFileSync(
    resolve("src/domains/geracaoDigitalContracts/contractRoutes.js"),
    "utf8"
  );

  function linhaDaRota(fonte, assinatura) {
    return fonte.split("\n").find((linha) => linha.includes(assinatura));
  }

  const porParametro = [
    [gdRoutes, 'app.get("/api/gd/proposals"'],
    [gdRoutes, 'app.post("/api/gd/proposals"'],
    [gdRoutes, 'app.get("/api/gd/implementation-briefings"'],
    [gdRoutes, 'app.post("/api/gd/implementation-briefings"'],
    [contractRoutes, 'app.get("/api/gd/contracts"'],
    [contractRoutes, 'app.post("/api/gd/contracts"'],
  ];

  it.each(porParametro)("gate por parametro na rota %#", (fonte, assinatura) => {
    const linha = linhaDaRota(fonte, assinatura);
    expect(linha, `rota ${assinatura} sumiu do fonte`).toBeTruthy();
    expect(linha, `${assinatura} sem requireVexoCommercialAccess`).toContain(
      "requireVexoCommercialAccess"
    );
  });

  const porLinha = [
    [gdRoutes, 'app.get("/api/gd/proposals/:id"', "guardPropostaVexo"],
    [gdRoutes, 'app.put("/api/gd/proposals/:id"', "guardPropostaVexo"],
    [gdRoutes, 'app.delete("/api/gd/proposals/:id"', "guardPropostaVexo"],
    [gdRoutes, 'app.get("/api/gd/implementation-briefings/:id"', "guardBriefingVexo"],
    [gdRoutes, 'app.put("/api/gd/implementation-briefings/:id"', "guardBriefingVexo"],
    [contractRoutes, 'app.get("/api/gd/contracts/:id"', "guardContratoVexo"],
    [contractRoutes, 'app.put("/api/gd/contracts/:id"', "guardContratoVexo"],
    [contractRoutes, 'app.get("/api/gd/contracts/:id/pdf"', "guardContratoVexo"],
  ];

  it.each(porLinha)("gate por linha na rota %#", (fonte, assinatura, guard) => {
    const linha = linhaDaRota(fonte, assinatura);
    expect(linha, `rota ${assinatura} sumiu do fonte`).toBeTruthy();
    expect(linha, `${assinatura} sem ${guard}`).toContain(guard);
  });
});

// Comercial Vexo nao pode voltar a ser vendido como modulo.
describe("Comercial Vexo nao e modulo vendavel", () => {
  it("nao aparece no catalogo de modulos do backend", () => {
    const registry = readFileSync(resolve("src/access/permissionsRegistry.js"), "utf8");
    expect(registry).not.toContain("comercial-vexo");
    expect(registry).not.toContain("comercial_vexo");
  });

  it("saiu da lista de modulos avulsos do frontend e do gate de features", () => {
    const planTier = readFileSync(resolve("../frontend/src/lib/planTier.ts"), "utf8");
    const catalogo = planTier.slice(
      planTier.indexOf("export const AVAILABLE_CUSTOM_MODULES"),
      planTier.indexOf("] as const;", planTier.indexOf("export const AVAILABLE_CUSTOM_MODULES"))
    );
    expect(catalogo).not.toContain("comercial-vexo");
    // hasFeatureUnlocked nao pode mais resolver "comercial-vexo" como contratavel.
    expect(planTier).not.toContain('isModuleInList(modulosAvulsos, "comercial-vexo")');
  });

  it("virou item de administrador na sidebar, junto de Master Control", () => {
    const sidebar = readFileSync(resolve("../frontend/src/lib/appSidebar/constants.ts"), "utf8");
    const admin = sidebar.slice(
      sidebar.indexOf("export const ADMIN_ITEMS"),
      sidebar.indexOf("export const COLOR_PRESETS")
    );
    expect(admin).toContain("comercial-vexo");
    const modulos = sidebar.slice(
      sidebar.indexOf("export const MODULE_ITEMS"),
      sidebar.indexOf("export const GERACAO_DIGITAL_ITEMS")
    );
    expect(modulos).not.toContain('key: "comercial-vexo"');
  });

  it("a rota do frontend exige administrador", () => {
    const app = readFileSync(resolve("../frontend/src/App.tsx"), "utf8");
    const trecho = app.slice(app.indexOf('path="comercial-vexo"'));
    const ateOElemento = trecho.slice(0, trecho.indexOf("<ComercialVexo"));
    expect(ateOElemento).toContain("requiredAdmin");
  });
});
