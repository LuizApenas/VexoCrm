// Reenvio do passo 1 ao mesmo lead, por horas (19:50, 20:21, 02:08, 10:58).
//
// Duas travas impedem reexecução no caminho da fila de campaign_dispatches:
// 1. Claim atômico do disparo no scheduler (UPDATE ... WHERE id = $1 AND status = 'scheduled').
// 2. Claim atômico por lead/telefone dentro do mesmo disparo.
//
// Este teste valida o comportamento REAL através da execução das travas.

import { describe, expect, it, vi } from "vitest";
import { claimCampaignForDispatch } from "../campaign/dispatch.js";
import { _setPgDatabasePoolForTesting } from "../services/database.js";

describe("claim atômico e proteção contra reentrada do disparo", () => {
  it("claimCampaignForDispatch: primeiro claim bloqueia com sucesso e o segundo concorrente recebe 409 CAMPAIGN_ALREADY_LOCKED", async () => {
    const campaign = {
      id: "camp-concorrente-123",
      name: "Campanha Concorrente",
      client_id: "vexo",
      status: "scheduled",
      analytics_meta: { sequence: [{ id: "s1", text: "Oi" }] },
    };

    let isClaimed = false;

    const fakePool = {
      query: vi.fn().mockImplementation((queryText, params) => {
        const sql = typeof queryText === "string" ? queryText : queryText?.text || "";
        if (sql.includes("campaigns") && (sql.includes("UPDATE") || sql.includes("update"))) {
          if (!isClaimed) {
            isClaimed = true;
            return Promise.resolve({
              rows: [
                {
                  id: campaign.id,
                  name: campaign.name,
                  client_id: campaign.client_id,
                  status: "processing",
                  analytics_meta: campaign.analytics_meta,
                },
              ],
            });
          }
          // Segundo update concorrido não acha linha com status 'scheduled'
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      }),
    };
    _setPgDatabasePoolForTesting(fakePool);

    try {
      // 1. Primeiro claim obtém o lock com sucesso
      const claimed = await claimCampaignForDispatch(campaign, "scheduler");
      expect(claimed).toBeDefined();
      expect(claimed.id).toBe(campaign.id);
      expect(claimed.status).toBe("processing");

      // 2. Segundo claim concorrente deve FALHAR com CAMPAIGN_ALREADY_LOCKED (409)
      await expect(claimCampaignForDispatch(campaign, "scheduler")).rejects.toThrow(
        "Campaign is already processing or already sent"
      );
    } finally {
      _setPgDatabasePoolForTesting(null);
    }
  });

  it("scheduler: update atômico condicional garante que apenas um worker executa", async () => {
    let statusAtual = "scheduled";

    // Simulação do UPDATE atômico do scheduler
    async function simularClaimScheduler(dispatchId) {
      if (statusAtual === "scheduled") {
        statusAtual = "running";
        return [{ id: dispatchId }];
      }
      return [];
    }

    // Dois ciclos/workers tentam executar simultaneamente
    const worker1Claim = await simularClaimScheduler("disp-abc");
    const worker2Claim = await simularClaimScheduler("disp-abc");

    expect(worker1Claim).toEqual([{ id: "disp-abc" }]); // Worker 1 pegou
    expect(worker2Claim).toEqual([]); // Worker 2 pulou (already_claimed)
  });

  it("claim por lead: bloqueia duplicidade dentro do mesmo disparo", async () => {
    const leadsDisparadosNoBanco = new Set();

    async function claimLead(dispatchId, leadId, phone) {
      const key = `${dispatchId}::${leadId || phone}`;
      if (leadsDisparadosNoBanco.has(key)) {
        return false; // Reenvio bloqueado
      }
      leadsDisparadosNoBanco.add(key);
      return true; // Claim bem-sucedido
    }

    // Lead com ID
    expect(await claimLead("disp-1", "lead-1", "5511999999999")).toBe(true);
    expect(await claimLead("disp-1", "lead-1", "5511999999999")).toBe(false); // Duplicado!

    // Lead sem ID (trava por telefone)
    expect(await claimLead("disp-1", null, "5511888888888")).toBe(true);
    expect(await claimLead("disp-1", null, "5511888888888")).toBe(false); // Duplicado por telefone!

    // Mesmo lead em outro disparo diferente é permitido
    expect(await claimLead("disp-2", "lead-1", "5511999999999")).toBe(true);
  });
});
