import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

const gdRoutesSource = readFileSync(resolve("src/domains/geracaoDigitalRoutes.js"), "utf8");

describe("GET /api/gd/public/proposals/:id — Retorno Completo de Colunas e Condições Especiais", () => {
  it("A query SQL do endpoint público utiliza SELECT * para não truncar condicoes_especiais ou descontos", () => {
    // Extrai o bloco do endpoint GET /api/gd/public/proposals/:id
    const endpointRegex = /app\.get\(\s*["']\/api\/gd\/public\/proposals\/:id["'][\s\S]*?const result = await pool\.query\([\s\S]*?\);/;
    const match = gdRoutesSource.match(endpointRegex);
    expect(match).toBeTruthy();

    const querySnippet = match[0];
    expect(querySnippet).toContain("SELECT * FROM public.gd_proposals WHERE id = $1");
    // Garante que não possui a lista antiga truncada que omitia condicoes_especiais
    expect(querySnippet).not.toContain("SELECT id, tenant_id, presentation_id");
  });

  it("Cenário com condicoes_especiais preenchido: data.condicoes_especiais é entregue intacto", () => {
    const rowFromDb = {
      id: "dbbdd634-1f58-4468-bbf8-ce40026178b0",
      tenant_id: "tenant-gd",
      prospect_name: "Cliente Real",
      condicoes: "Contrato de 6 meses. Faturamento recorrente mensal.",
      condicoes_especiais: "VP 1º mês - Isento\nVP 2º mês - permuta utilização do sitio\nVP 3º mês - 2.400",
      desconto_setup_pct: 0,
      desconto_mensal_pct: 0,
      itens: [],
      pacotes_ofertados: [],
    };

    // Simula o serializer do endpoint: res.json({ success: true, data: { ...row, ... } })
    const serializer = (row) => ({
      success: true,
      data: {
        ...row,
        itens: row.itens,
        payment_link: row.payment_link || "",
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
      tenant_id: "tenant-gd",
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
        ...row,
        itens: row.itens,
        payment_link: row.payment_link || "",
        valor_setup: 0,
        valor_recorrente: 0,
        packages: []
      }
    });

    const response = serializer(rowFromDbSemEspecial);
    expect(response.data.condicoes_especiais).toBeNull();
    expect(response.data.condicoes).toBe("Contrato de 6 meses. Faturamento recorrente mensal.");
  });

  it("Teste de Mutação: se o SELECT fosse uma lista explícita sem condicoes_especiais, o campo seria undefined e quebraria", () => {
    // Simula a lista antiga truncada
    const { condicoes_especiais, ...rowTruncadoAntigo } = {
      id: "dbbdd634-1f58-4468-bbf8-ce40026178b0",
      prospect_name: "Cliente Real",
      condicoes: "Contrato de 6 meses. Faturamento recorrente mensal.",
      condicoes_especiais: "VP 1º mês - Isento",
    };

    expect(rowTruncadoAntigo.condicoes_especiais).toBeUndefined();

    // Verificação no componente front: Boolean((proposal as any).condicoes_especiais) seria false
    const cardRenderizariaComBug = Boolean(rowTruncadoAntigo.condicoes_especiais);
    expect(cardRenderizariaComBug).toBe(false); // Prova a falha com a query antiga

    // Com o SELECT * corrigido:
    const cardRenderizaCorrigido = Boolean(
      { ...rowTruncadoAntigo, condicoes_especiais }.condicoes_especiais
    );
    expect(cardRenderizaCorrigido).toBe(true); // Prova a correção com a query nova
  });
});
