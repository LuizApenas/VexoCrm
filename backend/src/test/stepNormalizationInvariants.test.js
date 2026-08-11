// Invariantes de normalizeSequenceStep.
//
// Contexto: 0fee253 acrescentou `buttons` ao passo normalizado e houve suspeita de
// que isso tivesse quebrado o fluxo "após resposta" (as duas mensagens voltaram a
// sair juntas em producao). Nao quebrou — mas a suspeita era legitima, porque
// normalizeSequenceStep alimenta getCampaignStepPlan, que decide o que sai na
// rajada inicial.
//
// Este teste trava a regra: acrescentar campo NAO pode alterar os que ja existiam.
// Qualquer campo novo entra como adicao pura ou este teste quebra.

import { describe, expect, it } from "vitest";
import { normalizeCampaignAnalyticsMeta, getCampaignStepPlan } from "../campaign-outbound.js";

const CAMPOS_ANTES_DE_0fee253 = [
  "id",
  "type",
  "order",
  "text",
  "textVariants",
  "image",
  "enabled",
  "delayAfterSeconds",
  "triggerMode",
];

const PASSO_1 = { id: "s1", type: "text", order: 1, text: "Ola {{nome}}", enabled: true, triggerMode: "immediate" };
const PASSO_2 = {
  id: "s2",
  type: "text",
  order: 2,
  text: "Vamos agendar?",
  enabled: true,
  triggerMode: "after_reply",
  buttons: [{ type: "url", displayText: "Link de Acesso", url: "{{scheduling_link}}" }],
};

function normalizar(sequence, dispatchOptions = { waitForReply: false }) {
  return normalizeCampaignAnalyticsMeta({ sequence, dispatchOptions }).sequence;
}

describe("campos que existiam antes continuam intactos", () => {
  it("todos os campos anteriores sobrevivem a normalizacao", () => {
    const [, p2] = normalizar([PASSO_1, PASSO_2]);
    for (const campo of CAMPOS_ANTES_DE_0fee253) {
      expect(p2, `campo ${campo} sumiu do passo normalizado`).toHaveProperty(campo);
    }
  });

  it("triggerMode sobrevive — e o campo que decide o fluxo de resposta", () => {
    const [p1, p2] = normalizar([PASSO_1, PASSO_2]);
    expect(p1.triggerMode).toBe("immediate");
    expect(p2.triggerMode).toBe("after_reply");
  });

  it("order e enabled sobrevivem", () => {
    const [p1, p2] = normalizar([PASSO_1, PASSO_2]);
    expect(p1.order).toBe(1);
    expect(p2.order).toBe(2);
    expect(p2.enabled).toBe(true);
  });

  it("passo COM botao continua sendo after_reply e nao entra na rajada", () => {
    const plan = getCampaignStepPlan({ sequence: [PASSO_1, PASSO_2], dispatchOptions: { waitForReply: false } });
    expect(plan.shouldUseReplyFlow).toBe(true);
    expect(plan.immediateSteps.map((s) => s.id)).toEqual(["s1"]);
    expect(plan.replySteps.map((e) => e.step.id)).toEqual(["s2"]);
  });

  it("passo SEM botao se comporta igual ao passo com botao", () => {
    const semBotao = { ...PASSO_2, buttons: undefined };
    const comBotao = getCampaignStepPlan({ sequence: [PASSO_1, PASSO_2], dispatchOptions: {} });
    const sem = getCampaignStepPlan({ sequence: [PASSO_1, semBotao], dispatchOptions: {} });
    expect(sem.shouldUseReplyFlow).toBe(comBotao.shouldUseReplyFlow);
    expect(sem.immediateSteps.map((s) => s.id)).toEqual(comBotao.immediateSteps.map((s) => s.id));
  });
});

describe("as tres opcoes de 'quem responde' da tela nao alteram a separacao dos passos", () => {
  // c6634b3 passou a mandar waitForReply conforme o seletor replyAgent. A separacao
  // dos passos e decidida pelo triggerMode, entao as tres opcoes tem de manter o
  // passo after_reply fora da rajada inicial.
  const casos = [
    ["atendimento (default)", { waitForReply: false }],
    ["passos", { waitForReply: true }],
    ["campanha", { waitForReply: false }],
  ];

  for (const [nome, dispatchOptions] of casos) {
    it(`${nome}: envia so o passo imediato`, () => {
      const plan = getCampaignStepPlan({ sequence: [PASSO_1, PASSO_2], dispatchOptions });
      expect(plan.immediateSteps.map((s) => s.id)).toEqual(["s1"]);
      expect(plan.replySteps.map((e) => e.step.id)).toEqual(["s2"]);
    });
  }
});

describe("a unica forma de as duas mensagens sairem juntas", () => {
  it("e o passo 2 NAO ter triggerMode after_reply — ou seja, problema de dado", () => {
    const semTrigger = { ...PASSO_2, triggerMode: undefined };
    const plan = getCampaignStepPlan({ sequence: [PASSO_1, semTrigger], dispatchOptions: { waitForReply: false } });
    expect(plan.shouldUseReplyFlow).toBe(false);
    expect(plan.immediateSteps.map((s) => s.id)).toEqual(["s1", "s2"]);
  });
});
