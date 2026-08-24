// Marcar o modulo tem que CONCEDER a aba do modulo.
//
// Medido em producao no tenant sonhare (Essencial): modulos_avulsos com
// "Follow-up & Cadencias" MARCADO, e allowed_tabs sem "followup:cadencias" —
// a chave que a secao 2 da tela exige. O dono marcava e desmarcava o modulo
// sem efeito nenhum, porque sao colunas diferentes.
//
// Pior: "followup:cadencias" nao existia no catalogo de abas. Nao havia como
// conceder nem na mao.
//
// Quinta ocorrencia da mesma familia esta semana (duas listas que deveriam
// concordar). Por isso o teste nao cobre so o follow-up: exige que TODA chave
// de aba lida pelo frontend exista no catalogo, para a proxima nascer travada.

import { readFileSync, readdirSync, statSync } from "fs";
import { resolve, join } from "path";
import { describe, expect, it } from "vitest";
import {
  MODULE_CATALOG,
  MODULE_TAB_KEYS,
  tabsForContractedModules,
  ensureModuleTabs,
} from "../access/permissionsRegistry.js";
import { buildN8nSettingsPayload } from "../services/n8nSettings.js";

const constantesFrontend = readFileSync(
  resolve("../frontend/src/lib/tenants/constants.ts"),
  "utf8"
);

function catalogoDeAbas() {
  const bloco = constantesFrontend.slice(
    constantesFrontend.indexOf("export const ALL_TAB_KEYS"),
    constantesFrontend.indexOf("];", constantesFrontend.indexOf("export const ALL_TAB_KEYS"))
  );
  return (bloco.match(/"([^"]+)"/g) || []).map((s) => s.replace(/"/g, ""));
}

const ABAS_DO_CATALOGO = catalogoDeAbas();

describe("o catalogo de abas foi lido", () => {
  it("guarda contra teste vazio que passa a toa", () => {
    expect(ABAS_DO_CATALOGO.length).toBeGreaterThan(20);
    expect(ABAS_DO_CATALOGO).toContain("followup:fila");
  });
});

describe("todo modulo do catalogo declara suas abas", () => {
  it("nenhum modulo fica sem entrada no mapa", () => {
    const semMapa = MODULE_CATALOG.map((m) => m.id).filter((id) => !MODULE_TAB_KEYS[id]);
    expect(semMapa, `modulos sem abas declaradas: ${semMapa.join(", ")}`).toEqual([]);
  });

  it("toda aba do mapa existe no catalogo de abas do frontend", () => {
    const inexistentes = [];
    for (const [modulo, abas] of Object.entries(MODULE_TAB_KEYS)) {
      for (const aba of abas) {
        if (!ABAS_DO_CATALOGO.includes(aba)) inexistentes.push(`${modulo} -> ${aba}`);
      }
    }
    expect(inexistentes, `aba que nao existe no catalogo:\n${inexistentes.join("\n")}`).toEqual([]);
  });

  it("o mapa nao inventa modulo que o catalogo nao tem", () => {
    const ids = new Set(MODULE_CATALOG.map((m) => m.id));
    const orfaos = Object.keys(MODULE_TAB_KEYS).filter((id) => !ids.has(id));
    expect(orfaos).toEqual([]);
  });
});

// E o que impede a proxima aba nova de repetir o caso do sonhare.
describe("toda aba lida pelo frontend existe no catalogo", () => {
  // APELIDOS LEGADOS: chaves lidas apenas como ALTERNATIVA a uma chave principal
  // que existe e e concedivel. Nao aparecem no admin de proposito — servem para
  // tenant antigo cujo allowed_tabs ainda tem o nome velho. Cada uma esta
  // amarrada a principal que a cobre, e o teste seguinte prova que a principal
  // existe: se alguem apagar a principal, o apelido para de ser aceitavel.
  const APELIDOS_LEGADOS = {
    "followup:regras": "followup:journeys",
    "inteligencia:visao-geral": "inteligencia:performance",
    "inteligencia:metricas": "inteligencia:performance",
    "inteligencia:rankings": "inteligencia:performance",
    "inteligencia:campanhas": "inteligencia:performance",
    "inteligencia:distribuicao": "inteligencia:equipe",
    "inteligencia:consultores": "inteligencia:equipe",
    "inteligencia:insights": "inteligencia:ia-config",
    "inteligencia:configuracoes": "inteligencia:ia-config",
  };
  const EXCECOES = new Set(Object.keys(APELIDOS_LEGADOS));

  function abasConsumidas() {
    const achadas = new Set();
    const dir = resolve("../frontend/src");
    const varrer = (atual) => {
      for (const nome of readdirSync(atual)) {
        const caminho = join(atual, nome);
        if (statSync(caminho).isDirectory()) {
          if (nome === "node_modules" || nome === "test") continue;
          varrer(caminho);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(nome)) continue;
        if (caminho.includes("tenants/constants.ts")) continue; // e o proprio catalogo
        const conteudo = readFileSync(caminho, "utf8");
        for (const m of conteudo.matchAll(/allowedTabs\.includes\("([^"]+)"\)/g)) achadas.add(m[1]);
        // isSectionAllowed("x") vira `prefixo:x` — o prefixo sai do proprio arquivo.
        const prefixo = conteudo.match(/allowedTabs\.includes\(`([a-z-]+):\$\{/);
        if (prefixo) {
          for (const m of conteudo.matchAll(/isSectionAllowed\("([^"]+)"\)/g)) {
            achadas.add(`${prefixo[1]}:${m[1]}`);
          }
          for (const m of conteudo.matchAll(/isSubTabAllowed\("([^"]+)"\)/g)) {
            achadas.add(`${prefixo[1]}:${m[1]}`);
          }
        }
      }
    };
    varrer(dir);
    return [...achadas];
  }

  const consumidas = abasConsumidas();

  it("a varredura encontrou chaves (guarda contra teste vazio)", () => {
    expect(consumidas.length).toBeGreaterThan(8);
    expect(consumidas).toContain("followup:cadencias");
  });

  it("todo apelido legado tem uma chave principal concedivel no catalogo", () => {
    // E o que separa "apelido legado" de "chave impossivel de conceder": sem a
    // principal no catalogo, a secao ficaria inalcancavel — o caso do sonhare.
    const orfaos = Object.entries(APELIDOS_LEGADOS)
      .filter(([, principal]) => !ABAS_DO_CATALOGO.includes(principal))
      .map(([apelido, principal]) => `${apelido} depende de ${principal}, que nao existe`);
    expect(orfaos).toEqual([]);
  });

  it("nenhuma chave lida na tela falta no catalogo", () => {
    const faltando = consumidas.filter((a) => !ABAS_DO_CATALOGO.includes(a) && !EXCECOES.has(a));
    expect(
      faltando,
      `aba lida pela tela e IMPOSSIVEL de conceder:\n${faltando.join("\n")}`
    ).toEqual([]);
  });
});

describe("contratar o modulo concede a aba", () => {
  it("followup concede a secao de cadencias — o caso do sonhare", () => {
    const abas = tabsForContractedModules(["followup"]);
    expect(abas).toContain("followup:cadencias");
    expect(abas).toContain("followup");
  });

  it("followup NAO concede automacoes por evento: e outro modulo", () => {
    expect(tabsForContractedModules(["followup"])).not.toContain("followup:journeys");
    expect(tabsForContractedModules(["followup_automations"])).toContain("followup:journeys");
  });

  it.each(MODULE_CATALOG.map((m) => [m.id]))("modulo %s recebe as abas declaradas", (id) => {
    const esperadas = MODULE_TAB_KEYS[id] || [];
    const recebidas = tabsForContractedModules([id]);
    for (const aba of esperadas) {
      expect(recebidas, `${id} deveria conceder ${aba}`).toContain(aba);
    }
  });

  it("apelido do modulo tambem concede", () => {
    // "campanhas" e apelido de disparador_campanhas no MODULE_CATALOG.
    expect(tabsForContractedModules(["campanhas"])).toContain("campanhas");
  });

  it('"all" concede tudo', () => {
    const todas = tabsForContractedModules(["all"]);
    for (const abas of Object.values(MODULE_TAB_KEYS)) {
      for (const aba of abas) expect(todas).toContain(aba);
    }
  });

  it("nada contratado nao concede nada", () => {
    expect(tabsForContractedModules([])).toEqual([]);
    expect(tabsForContractedModules(null)).toEqual([]);
  });
});

describe("ADITIVO: nunca remove aba", () => {
  it("acrescenta a que falta e preserva as que ja existiam", () => {
    const atuais = ["dashboard", "leads", "followup", "followup:fila", "aba-legada-qualquer"];
    const resultado = ensureModuleTabs(atuais, ["followup"]);
    for (const aba of atuais) expect(resultado).toContain(aba);
    expect(resultado).toContain("followup:cadencias");
  });

  it("desmarcar modulo NAO tira aba", () => {
    const comTudo = ["followup", "followup:cadencias", "followup:journeys"];
    expect(ensureModuleTabs(comTudo, [])).toEqual(comTudo);
  });

  it("allowed_tabs null continua null — null e 'sem restricao'", () => {
    expect(ensureModuleTabs(null, ["followup"])).toBe(null);
    expect(ensureModuleTabs(undefined, ["followup"])).toBe(undefined);
  });

  it("nao duplica aba que ja esta la", () => {
    const r = ensureModuleTabs(["followup:cadencias"], ["followup"]);
    expect(r.filter((a) => a === "followup:cadencias")).toHaveLength(1);
  });
});

describe("salvar os modulos repara as abas — o caminho que roda", () => {
  it("o payload gravado ganha followup:cadencias, reproduzindo o sonhare", () => {
    const existing = {
      plan_tier: "essencial",
      modulos_avulsos: [],
      allowed_tabs: [
        "followup", "followup:fila", "followup:sugestoes",
        "followup:campanhas", "followup:metrics", "followup:config",
      ],
    };

    const payload = buildN8nSettingsPayload({ modulosAvulsos: ["followup"] }, {}, existing);

    expect(payload.modulos_avulsos).toEqual(["followup"]);
    expect(payload.allowed_tabs).toContain("followup:cadencias");
    // Nenhuma das que ja existiam some.
    for (const aba of existing.allowed_tabs) expect(payload.allowed_tabs).toContain(aba);
  });

  it("tenant sem restricao de abas continua sem restricao", () => {
    const payload = buildN8nSettingsPayload(
      { modulosAvulsos: ["followup"] },
      {},
      { plan_tier: "essencial", modulos_avulsos: [], allowed_tabs: null }
    );
    expect(payload.allowed_tabs).toBe(null);
  });

  it("salvar outra coisa nao mexe nas abas de quem nao tem modulo", () => {
    const existing = { plan_tier: "essencial", modulos_avulsos: [], allowed_tabs: ["dashboard"] };
    const payload = buildN8nSettingsPayload({ agentName: "Lara" }, {}, existing);
    expect(payload.allowed_tabs).toEqual(["dashboard"]);
  });
});
