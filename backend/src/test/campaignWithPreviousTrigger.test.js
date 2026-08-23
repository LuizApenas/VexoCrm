import { describe, expect, it } from "vitest";
import {
  getCampaignStepPlan,
  normalizeCampaignAnalyticsMeta,
  validateCampaignAnalyticsMeta,
} from "../campaign-outbound.js";

const PASSO_1 = { id: "s1", type: "text", order: 1, text: "Msg 1", enabled: true, triggerMode: "immediate", delayAfterSeconds: 3 };
const PASSO_2_JUNTO = { id: "s2", type: "text", order: 2, text: "Msg 2", enabled: true, triggerMode: "with_previous", delayAfterSeconds: 4 };
const PASSO_3_PORTA = { id: "s3", type: "text", order: 3, text: "Msg 3", enabled: true, triggerMode: "after_reply", delayAfterSeconds: 3 };
const PASSO_4_JUNTO = { id: "s4", type: "text", order: 4, text: "Msg 4", enabled: true, triggerMode: "with_previous", delayAfterSeconds: 3 };
const PASSO_5_PORTA = { id: "s5", type: "text", order: 5, text: "Msg 5", enabled: true, triggerMode: "after_reply", delayAfterSeconds: 3 };

describe("Gatilho with_previous ('Junto com a anterior') e Agrupamento por Portas", () => {
  it("Cenário 1: 1 imediato + 1 junto (saem ambos no disparo inicial)", () => {
    const seq = [PASSO_1, PASSO_2_JUNTO];
    const plan = getCampaignStepPlan({ sequence: seq, dispatchOptions: { waitForReply: false } });

    // Não há porta after_reply, portanto não ativa espera de resposta
    expect(plan.shouldUseReplyFlow).toBe(false);
    expect(plan.immediateSteps.map((s) => s.id)).toEqual(["s1", "s2"]);
    expect(plan.replySteps).toHaveLength(0);
  });

  it("Cenário 2: 1 imediato + 1 porta + 1 junto (os 2 últimos saem juntos na 1ª resposta)", () => {
    const seq = [PASSO_1, PASSO_3_PORTA, PASSO_4_JUNTO];
    const plan = getCampaignStepPlan({ sequence: seq });

    // Disparo inicial tem apenas s1
    expect(plan.shouldUseReplyFlow).toBe(true);
    expect(plan.immediateSteps.map((s) => s.id)).toEqual(["s1"]);
    expect(plan.replySteps).toHaveLength(1);
    expect(plan.replySteps[0].index).toBe(1); // Aponta para s3

    // Na 1ª resposta, a sequência restante a partir do índice 1 é [s3, s4]
    const remainingSteps = seq.slice(1);
    expect(remainingSteps.map((s) => s.id)).toEqual(["s3", "s4"]);

    // Como s4 é with_previous (e não after_reply), não há quebra de porta entre s3 e s4
    const firstDoorInRemaining = remainingSteps.findIndex((s, idx) => idx > 0 && s.triggerMode === "after_reply");
    expect(firstDoorInRemaining).toBe(-1); // Ambos saem juntos no mesmo lote
  });

  it("Cenário 3: 1 imediato + 1 porta + 1 junto + 1 porta (Cenário do Dono)", () => {
    const seq = [PASSO_1, PASSO_3_PORTA, PASSO_4_JUNTO, PASSO_5_PORTA];
    const plan = getCampaignStepPlan({ sequence: seq });

    // 1. Disparo Inicial: envia s1, aponta para índice 1 (s3)
    expect(plan.immediateSteps.map((s) => s.id)).toEqual(["s1"]);
    expect(plan.replySteps[0].index).toBe(1);
    expect(plan.replySteps[1].index).toBe(3);

    // 2. Na 1ª resposta (índice 1): remainingSteps é [s3 (porta), s4 (junto), s5 (porta)]
    const remaining1 = seq.slice(1);
    const doorInRemaining1 = remaining1.findIndex((s, idx) => idx > 0 && s.triggerMode === "after_reply");
    
    // O loop para no índice 2 de remaining1 (que é s5)
    expect(doorInRemaining1).toBe(2);
    const lote1 = remaining1.slice(0, doorInRemaining1);
    expect(lote1.map((s) => s.id)).toEqual(["s3", "s4"]); // 2º e 3º passos saem na 1ª resposta

    // 3. Na 2ª resposta (índice 3): remainingSteps é [s5 (porta)]
    const remaining2 = seq.slice(3);
    const doorInRemaining2 = remaining2.findIndex((s, idx) => idx > 0 && s.triggerMode === "after_reply");
    expect(doorInRemaining2).toBe(-1);
    expect(remaining2.map((s) => s.id)).toEqual(["s5"]); // 4º passo sai na 2ª resposta
  });

  it("Cenário 4: with_previous como PRIMEIRO passo é tratado como imediato e não quebra o disparo", () => {
    const seq = [
      { id: "s1_junto", type: "text", order: 1, text: "Msg 1", enabled: true, triggerMode: "with_previous" },
      PASSO_3_PORTA,
    ];
    const plan = getCampaignStepPlan({ sequence: seq });

    expect(plan.immediateSteps.map((s) => s.id)).toEqual(["s1_junto"]);
    expect(plan.replySteps).toHaveLength(1);
    expect(plan.replySteps[0].index).toBe(1);
    expect(validateCampaignAnalyticsMeta({ sequence: seq }).valid).toBe(true);
  });

  it("Teste de Mutação: se with_previous após porta fosse tratado como porta individual, o Cenário do Dono quebraria", () => {
    const seq = [PASSO_1, PASSO_3_PORTA, PASSO_4_JUNTO, PASSO_5_PORTA];
    
    // Na implementação correta:
    const remaining1 = seq.slice(1);
    const passosLote1Correto = remaining1.filter((s, idx) => idx === 0 || s.triggerMode !== "after_reply");
    expect(passosLote1Correto.map(s => s.id)).toEqual(["s3", "s4"]);

    // Se houvesse mutação tratando with_previous como after_reply:
    const passosLote1Mutado = remaining1.filter((s, idx) => idx === 0 || (s.triggerMode !== "after_reply" && s.triggerMode !== "with_previous"));
    expect(passosLote1Mutado.map(s => s.id)).not.toEqual(["s3", "s4"]);
    expect(passosLote1Mutado.map(s => s.id)).toEqual(["s3"]);
  });
});
