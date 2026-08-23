import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

vi.mock("../services/database.js", () => {
  return {
    supabase: {
      from: (table) => {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => {
                if (table === "campaigns") {
                  return {
                    data: {
                      id: "camp-finalized",
                      name: "Campanha Encerrada",
                      client_id: "client-test",
                      status: "running",
                      analytics_meta: {
                        sequence: [
                          { id: "s1", type: "text", order: 1, text: "Msg 1", triggerMode: "immediate", enabled: true },
                          { id: "s2", type: "text", order: 2, text: "Msg 2", triggerMode: "after_reply", enabled: true },
                        ],
                        dispatchOptions: { waitForReply: true },
                      },
                    },
                    error: null,
                  };
                }
                return { data: null, error: null };
              },
            }),
          }),
          update: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: {}, error: null }),
              }),
            }),
          }),
        };
      },
    },
    pgDatabasePool: null,
  };
});

import {
  continueCampaignLeadFromReply,
  extractCampaignProgress,
  mergeCampaignProgress,
} from "../campaign/dispatch.js";

const dispatchSource = readFileSync(resolve("src/campaign/dispatch.js"), "utf8");

describe("Fluxo de Respostas Múltiplas (Cadência Conversacional 1 Passo por Resposta)", () => {
  it("mantém o progresso aberto (aguardando_usuario) quando ainda existem passos à frente e finaliza apenas no último", () => {
    // Prova estática no código do dispatch.js
    expect(dispatchSource).toContain("const hasMoreStepsAhead = actuallySentStepIndex < steps.length - 1;");
    expect(dispatchSource).toContain('const pendingNextStepIndex = hasMoreStepsAhead ? actuallySentStepIndex + 1 : null;');
    expect(dispatchSource).toContain('const newProgressStatus = hasMoreStepsAhead ? "aguardando_usuario" : "finalizado";');
    expect(dispatchSource).toContain('const finalizedCurrentLead = summary.successCount > 0 && !hasMoreStepsAhead;');
  });

  it("simulação pura de transição de estado: 1 imediato + 3 após resposta (total 4 passos)", () => {
    const totalSteps = 4;
    const campaignId = "camp-test-123";

    // 1. Disparo Inicial (Passo 0 enviado na hora, aguardando Passo 1)
    let rawNormalized = mergeCampaignProgress({}, campaignId, {
      campaignId,
      waitForReply: true,
      currentStepIndex: 0,
      nextStepIndex: 1,
      totalSteps,
      status: "aguardando_usuario",
      leadStatus: "aguardando_resposta",
    });

    let progress = extractCampaignProgress(rawNormalized, campaignId);
    expect(progress.status).toBe("aguardando_usuario");
    expect(progress.nextStepIndex).toBe(1);

    // 2. Resposta 1 do Lead -> Envia Passo 1 (índice 1) -> Mais passos à frente? (1 < 3 -> SIM, próximo = 2)
    const sentIndex1 = 1;
    const hasMore1 = sentIndex1 < totalSteps - 1;
    expect(hasMore1).toBe(true);

    rawNormalized = mergeCampaignProgress(rawNormalized, campaignId, {
      currentStepIndex: sentIndex1,
      nextStepIndex: hasMore1 ? sentIndex1 + 1 : null,
      status: hasMore1 ? "aguardando_usuario" : "finalizado",
      leadStatus: hasMore1 ? "aguardando_resposta" : "sequencia_concluida",
      waitForReply: hasMore1,
    });

    progress = extractCampaignProgress(rawNormalized, campaignId);
    expect(progress.status).toBe("aguardando_usuario");
    expect(progress.nextStepIndex).toBe(2);

    // 3. Resposta 2 do Lead -> Envia Passo 2 (índice 2) -> Mais passos à frente? (2 < 3 -> SIM, próximo = 3)
    const sentIndex2 = 2;
    const hasMore2 = sentIndex2 < totalSteps - 1;
    expect(hasMore2).toBe(true);

    rawNormalized = mergeCampaignProgress(rawNormalized, campaignId, {
      currentStepIndex: sentIndex2,
      nextStepIndex: hasMore2 ? sentIndex2 + 1 : null,
      status: hasMore2 ? "aguardando_usuario" : "finalizado",
      leadStatus: hasMore2 ? "aguardando_resposta" : "sequencia_concluida",
      waitForReply: hasMore2,
    });

    progress = extractCampaignProgress(rawNormalized, campaignId);
    expect(progress.status).toBe("aguardando_usuario");
    expect(progress.nextStepIndex).toBe(3);

    // 4. Resposta 3 do Lead -> Envia Passo 3 (índice 3, último) -> Mais passos à frente? (3 < 3 -> NÃO, finaliza!)
    const sentIndex3 = 3;
    const hasMore3 = sentIndex3 < totalSteps - 1;
    expect(hasMore3).toBe(false);

    rawNormalized = mergeCampaignProgress(rawNormalized, campaignId, {
      currentStepIndex: sentIndex3,
      nextStepIndex: hasMore3 ? sentIndex3 + 1 : null,
      status: hasMore3 ? "aguardando_usuario" : "finalizado",
      leadStatus: hasMore3 ? "aguardando_resposta" : "sequencia_concluida",
      waitForReply: hasMore3,
      completedAt: new Date().toISOString(),
    });

    progress = extractCampaignProgress(rawNormalized, campaignId);
    expect(progress.status).toBe("finalizado");
    expect(progress.nextStepIndex).toBeNull();
    expect(progress.waitForReply).toBe(false);

    // 5. Resposta 4 e 5 do Lead (extras pós-finalização)
    const hasPendingProgress =
      progress &&
      progress.waitForReply === true &&
      progress.status === "aguardando_usuario" &&
      progress.nextStepIndex !== null;

    expect(hasPendingProgress).toBe(false);
  });

  it("garante que após finalizar, continueCampaignLeadFromReply rejeita reenvios extras com lead_not_waiting_reply", async () => {
    const finalizedMatch = {
      id: "camp-finalized",
      name: "Campanha Encerrada",
      client_id: "client-test",
      analytics_meta: {
        sequence: [
          { id: "s1", type: "text", order: 1, text: "Msg 1", triggerMode: "immediate", enabled: true },
          { id: "s2", type: "text", order: 2, text: "Msg 2", triggerMode: "after_reply", enabled: true },
        ],
      },
      leadImportItem: {
        id: "item-1",
        progress: {
          status: "finalizado",
          nextStepIndex: null,
          waitForReply: false,
        },
      },
    };

    const res = await continueCampaignLeadFromReply({
      clientId: "client-test",
      phone: "5511999999999",
      repliedAt: new Date().toISOString(),
      campaignMatch: finalizedMatch,
    });

    expect(res.continued).toBe(false);
    expect(res.reason).toBe("lead_not_waiting_reply");
  });
});
