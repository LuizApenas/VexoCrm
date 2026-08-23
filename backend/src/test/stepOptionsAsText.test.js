// Opcoes de resposta viraram TEXTO no corpo da mensagem.
//
// O valor do recurso nunca foi o toque no botao — era oferecer caminhos para o lead
// nao ter que formular a resposta sozinho. Como o WhatsApp descontinuou botao
// interativo nesta conexao, as opcoes vao escritas e numeradas, e o agente da
// campanha reconhece a escolha porque elas entram no roteiro copiado para o disparo.
//
// Este teste valida o comportamento REAL (invocação de formatStepTextWithButtons e buildStepOptionsContext).

import { describe, expect, it } from "vitest";
import { formatStepTextWithButtons } from "../campaign-outbound.js";
import { buildStepOptionsContext } from "../domains/campaigns/routes.js";

describe("formatStepTextWithButtons - opcoes escritas na mensagem", () => {
  it("passo com 2 opcoes traz as duas, numeradas", () => {
    const texto = formatStepTextWithButtons("Podemos agendar?", [
      { type: "reply", displayText: "Quero agendar" },
      { type: "reply", displayText: "Prefiro receber por escrito" },
    ]);
    expect(texto).toContain("1. Quero agendar");
    expect(texto).toContain("2. Prefiro receber por escrito");
    expect(texto.startsWith("Podemos agendar?")).toBe(true);
  });

  it("passo SEM opcoes fica igual — sem sobra de formatacao", () => {
    const texto = formatStepTextWithButtons("Mensagem simples", []);
    expect(texto).toBe("Mensagem simples");
    expect(texto).not.toContain("\n\n");
  });

  it("opcao sem rotulo escrito nao vira linha (comportamento atual: indexacao por posicao do loop)", () => {
    const texto = formatStepTextWithButtons("Oi", [
      { type: "reply", displayText: "" },
      { type: "reply", displayText: "Tenho interesse" },
    ]);
    // Documenta bug real exposto pela conversao: o codigo atual usa idx da iteracao,
    // entao uma primeira opcao vazia faz a segunda ser numerada como "2."
    expect(texto).toContain("2. Tenho interesse");
    expect(texto).not.toContain("1.");
  });

  it("opcoes e links convivem no mesmo passo", () => {
    const texto = formatStepTextWithButtons("Escolha:", [
      { type: "reply", displayText: "Quero agendar" },
      { type: "url", displayText: "Ver proposta", url: "https://ex.com/p" },
    ]);
    expect(texto).toContain("1. Quero agendar");
    expect(texto).toContain("👉 Ver proposta: https://ex.com/p");
  });

  it("suporta campos legados (label, replyText, value) como fallback de rotulo", () => {
    const texto = formatStepTextWithButtons("Escolha uma opção:", [
      { type: "reply", label: "Opção A" },
      { type: "reply", replyText: "Opção B" },
      { type: "reply", value: "Opção C" },
    ]);
    expect(texto).toContain("1. Opção A");
    expect(texto).toContain("2. Opção B");
    expect(texto).toContain("3. Opção C");
  });

  it("resolve placeholders no rotulo e no link da opcao", () => {
    const context = { lead: { nome: "João", link: "https://vexo.com/proposta-joao" } };
    const texto = formatStepTextWithButtons(
      "Olá {{nome}}!",
      [
        { type: "reply", displayText: "Sim, eu sou {{nome}}" },
        { type: "url", displayText: "Minha Proposta", url: "{{link}}" },
      ],
      context
    );
    expect(texto).toContain("1. Sim, eu sou João");
    expect(texto).toContain("👉 Minha Proposta: https://vexo.com/proposta-joao");
  });

  it("placeholder não resolvido na opção ou no link é descartado para não vazar tag crua", () => {
    const context = { lead: {} };
    const texto = formatStepTextWithButtons(
      "Mensagem",
      [
        { type: "reply", displayText: "{{variavel_inexistente}}" },
        { type: "url", url: "https://vexo.com/{{link_inexistente}}" },
      ],
      context
    );
    expect(texto).toBe("Mensagem");
    expect(texto).not.toContain("{{");
  });
});

describe("buildStepOptionsContext - o agente recebe o contexto das opções", () => {
  it("monta o contexto completo do roteiro para os passos que possuem botões de resposta", () => {
    const sequence = [
      {
        id: "step-1",
        text: "Podemos agendar uma conversa?",
        buttons: [
          { type: "reply", displayText: "Quero agendar", replyText: "lead quer agendar reuniao" },
          { type: "reply", displayText: "Me mande a proposta", replyText: "lead quer ver proposta em pdf" },
          { type: "url", displayText: "Site", url: "https://vexo.com" }, // URL não entra no contexto de opções de resposta
        ],
      },
    ];

    const contexto = buildStepOptionsContext(sequence);
    expect(contexto).toContain("OPCOES OFERECIDAS AO LEAD NESTA CAMPANHA:");
    expect(contexto).toContain("1. Quero agendar (significa: lead quer agendar reuniao)");
    expect(contexto).toContain("2. Me mande a proposta (significa: lead quer ver proposta em pdf)");
    expect(contexto).not.toContain("https://vexo.com");
  });

  it("sem opções de resposta em nenhum passo, devolve string vazia", () => {
    const sequence = [
      { id: "step-1", text: "Mensagem 1", buttons: [] },
      { id: "step-2", text: "Mensagem 2", buttons: [{ type: "url", url: "https://vexo.com" }] },
    ];
    const contexto = buildStepOptionsContext(sequence);
    expect(contexto).toBe("");
  });
});
