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

  it("GET /api/leads não usa mais 'leads' sozinho, e aceita banco-de-dados", () => {
    expect(leadsRoutes).not.toContain('ensureSharedRoutePageAccess(req, res, "leads")');
    expect(leadsRoutes).toContain('"banco-de-dados"');
  });

  it("GET /api/reports/evolution-usage não usa mais 'relatorios' sozinho, e aceita planilhas", () => {
    expect(insightsRoutes).not.toContain('requireInternalPageAccess("relatorios")');
    expect(insightsRoutes).toContain('"planilhas"');
  });

  it("POST /api/leads/ai-extract usa banco-de-dados, não leads", () => {
    expect(aiExtractRoutes).not.toContain('requireAppViewAccess("leads")');
    expect(aiExtractRoutes).toContain('requireAppViewAccess("banco-de-dados")');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Rota COMPARTILHADA por N telas precisa aceitar as N chaves — nao so a de
// quem reportou o defeito. GET /api/reports/evolution-usage foi consertada
// para "planilhas" (a tela que motivou o commit) e quase quebrou Dashboard.tsx
// e ChipsHealthReport.tsx, que consomem a MESMA rota sob paginas diferentes.
// GET /api/leads tinha o mesmo risco: BancoDeDados, CommercialIntelligence,
// WhatsAppInbox e SegmentacaoCatalog (via Relacionamento/LivPub) consomem a
// mesma rota sob quatro paginas diferentes.
//
// Este bloco fixa o CONJUNTO MINIMO de chaves que cada rota compartilhada
// precisa aceitar, levantado lendo cada consumidor no frontend e a pagina que
// protege a tela dele (App.tsx). Se alguem estreitar o guard de volta para uma
// chave so, um destes consumidores volta a tomar 403 — e o teste cai antes de
// chegar em producao.
describe("rotas compartilhadas aceitam TODAS as telas que as consomem", () => {
  const insightsRoutes = readFileSync(resolve("src/domains/insights/routes.js"), "utf8");
  const leadsRoutes = readFileSync(resolve("src/domains/leads/routes.js"), "utf8");

  // Extrai so o ARGUMENTO da chamada do guard — nao um trecho cru de codigo.
  // A primeira versao deste teste cortava uma janela de codigo e conferia
  // `toContain`, e o proprio COMENTARIO explicativo acima do guard (que cita
  // as quatro paginas em prosa) fazia o teste passar mesmo com o guard
  // mutado de volta para uma chave so — o comentario "continha" as palavras.
  function argumentoDoGuard(fonte, guardName, apartirDe) {
    const marcador = `${guardName}(`;
    const i = fonte.indexOf(marcador, apartirDe);
    if (i === -1) return null;
    const inicio = i + marcador.length;
    const fim = fonte.indexOf(")", inicio);
    return fonte.slice(inicio, fim);
  }

  const CASOS = [
    {
      rota: "GET /api/reports/evolution-usage",
      fonte: insightsRoutes,
      assinatura: '"/api/reports/evolution-usage"',
      guard: "requireInternalPageAccess",
      consumidores: [
        ["Dashboard.tsx", "dashboard"],
        ["Relatorios.tsx (aba de LeadImports.tsx)", "planilhas"],
        ["ChipsHealthReport.tsx (aba Saude de ChipsWhatsapp.tsx)", "conexoes"],
      ],
    },
    {
      rota: "GET /api/leads",
      fonte: leadsRoutes,
      assinatura: '"/api/leads"',
      guard: "ensureSharedRoutePageAccess",
      consumidores: [
        ["BancoDeDados.tsx", "banco-de-dados"],
        ["CommercialIntelligenceContent.tsx", "dashboard"],
        ["WhatsAppInbox.tsx (via hooks/useLeads.ts)", "whatsapp"],
        ["SegmentacaoCatalog.tsx (via Relacionamento.tsx -> LivPub)", "livpub"],
      ],
    },
  ];

  for (const caso of CASOS) {
    describe(caso.rota, () => {
      const inicioRota = caso.fonte.indexOf(caso.assinatura);
      const argumento = inicioRota === -1 ? null : argumentoDoGuard(caso.fonte, caso.guard, inicioRota);

      it("a rota ainda existe e chama o guard esperado (guarda contra teste que passa a toa)", () => {
        expect(inicioRota, `${caso.rota} sumiu do arquivo`).toBeGreaterThan(-1);
        expect(argumento, `${caso.rota} nao chama mais ${caso.guard}(...)`).not.toBeNull();
      });

      it.each(caso.consumidores)("aceita %s (chave \"%s\")", (_tela, chave) => {
        expect(argumento, `${caso.rota} nao aceita mais "${chave}"`).toContain(`"${chave}"`);
      });
    });
  }
});
