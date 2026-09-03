// Fase 2, 2.1 e 2.2 — o Pipeline do Dashboard le `stage`, nao `status` nem
// `lead_conversions`; "Oportunidades Quentes" le `temperature`, nao `qualificacao`.
//
// Decisao do dono: `stage` e o funil (novo/inquiry/open_budget/buyer, escrito
// por classifyChatContent em domains/leads/routes.js). `status` e estado de
// conversa — outra dimensao, nao mistura mais no Pipeline. `qualificacao` sai
// de uso: medida vazia na base inteira dos dois tenants em producao
// (2026-09-03T12:11:04Z — 2126/2126 e 783/783 leads sem qualificacao util).
//
// Medido em producao, populacao completa via /api/leads, mesma execucao:
//   geracao-digital  stage {cold:2125, open_budget:1}       temperature {cold:2089, warm:36, hot:1}
//   sonhare          stage {cold:782,  open_budget:1}        temperature {cold:718,  warm:64, hot:1}
// Nenhum 'inquiry' nem 'buyer' em nenhum tenant hoje. Os testes abaixo fixam o
// COMPORTAMENTO (o que cada valor de stage/temperature produz), nao esses
// numeros de producao — que sao pequenos, reais, e vao mudar com o volume.

import { describe, expect, it } from "vitest";
import { buildDashboardPayload } from "../services/analytics.js";

const cliente = { id: "t", name: "T" };

function lead(id, overrides = {}) {
  return {
    id,
    telefone: null,
    nome: "L" + id,
    status: "aguardando_resposta", // status deliberadamente neutro: nao deve influenciar o pipeline
    created_at: "2026-01-01T00:00:00Z",
    stage: null,
    temperature: null,
    ...overrides,
  };
}

describe("pipeline le stage, nao status", () => {
  it("stage='inquiry' conta como Em Atendimento (contactedLeads)", () => {
    const p = buildDashboardPayload(cliente, [lead("a", { stage: "inquiry" })], [], []);
    expect(p.summary.contactedLeads).toBe(1);
    expect(p.summary.qualifiedLeads).toBe(0);
    expect(p.summary.conversions).toBe(0);
  });

  it("stage='open_budget' conta como Qualificados/Proposta", () => {
    const p = buildDashboardPayload(cliente, [lead("a", { stage: "open_budget" })], [], []);
    expect(p.summary.qualifiedLeads).toBe(1);
    expect(p.summary.contactedLeads).toBe(0);
    expect(p.summary.conversions).toBe(0);
  });

  it("stage='buyer' conta como Vendas Fechadas", () => {
    const p = buildDashboardPayload(cliente, [lead("a", { stage: "buyer" })], [], []);
    expect(p.summary.conversions).toBe(1);
    expect(p.summary.contactedLeads).toBe(0);
    expect(p.summary.qualifiedLeads).toBe(0);
  });

  it("stage='cold' (default) nao conta em nenhuma etapa do pipeline", () => {
    const p = buildDashboardPayload(cliente, [lead("a", { stage: "cold" })], [], []);
    expect(p.summary.contactedLeads).toBe(0);
    expect(p.summary.qualifiedLeads).toBe(0);
    expect(p.summary.conversions).toBe(0);
  });

  it("stage='lost' nao conta em nenhuma etapa — nao e destino do funil", () => {
    const p = buildDashboardPayload(cliente, [lead("a", { stage: "lost" })], [], []);
    expect(p.summary.contactedLeads).toBe(0);
    expect(p.summary.qualifiedLeads).toBe(0);
    expect(p.summary.conversions).toBe(0);
  });

  it("status NAO influencia o pipeline: status 'qualificado' com stage cold fica em zero", () => {
    // Este e o caso que estava errado antes: qualifiedLeads vinha de
    // isQualifiedStatus(status). Agora so stage decide.
    const p = buildDashboardPayload(cliente, [lead("a", { status: "qualificado", stage: "cold" })], [], []);
    expect(p.summary.qualifiedLeads, "status voltou a alimentar o pipeline").toBe(0);
  });

  it("lead_conversions (tabela) NAO alimenta mais 'conversions' — so stage='buyer'", () => {
    // Uma linha de conversao fechada na tabela lead_conversions, mas o lead NAO
    // tem stage='buyer'. Antes isto sozinho fazia conversions=1; agora nao deve.
    const conversoesFechadas = [{ id: "c1", conversion_status: "ganho", client_id: "t" }];
    const p = buildDashboardPayload(cliente, [lead("a", { stage: "cold" })], conversoesFechadas, []);
    expect(p.summary.conversions, "lead_conversions voltou a alimentar o pipeline").toBe(0);
  });

  it("soma corretamente uma base mista", () => {
    const leads = [
      lead("1", { stage: "cold" }),
      lead("2", { stage: "inquiry" }),
      lead("3", { stage: "inquiry" }),
      lead("4", { stage: "open_budget" }),
      lead("5", { stage: "buyer" }),
    ];
    const p = buildDashboardPayload(cliente, leads, [], []);
    expect(p.summary.totalLeads).toBe(5);
    expect(p.summary.contactedLeads).toBe(2);
    expect(p.summary.qualifiedLeads).toBe(1);
    expect(p.summary.conversions).toBe(1);
  });
});

describe("Oportunidades Quentes le temperature, nao qualificacao", () => {
  it("temperature='hot' conta como hotLeads", () => {
    const p = buildDashboardPayload(cliente, [lead("a", { temperature: "hot" })], [], []);
    expect(p.summary.hotLeads).toBe(1);
  });

  it("qualificacao com texto 'quente' NAO conta mais — so a coluna temperature", () => {
    // Este e o caso que estava zerado em producao: qualificacao vazia fazia
    // hotLeads=0 mesmo com leads reais. Agora um valor em qualificacao, SEM
    // temperature preenchido, tambem nao deve contar — a fonte mudou de vez.
    const p = buildDashboardPayload(
      cliente,
      [lead("a", { qualificacao: "Cliente muito quente, fechar urgente", temperature: null })],
      [],
      []
    );
    expect(p.summary.hotLeads, "qualificacao voltou a alimentar Oportunidades Quentes").toBe(0);
  });

  it("temperature invalida ou vazia cai em 'sem sinal', nao trava", () => {
    const p = buildDashboardPayload(
      cliente,
      [lead("a", { temperature: null }), lead("b", { temperature: "lava" })],
      [],
      []
    );
    expect(p.summary.hotLeads).toBe(0);
    expect(p.summary.noSignalLeads).toBe(2);
  });

  it("temperatureBreakdown e recentLeads[].temperature usam a mesma fonte", () => {
    const p = buildDashboardPayload(cliente, [lead("a", { temperature: "warm" })], [], []);
    expect(p.summary.warmLeads).toBe(1);
    const quente = p.temperatureBreakdown.find((t) => t.name === "Morno");
    expect(quente.value).toBe(1);
    expect(p.recentLeads[0].temperature).toBe("warm");
  });
});
