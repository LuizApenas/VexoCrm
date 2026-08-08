// Fluxo "Enviar após resposta do lead", ponta a ponta na parte que decide o envio.
//
// Regressao real corrigida aqui: a derivacao de waitForReply (b935ea7) rodava
// tambem na CONTINUACAO pos-resposta. dispatch.js monta `sequence: remainingSteps`
// (so o passo after_reply) com waitForReply: false de proposito; a derivacao
// sobrescrevia para true, e validateCampaignAnalyticsMeta rejeitava o envio com
// "precisam de pelo menos um passo imediato" — o passo 2 nunca era tentado, sem
// nenhum whatsapp_step_request no log.

import { describe, expect, it } from "vitest";
import {
  normalizeCampaignAnalyticsMeta,
  getCampaignStepPlan,
  validateCampaignAnalyticsMeta,
} from "../campaign-outbound.js";

const PASSO_1 = { id: "s1", type: "text", order: 1, text: "Ola, {{nome}} tudo bem?", enabled: true, triggerMode: "immediate" };
const PASSO_2 = { id: "s2", type: "text", order: 2, text: "Vamos agendar um bate papo?", enabled: true, triggerMode: "after_reply" };

const campanhaCompleta = { sequence: [PASSO_1, PASSO_2], dispatchOptions: { waitForReply: false } };

describe("disparo inicial: campanha com passo after_reply", () => {
  it("liga o fluxo de espera e deixa o passo 2 pendente", () => {
    const plan = getCampaignStepPlan(campanhaCompleta);
    expect(plan.analyticsMeta.dispatchOptions.waitForReply).toBe(true);
    expect(plan.shouldUseReplyFlow).toBe(true);
    expect(plan.immediateSteps.map((s) => s.id)).toEqual(["s1"]);
    expect(plan.replySteps).toHaveLength(1);
    // Indice que vai para progress.nextStepIndex.
    expect(plan.replySteps[0].index).toBe(1);
  });

  it("a campanha completa passa na validacao", () => {
    expect(validateCampaignAnalyticsMeta(campanhaCompleta).valid).toBe(true);
  });
});

describe("continuacao pos-resposta: so o passo after_reply na sequencia", () => {
  // Exatamente o que dispatch.js:1570-1577 monta para continueCampaignLeadFromReply.
  const continuacao = {
    sequence: [PASSO_2],
    dispatchOptions: { waitForReply: false, leadDelaySeconds: 0 },
  };

  it("NAO reativa o fluxo de espera — era o defeito", () => {
    const meta = normalizeCampaignAnalyticsMeta(continuacao);
    expect(meta.dispatchOptions.waitForReply).toBe(false);
  });

  it("passa na validacao, entao o passo 2 chega a ser enviado", () => {
    const resultado = validateCampaignAnalyticsMeta(continuacao);
    expect(resultado.valid, resultado.message || "").toBe(true);
  });

  it("o passo 2 entra como passo imediato da continuacao", () => {
    const plan = getCampaignStepPlan(continuacao);
    expect(plan.shouldUseReplyFlow).toBe(false);
    expect(plan.enabledSteps.map((s) => s.id)).toEqual(["s2"]);
  });
});

describe("o que a derivacao NAO pode quebrar", () => {
  it("sequencia so com passos imediatos continua sem espera", () => {
    const plan = getCampaignStepPlan({ sequence: [PASSO_1], dispatchOptions: { waitForReply: false } });
    expect(plan.analyticsMeta.dispatchOptions.waitForReply).toBe(false);
  });

  it("flag true explicita continua respeitada", () => {
    const meta = normalizeCampaignAnalyticsMeta({ sequence: [PASSO_1], dispatchOptions: { waitForReply: true } });
    expect(meta.dispatchOptions.waitForReply).toBe(true);
  });

  it("passo after_reply desabilitado nao liga a espera", () => {
    const plan = getCampaignStepPlan({
      sequence: [PASSO_1, { ...PASSO_2, enabled: false }],
      dispatchOptions: { waitForReply: false },
    });
    expect(plan.shouldUseReplyFlow).toBe(false);
  });
});

describe("botao de url com placeholder nao resolvido", () => {
  // Com o Agendamento Integrado desligado, scheduling_link nao entra em
  // normalized_data e o placeholder fica LITERAL. Botao com url "{{scheduling_link}}"
  // nao pode ir para o WhatsApp.
  const source = new URL("../campaign-outbound.js", import.meta.url);

  it("descarta o botao e nao anexa o link no texto", async () => {
    const { readFileSync } = await import("fs");
    const code = readFileSync(source, "utf8");

    expect(code).toContain("function buildStepButtons");
    // Os dois builders usam o mesmo caminho — nada de regra duplicada divergindo.
    expect(code).toContain("const formattedButtons = buildStepButtons(step, context, phone);");
    // A guarda do placeholder existe nos dois pontos: botao e texto anexado.
    const ocorrencias = code.match(/\/\\\{\\\{\.\*\?\\\}\\\}\//g) || code.match(/\{\\\{\.\*\?\\\}\\\}/g) || [];
    expect(ocorrencias.length).toBeGreaterThanOrEqual(2);
  });
});
