// Rota gateada por chave inexistente em INTERNAL_PAGE_KEYS barra TODO MUNDO,
// inclusive quem tem a permissao concedida na claim — e ate o dono.
//
// Achado real, 2026-09-03T02:38:05Z, conta de producao mrkgeracaodigital@gmail.com
// (o proprio dono), claim com "leads" e "relatorios" concedidos explicitamente:
//   GET /api/leads?clientId=geracao-digital                    -> 403 FORBIDDEN
//   GET /api/reports/evolution-usage?clientId=geracao-digital  -> 403 FORBIDDEN
//
// Causa: fc4f49e removeu "leads" e "relatorios" de INTERNAL_PAGE_KEYS (o modulo
// Leads foi extinto de proposito), mas duas rotas continuaram gateadas por essas
// chaves. normalizeInternalPages filtra a claim contra INTERNAL_PAGE_KEYS
// (claims.js) — chave que sumiu da lista mestra e removida da claim de QUALQUER
// usuario, mesmo de quem a tinha concedida. So passa quem cai no bypass de
// isAdmin em hasInternalPageAccess; um internal comum nunca passa mais.
//
// Isto ja aconteceu quando o modulo foi removido. A garantia e esta varredura:
// toda chave literal usada nos guards de pagina/view tem que existir em
// INTERNAL_PAGE_KEYS (ou, para requireAppViewAccess, em CLIENT_VIEW_KEYS —
// guard que aceita internos OU clientes).

import { readFileSync, readdirSync, statSync } from "fs";
import { resolve, join } from "path";
import { describe, expect, it } from "vitest";
import { INTERNAL_PAGE_KEYS, CLIENT_VIEW_KEYS } from "../access/claims.js";

const GUARDS = [
  "ensureSharedRoutePageAccess",
  "requireInternalPageAccess",
  "requireAnyInternalPageAccess",
  "requireAppViewAccess",
  "requireContractedModulePage",
];

function listarArquivosJs(dir, achados = []) {
  for (const nome of readdirSync(dir)) {
    if (nome === "node_modules" || nome === "test") continue;
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      listarArquivosJs(caminho, achados);
    } else if (nome.endsWith(".js")) {
      achados.push(caminho);
    }
  }
  return achados;
}

/**
 * Extrai chamadas `guard(...)` do fonte, pegando so a PRIMEIRA chamada — que e
 * onde a chave vive. Cobre string simples ("x") e array (["x","y"]).
 */
function extrairChamadas(fonte, nomeGuard) {
  const resultado = [];
  const marcador = `${nomeGuard}(`;
  let i = 0;
  while ((i = fonte.indexOf(marcador, i)) !== -1) {
    // Pula declaracao da propria funcao (export function requireX(...)).
    const antes = fonte.slice(Math.max(0, i - 20), i);
    if (/function\s*$/.test(antes)) { i += marcador.length; continue; }

    const inicio = i + marcador.length;
    const fim = fonte.indexOf(")", inicio);
    const argumento = fonte.slice(inicio, fim);
    const chaves = (argumento.match(/"([^"]+)"/g) || []).map((s) => s.replace(/"/g, ""));
    if (chaves.length > 0) {
      const linha = fonte.slice(0, i).split("\n").length;
      resultado.push({ linha, chaves, trecho: argumento });
    }
    i = fim + 1;
  }
  return resultado;
}

describe("toda chave usada nos guards de pagina/view existe", () => {
  const arquivos = listarArquivosJs(resolve("src"));

  it("a varredura encontrou arquivos (guarda contra teste vazio)", () => {
    expect(arquivos.length).toBeGreaterThan(20);
  });

  const problemas = [];
  for (const caminho of arquivos) {
    const fonte = readFileSync(caminho, "utf8");
    for (const guard of GUARDS) {
      if (!fonte.includes(`${guard}(`)) continue;
      for (const chamada of extrairChamadas(fonte, guard)) {
        for (const chave of chamada.chaves) {
          const validaComoInterna = INTERNAL_PAGE_KEYS.includes(chave);
          const validaComoView = guard === "requireAppViewAccess" && CLIENT_VIEW_KEYS.includes(chave);
          if (!validaComoInterna && !validaComoView) {
            problemas.push(
              `${caminho.replace(resolve(".."), "")}:${chamada.linha} — ${guard}(...) usa "${chave}", que NÃO existe em INTERNAL_PAGE_KEYS`
            );
          }
        }
      }
    }
  }

  it("nenhuma chamada usa chave fora de INTERNAL_PAGE_KEYS", () => {
    expect(problemas, `\n${problemas.join("\n")}`).toEqual([]);
  });
});

describe("os dois casos reais ficam fechados", () => {
  const leadsRoutes = readFileSync(resolve("src/domains/leads/routes.js"), "utf8");
  const insightsRoutes = readFileSync(resolve("src/domains/insights/routes.js"), "utf8");
  const aiExtractRoutes = readFileSync(resolve("src/domains/leads/aiExtractRoutes.js"), "utf8");

  it("GET /api/leads usa banco-de-dados, não leads", () => {
    expect(leadsRoutes).not.toContain('ensureSharedRoutePageAccess(req, res, "leads")');
    expect(leadsRoutes).toContain('ensureSharedRoutePageAccess(req, res, "banco-de-dados")');
  });

  it("GET /api/reports/evolution-usage usa planilhas, não relatorios", () => {
    expect(insightsRoutes).not.toContain('requireInternalPageAccess("relatorios")');
    expect(insightsRoutes).toContain('requireInternalPageAccess("planilhas")');
  });

  it("POST /api/leads/ai-extract usa banco-de-dados, não leads", () => {
    expect(aiExtractRoutes).not.toContain('requireAppViewAccess("leads")');
    expect(aiExtractRoutes).toContain('requireAppViewAccess("banco-de-dados")');
  });
});
