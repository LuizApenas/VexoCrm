// Paridade entre o catalogo de modulos do backend e o do frontend.
//
// O catalogo autoritativo e MODULE_CATALOG em access/permissionsRegistry.js — e
// dele que deriveTenantInternalPages tira as paginas de um tenant modular, ou seja,
// e ele que decide o que a claim concede. O frontend tem AVAILABLE_CUSTOM_MODULES
// em lib/planTier.ts, que alimenta os dois dialogs de tenant.
//
// Enquanto os dois existirem, podem divergir — e divergencia aqui e silenciosa e
// cara: a tela oferece um modulo que a claim nao concede (usuario contrata e nao
// recebe), ou concede um que a tela nao oferece. Este teste falha no dia em que
// alguem mexer num sem mexer no outro.

import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";
import { MODULE_CATALOG, MODULAR_BASE_PAGES, pagesForContractedModules } from "../access/permissionsRegistry.js";

// Le o catalogo do frontend do fonte: o backend nao importa TS.
function catalogoDoFrontend() {
  const src = readFileSync(
    resolve("../frontend/src/lib/planTier.ts"),
    "utf8"
  );
  const bloco = src.slice(
    src.indexOf("export const AVAILABLE_CUSTOM_MODULES"),
    src.indexOf("] as const;", src.indexOf("export const AVAILABLE_CUSTOM_MODULES"))
  );

  const modulos = [];
  for (const linha of bloco.split("\n")) {
    const id = linha.match(/\bid:\s*"([^"]+)"/);
    if (!id) continue;
    const pagesRaw = linha.match(/\bpages:\s*\[([^\]]*)\]/);
    const pages = pagesRaw
      ? pagesRaw[1].split(",").map((p) => p.trim().replace(/^"|"$/g, "")).filter(Boolean)
      : [];
    modulos.push({ id: id[1], pages });
  }
  return modulos;
}

const frontend = catalogoDoFrontend();

describe("os dois catalogos descrevem os mesmos modulos", () => {
  it("o frontend foi lido (guarda contra teste vazio que passa a toa)", () => {
    expect(frontend.length).toBeGreaterThan(5);
  });

  it("mesmos ids, na mesma quantidade", () => {
    const noBackend = MODULE_CATALOG.map((m) => m.id).sort();
    const noFrontend = frontend.map((m) => m.id).sort();
    expect(noFrontend).toEqual(noBackend);
  });

  it("cada modulo libera as MESMAS paginas nos dois lados", () => {
    for (const doFrontend of frontend) {
      const doBackend = MODULE_CATALOG.find((m) => m.id === doFrontend.id);
      expect(doBackend, `${doFrontend.id} nao existe no backend`).toBeTruthy();
      expect(
        [...doFrontend.pages].sort(),
        `paginas de ${doFrontend.id} divergem entre backend e frontend`
      ).toEqual([...doBackend.pages].sort());
    }
  });
});

describe("resolucao por id e por apelido", () => {
  it("casa pelo id do modulo", () => {
    expect(pagesForContractedModules(["disparador_campanhas"])).toContain("campanhas");
  });

  it("casa pelos apelidos que a cascata antiga ja aceitava", () => {
    // Nenhum apelido novo: sao os mesmos que estavam espalhados nos ifs.
    expect(pagesForContractedModules(["campanhas"])).toContain("planilhas");
    expect(pagesForContractedModules(["agente-ia"])).toContain("agente");
    expect(pagesForContractedModules(["chips-whatsapp"])).toContain("conexoes");
    expect(pagesForContractedModules(["relatorio"])).toContain("relatorios");
  });

  it("ignora prefixo mod_/modulo_ e caixa", () => {
    expect(pagesForContractedModules(["MOD_Disparador_Campanhas"])).toContain("campanhas");
    expect(pagesForContractedModules(["modulo_followup"])).toContain("fila-de-followup");
  });

  it("nada contratado nao libera nada", () => {
    expect(pagesForContractedModules([])).toEqual([]);
    expect(pagesForContractedModules(null)).toEqual([]);
  });

  it('"all" libera o catalogo inteiro', () => {
    const todas = pagesForContractedModules(["all"]);
    for (const modulo of MODULE_CATALOG) {
      for (const pagina of modulo.pages) {
        expect(todas).toContain(pagina);
      }
    }
  });
});

describe("base universal do plano modular", () => {
  it("inclui as quatro paginas que todo tenant modular ve", () => {
    for (const base of ["dashboard", "leads", "banco-de-dados", "whatsapp"]) {
      expect(MODULAR_BASE_PAGES).toContain(base);
    }
  });
});
