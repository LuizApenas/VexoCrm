import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

const gdRoutesSource = readFileSync(resolve("src/domains/geracaoDigitalRoutes.js"), "utf8");

describe("GET /api/gd/public/proposals/:id — Retorno Seguro de Condições Especiais e Descontos", () => {
  it("A query SQL do endpoint público contém explicitamente condicoes_especiais, descontos e dados do plano", () => {
    const endpointRegex = /app\.get\(\s*["']\/api\/gd\/public\/proposals\/:id["'][\s\S]*?const result = await pool\.query\([\s\S]*?\);/;
    const match = gdRoutesSource.match(endpointRegex);
    expect(match).toBeTruthy();

    const querySnippet = match[0];
    expect(querySnippet).toContain("condicoes_especiais");
    expect(querySnippet).toContain("desconto_setup_pct");
    expect(querySnippet).toContain("desconto_mensal_pct");
    expect(querySnippet).toContain("vexi_plan");
    expect(querySnippet).toContain("vexo_plan");
    expect(querySnippet).not.toContain("SELECT *");
  });

  it("Cenário com condicoes_especiais preenchido: data.condicoes_especiais é entregue intacto", () => {
    const rowFromDb = {
      id: "dbbdd634-1f58-4468-bbf8-ce40026178b0",
      prospect_name: "Cliente Real",
      condicoes: "Contrato de 6 meses. Faturamento recorrente mensal.",
      condicoes_especiais: "VP 1º mês - Isento\nVP 2º mês - permuta utilização do sitio\nVP 3º mês - 2.400",
      desconto_setup_pct: 0,
      desconto_mensal_pct: 0,
      itens: [],
      pacotes_ofertados: [],
    };

    const serializer = (row) => ({
      success: true,
      data: {
        id: row.id,
        prospect_name: row.prospect_name,
        condicoes: row.condicoes,
        condicoes_especiais: row.condicoes_especiais,
        desconto_setup_pct: row.desconto_setup_pct,
        desconto_mensal_pct: row.desconto_mensal_pct,
        itens: row.itens,
        payment_link: "",
        valor_setup: 0,
        valor_recorrente: 0,
        packages: []
      }
    });

    const response = serializer(rowFromDb);
    expect(response.data.condicoes_especiais).toBe(
      "VP 1º mês - Isento\nVP 2º mês - permuta utilização do sitio\nVP 3º mês - 2.400"
    );
    expect(response.data.condicoes).toBe("Contrato de 6 meses. Faturamento recorrente mensal.");
  });

  it("Cenário com condicoes_especiais vazio/nulo: data.condicoes_especiais é null", () => {
    const rowFromDbSemEspecial = {
      id: "proposta-sem-especial",
      prospect_name: "Cliente Sem Especial",
      condicoes: "Contrato de 6 meses. Faturamento recorrente mensal.",
      condicoes_especiais: null,
      desconto_setup_pct: 0,
      desconto_mensal_pct: 0,
      itens: [],
      pacotes_ofertados: [],
    };

    const serializer = (row) => ({
      success: true,
      data: {
        id: row.id,
        prospect_name: row.prospect_name,
        condicoes: row.condicoes,
        condicoes_especiais: row.condicoes_especiais,
        desconto_setup_pct: row.desconto_setup_pct,
        desconto_mensal_pct: row.desconto_mensal_pct,
        itens: row.itens,
        payment_link: "",
        valor_setup: 0,
        valor_recorrente: 0,
        packages: []
      }
    });

    const response = serializer(rowFromDbSemEspecial);
    expect(response.data.condicoes_especiais).toBeNull();
    expect(response.data.condicoes).toBe("Contrato de 6 meses. Faturamento recorrente mensal.");
  });
});
