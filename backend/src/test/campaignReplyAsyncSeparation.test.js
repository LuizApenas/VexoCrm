import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const chatbotRoutesSource = readFileSync(resolve("src/domains/chatbot/routes.js"), "utf8");

describe("campaign reply async separation & mutual exclusion", () => {
  it("responde 200 imediatamente com campaign_step_dispatched antes do envio de campanha", () => {
    const webhookStart = chatbotRoutesSource.indexOf('app.post("/api/hardcoded-chat-webhook"');
    const webhookBlock = chatbotRoutesSource.slice(webhookStart);

    // Confirma que a resposta 200 ocorre antes do continueCampaignLeadFromReply
    const respPos = webhookBlock.indexOf('responder({ status: "campaign_step_dispatched" }');
    const continuePos = webhookBlock.indexOf("continueCampaignLeadFromReply({");

    expect(respPos).toBeGreaterThan(0);
    expect(continuePos).toBeGreaterThan(0);
    expect(respPos).toBeLessThan(continuePos);
  });

  it("garante exclusão mútua: caminho de campanha faz return e nunca aciona buffer/IA", () => {
    const webhookStart = chatbotRoutesSource.indexOf('app.post("/api/hardcoded-chat-webhook"');
    const webhookBlock = chatbotRoutesSource.slice(webhookStart);

    const dispatchBlock = webhookBlock.slice(
      webhookBlock.indexOf("if (activeWaitCampaignToDispatch) {"),
      webhookBlock.indexOf("// ── CAMINHO 2: CHATBOT / AGENTE IA")
    );

    // O bloco de disparo de passo de campanha termina com return
    expect(dispatchBlock).toContain("return;");
    // Não contém chamada a bufferMessage nem processBatch dentro dele
    expect(dispatchBlock).not.toContain("bufferMessage(");
    expect(dispatchBlock).not.toContain("processBatch(");
  });

  it("log de erro detalhado na execução assíncrona fora do ciclo HTTP", () => {
    expect(chatbotRoutesSource).toContain("[campaign-routing] ERRO CRÍTICO no avanço de passo de campanha:");
  });

  it("instrumentação de latência em todo retorno de webhook", () => {
    expect(chatbotRoutesSource).toContain("[chatbot-webhook] HTTP 200 respondido em");
  });
});
