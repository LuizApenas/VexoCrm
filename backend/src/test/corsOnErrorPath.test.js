// Resposta de ERRO precisa chegar legivel no navegador.
//
// Sintoma: POST /api/whatsapp/chats/{id}/summarize devolvia 502 e o console
// mostrava "No 'Access-Control-Allow-Origin' header is present" + ERR_FAILED.
// A tela dizia so "Failed to fetch", e o `reason` que o backend manda nunca
// chegava.
//
// ACHADO: nao e verdade que todo caminho de erro perde CORS. app.use(cors())
// esta em server.js:427, ANTES de registerAllDomainRoutes (server.js:753),
// entao a resposta 502 da aplicacao ja sai com os cabecalhos. A causa real
// estava no cliente — ver corsRetryEscalation no teste do frontend.
//
// O que se garante aqui: a politica de CORS e UMA so, e vale tambem para
// sendError, sem refletir origem desconhecida.

import { describe, expect, it, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { configureCorsPolicy, isAllowedCorsOrigin, applyCorsHeaders } from "../services/corsPolicy.js";
import { sendError } from "../services/httpInfra.js";

const PERMITIDA = "https://app.vexo.com.br";
const DESCONHECIDA = "https://site-do-atacante.example";

function makeRes(origin) {
  const headers = {};
  const res = {
    headersSent: false,
    statusCode: null,
    body: null,
    req: { headers: origin ? { origin } : {} },
    setHeader(k, v) { headers[k] = v; },
    getHeader(k) { return headers[k]; },
    status(code) { res.statusCode = code; return res; },
    json(payload) { res.body = payload; return res; },
    _headers: headers,
  };
  return res;
}

beforeEach(() => {
  configureCorsPolicy({ allowAny: false, origens: [PERMITIDA] });
});

describe("a politica de origem e uma so", () => {
  it("aceita a origem configurada, com ou sem barra final", () => {
    expect(isAllowedCorsOrigin(PERMITIDA)).toBe(true);
    expect(isAllowedCorsOrigin(`${PERMITIDA}/`)).toBe(true);
  });

  it("recusa origem desconhecida", () => {
    expect(isAllowedCorsOrigin(DESCONHECIDA)).toBe(false);
    expect(isAllowedCorsOrigin(null)).toBe(false);
  });

  it("aceita a extensao do Vexo Scout, como o middleware sempre aceitou", () => {
    expect(isAllowedCorsOrigin("chrome-extension://abcdef")).toBe(true);
    expect(isAllowedCorsOrigin("https://www.instagram.com")).toBe(true);
  });
});

describe("resposta de erro chega ao navegador", () => {
  it("sendError devolve 502 COM cabecalho de CORS para origem permitida", () => {
    const res = makeRes(PERMITIDA);
    sendError(res, 502, "SUMMARY_FAILED", "Não foi possível gerar o resumo", "groq timeout");

    expect(res.statusCode).toBe(502);
    expect(res._headers["Access-Control-Allow-Origin"]).toBe(PERMITIDA);
    expect(res._headers["Access-Control-Allow-Credentials"]).toBe("true");
    expect(res._headers["Vary"]).toBe("Origin");
    // E o motivo viaja no corpo, para a tela poder exibir.
    expect(res.body.error.code).toBe("SUMMARY_FAILED");
    expect(res.body.error.details).toBe("groq timeout");
  });

  it("qualquer status de erro carrega os mesmos cabecalhos da resposta de sucesso", () => {
    for (const status of [400, 401, 403, 404, 500, 502, 503]) {
      const res = makeRes(PERMITIDA);
      sendError(res, status, "X", "erro");
      expect(res._headers["Access-Control-Allow-Origin"], `status ${status} sem CORS`).toBe(PERMITIDA);
    }
  });
});

describe("nao vira CORS aberto", () => {
  it("origem desconhecida NAO recebe cabecalho — refletir seria vazar corpo de erro", () => {
    const res = makeRes(DESCONHECIDA);
    sendError(res, 500, "INTERNAL_ERROR", "falhou", "detalhe interno");
    expect(res._headers["Access-Control-Allow-Origin"]).toBeUndefined();
  });

  it("nao sobrescreve o que o middleware cors() ja escreveu", () => {
    const res = makeRes(PERMITIDA);
    res.setHeader("Access-Control-Allow-Origin", "https://outra.origem");
    applyCorsHeaders(res, PERMITIDA);
    expect(res._headers["Access-Control-Allow-Origin"]).toBe("https://outra.origem");
  });

  it("nao explode se a resposta ja foi enviada", () => {
    const res = makeRes(PERMITIDA);
    res.headersSent = true;
    expect(() => sendError(res, 500, "X", "erro")).not.toThrow();
  });
});

describe("estrutura: o middleware roda antes das rotas e nao derruba a requisicao", () => {
  const server = readFileSync(resolve("src/server.js"), "utf8");

  it("app.use(cors(...)) vem ANTES de registerAllDomainRoutes", () => {
    const posCors = server.indexOf("app.use(\n  cors(");
    const posRotas = server.indexOf("registerAllDomainRoutes(app)");
    expect(posCors).toBeGreaterThan(-1);
    expect(posRotas).toBeGreaterThan(posCors);
  });

  it("origem bloqueada nao lanca Error — throw ali vira 500 opaco sem CORS", () => {
    expect(server).not.toContain("callback(new Error(`Origin not allowed");
    expect(server).toContain("callback(null, false)");
  });

  it("server.js alimenta a politica compartilhada no boot", () => {
    expect(server).toContain("configureCorsPolicy({");
  });
});
