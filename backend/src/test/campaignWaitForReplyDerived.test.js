// O passo 2 ("Enviar após resposta do lead") nunca disparava.
//
// A tela nao tem controle para dispatchOptions.waitForReply — o default do frontend
// e `false` fixo. O usuario expressa a intencao no PASSO (triggerMode: after_reply),
// mas o backend exigia a flag separada:
//   getCampaignStepPlan -> shouldUseReplyFlow = dispatchOptions.waitForReply === true
//                                               && replySteps.length > 0
// Com a flag sempre false, shouldUseReplyFlow nunca ligava, markCampaignLeadWaitingReply
// nunca rodava, e o progresso do lead nunca ganhava waitForReply/aguardando_usuario —
// que e exatamente o que continueCampaignLeadFromReply exige (dispatch.js:1111).
//
// Agora waitForReply e DERIVADO da sequencia. Este teste trava a cadeia toda.

import { describe, expect, it } from "vitest";
import {
  normalizeCampaignAnalyticsMeta,
  getCampaignStepPlan,
} from "../campaign-outbound.js";

function metaComPasso2({ triggerMode, waitForReply, enabled = true }) {
  return {
    sequence: [
      { id: "s1", type: "text", order: 1, text: "Ola, tudo bem?", enabled: true, triggerMode: "immediate" },
      { id: "s2", type: "text", order: 2, text: "Segue a proposta", enabled, triggerMode },
    ],
    dispatchOptions: { waitForReply },
  };
}

describe("waitForReply derivado do passo (after_reply)", () => {
  it("passo after_reply liga waitForReply mesmo com a flag false — era o defeito", () => {
    const meta = normalizeCampaignAnalyticsMeta(metaComPasso2({ triggerMode: "after_reply", waitForReply: false }));
    expect(meta.dispatchOptions.waitForReply).toBe(true);
  });

  it("e o plano de passos passa a usar o fluxo de resposta", () => {
    const plan = getCampaignStepPlan(metaComPasso2({ triggerMode: "after_reply", waitForReply: false }));
    expect(plan.shouldUseReplyFlow).toBe(true);
    expect(plan.replySteps).toHaveLength(1);
    expect(plan.replySteps[0].step.id).toBe("s2");
    // O passo 2 sai da rajada inicial: so vai depois da resposta.
    expect(plan.immediateSteps.map((s) => s.id)).toEqual(["s1"]);
  });

  it("sem passo after_reply, nada muda: continua disparo direto", () => {
    const plan = getCampaignStepPlan(metaComPasso2({ triggerMode: "immediate", waitForReply: false }));
    expect(plan.analyticsMeta.dispatchOptions.waitForReply).toBe(false);
    expect(plan.shouldUseReplyFlow).toBe(false);
    expect(plan.immediateSteps).toHaveLength(2);
  });

  it("passo after_reply DESABILITADO nao liga o fluxo", () => {
    const plan = getCampaignStepPlan(
      metaComPasso2({ triggerMode: "after_reply", waitForReply: false, enabled: false })
    );
    expect(plan.analyticsMeta.dispatchOptions.waitForReply).toBe(false);
    expect(plan.shouldUseReplyFlow).toBe(false);
  });

  it("flag true explicita continua respeitada (compat de campanha antiga)", () => {
    const meta = normalizeCampaignAnalyticsMeta(metaComPasso2({ triggerMode: "immediate", waitForReply: true }));
    expect(meta.dispatchOptions.waitForReply).toBe(true);
  });

  it("campanha JA SALVA com after_reply e flag false passa a funcionar sem reedicao", () => {
    // Shape exatamente como esta gravado hoje em campaigns.analytics_meta.
    const gravado = {
      message: "Ola",
      sequence: [
        { id: "a", type: "text", order: 1, text: "Ola", enabled: true, triggerMode: "immediate" },
        { id: "b", type: "text", order: 2, text: "Proposta", enabled: true, triggerMode: "after_reply" },
      ],
      dispatchOptions: { leadDelaySeconds: 2, stopOnStepFailure: true, waitForReply: false },
    };
    expect(getCampaignStepPlan(gravado).shouldUseReplyFlow).toBe(true);
  });
});

describe("o progresso gravado fecha a condicao que o consumidor exige", () => {
  // dispatch.js:560-572 — quando waitForReply, onLeadDispatched chama
  // markCampaignLeadWaitingReply com status "aguardando_usuario", e o patch inclui
  // waitForReply: true (dispatch.js:1211). Sao os dois campos que
  // continueCampaignLeadFromReply exige em dispatch.js:1111-1112.
  const source = new URL("../campaign/dispatch.js", import.meta.url);

  it("dispatch grava status aguardando_usuario e waitForReply true no ramo de espera", async () => {
    const { readFileSync } = await import("fs");
    const code = readFileSync(source, "utf8");

    const inicio = code.indexOf("onLeadDispatched: async ({ lead, phone, sentAt, lastStep, lastStepIndex })");
    expect(inicio, "callback onLeadDispatched nao encontrado").toBeGreaterThan(-1);
    const ramoEspera = code.slice(inicio, code.indexOf("} else {", inicio));
    expect(ramoEspera).toContain("if (waitForReply) {");
    expect(ramoEspera).toContain("markCampaignLeadWaitingReply");
    expect(ramoEspera).toContain('status: "aguardando_usuario"');

    const marcador = code.slice(code.indexOf("async function markCampaignLeadWaitingReply"));
    expect(marcador.slice(0, 1200)).toContain("waitForReply: true");
  });
});
