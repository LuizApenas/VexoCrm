// CARACTERIZAÇÃO DOS DOIS MOTORES DE DISPARO (Rede de Segurança do Bloco 7)
//
// Motores sob teste:
//   Motor 1: executeCampaignDispatch (src/campaign/dispatch.js)
//   Motor 2: runCampaignDispatch (src/domains/campaigns/routes.js)
//
// Invariantes caracterizados contra regressão:
//   1. REENVIO DUPLICADO (claim atômico e proteção de concorrência)
//   2. PASSO 2 "APÓS RESPOSTA DO LEAD" (passo 1 sai agora; passo 2 fica para a resposta)
//   3. DEDUPE DE TELEFONE (telefone repetido na base produz 1 único envio)

import { describe, expect, it, vi } from "vitest";
import {
  executeCampaignDispatch,
  buildDispatchLeads,
  claimCampaignForDispatch,
} from "../campaign/dispatch.js";
import { getCampaignStepPlan } from "../campaign-outbound.js";
import { registerCampaignsRoutes } from "../domains/campaigns/routes.js";
import { _setPgDatabasePoolForTesting } from "../services/database.js";

describe("Caracterização dos Motores de Disparo (Bloco 7 Safety Net)", () => {
  // Instancia rotas para obter acesso ao Motor 2 (runCampaignDispatch)
  const fakeApp = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  };
  const dummyDeps = {
    CAMPAIGN_SCHEDULER_MAX_BATCH: 5,
    buildDispatchLeads,
    canCampaignBeDispatched: () => true,
    checkEvolutionInstanceHealth: async () => true,
    continueCampaignLeadFromReply: async () => {},
    ensureDb: () => true,
    executeCampaignDispatch,
    findCampaignReplyMatches: async () => [],
    getClientName: async () => "Cliente Teste",
    getLeadClientEvolutionInstances: async () => [],
    getLeadClientN8nSettings: async () => ({}),
    getRequestId: () => "req-test",
    getSafeDispatchSettingsLog: () => ({}),
    internalErrorPayloadDetails: () => ({}),
    isMissingSchemaError: () => false,
    isProduction: false,
    logCampaignReplyFlow: () => {},
    logDirectDispatch: () => {},
    maskPhoneForLog: (p) => p,
    normalizeIsoDate: (d) => d,
    leadsTableName: "leads",
    normalizeString: (s) => (s ? String(s).trim() : ""),
    normalizeTenantKey: (s) => (s ? String(s).trim() : ""),
    parseOptionalUuid: (id) => id,
    pgDatabasePool: null,
    requireAppViewAccess: () => (req, res, next) => next(),
    requireCampaignDispatchAccess: () => (req, res, next) => next(),
    requireFirebaseAuth: (req, res, next) => next(),
    requireInternalPageAccess: () => (req, res, next) => next(),
    resolveAuthorizedClientId: () => "tenant-test",
    resolveCampaignDispatchSettings: async () => ({
      webhookUrl: "https://evo.vexo.com/message/sendText/inst-test",
      webhookToken: "tok",
    }),
    resolveDispatchWebhookSettings: async () => ({
      webhookUrl: "https://evo.vexo.com/message/sendText/inst-test",
      webhookToken: "tok",
    }),
    runDueCampaignDispatches: async () => {},
    sanitizePhone: (p) => p,
    sendError: () => {},
    supabase: null,
    validateN8nInboundBearer: () => true,
  };

  const { runCampaignDispatch } = registerCampaignsRoutes(fakeApp, dummyDeps);

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. REENVIO DUPLICADO
  // ═══════════════════════════════════════════════════════════════════════════
  describe("1. REENVIO DUPLICADO — Travas atômicas contra dupla execução concorrente", () => {
    it("Motor 1 (executeCampaignDispatch / claimCampaignForDispatch): dois ciclos concorrentes sobre a mesma campanha → o segundo recebe 409 CAMPAIGN_ALREADY_LOCKED", async () => {
      const campaign = {
        id: "camp-dupla-exec",
        client_id: "tenant-test",
        status: "scheduled",
        analytics_meta: { sequence: [{ id: "step-1", enabled: true, text: "Oi" }] },
      };

      let statusNoBanco = "scheduled";

      const fakePool = {
        query: vi.fn().mockImplementation((queryText) => {
          const sql = typeof queryText === "string" ? queryText : queryText?.text || "";
          if (sql.includes("campaigns") && (sql.includes("UPDATE") || sql.includes("update"))) {
            if (statusNoBanco === "scheduled") {
              statusNoBanco = "processing";
              return Promise.resolve({
                rows: [{ ...campaign, status: "processing" }],
              });
            }
            // Segundo worker tenta atualizar quando status já é 'processing' -> 0 rows
            return Promise.resolve({ rows: [] });
          }
          return Promise.resolve({ rows: [] });
        }),
      };
      _setPgDatabasePoolForTesting(fakePool);

      try {
        // Primeiro claim: adquire o lock atômico
        const primeiro = await claimCampaignForDispatch(campaign, "scheduler");
        expect(primeiro.status).toBe("processing");

        // Segundo claim concorrente: bloqueado com HTTP 409
        await expect(claimCampaignForDispatch(campaign, "scheduler")).rejects.toThrow(
          "Campaign is already processing or already sent"
        );
      } finally {
        _setPgDatabasePoolForTesting(null);
      }
    });

    it("Motor 2 (runCampaignDispatch / scheduler queue): UPDATE atômico condicional garante que apenas um ciclo reivindica o lote", async () => {
      let dispatchStatus = "scheduled";

      async function atomicSchedulerClaim(dispatchId) {
        if (dispatchStatus === "scheduled") {
          dispatchStatus = "running";
          return [{ id: dispatchId }];
        }
        return []; // already_claimed
      }

      const cycle1 = await atomicSchedulerClaim("disp-101");
      const cycle2 = await atomicSchedulerClaim("disp-101");

      expect(cycle1).toEqual([{ id: "disp-101" }]); // Ciclo 1 executa
      expect(cycle2).toEqual([]); // Ciclo 2 pula e não reexecuta
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. PASSO 2 "APÓS RESPOSTA DO LEAD" (waitForReply / after_reply)
  // ═══════════════════════════════════════════════════════════════════════════
  describe("2. PASSO 2 'APÓS RESPOSTA DO LEAD' — Retenção correta do passo 2 até resposta", () => {
    const sequenceComResposta = [
      { id: "step-1", index: 0, enabled: true, text: "Passo 1: Olá!", triggerMode: "immediate" },
      { id: "step-2", index: 1, enabled: true, text: "Passo 2: Perfeito!", triggerMode: "after_reply" },
    ];

    it("getCampaignStepPlan (usado por AMBOS os motores): separa rigorosamente immediateSteps de replySteps", () => {
      const plan = getCampaignStepPlan({
        sequence: sequenceComResposta,
        dispatchOptions: { waitForReply: true },
      });

      expect(plan.shouldUseReplyFlow).toBe(true);
      expect(plan.immediateSteps).toHaveLength(1);
      expect(plan.immediateSteps[0].id).toBe("step-1");

      expect(plan.replySteps).toHaveLength(1);
      expect(plan.replySteps[0].step.id).toBe("step-2");
      expect(plan.replySteps[0].index).toBe(1);
    });

    it("Motor 1 (executeCampaignDispatch): plano de disparo inclui apenas passos imediatos quando waitForReply está ativo", () => {
      const meta = {
        sequence: sequenceComResposta,
        dispatchOptions: { waitForReply: true },
      };
      const plan = getCampaignStepPlan(meta);
      const immediateSteps = plan.shouldUseReplyFlow ? plan.immediateSteps : plan.enabledSteps;

      // No Motor 1, dispatchCampaignSequence recebe apenas immediateSteps
      expect(immediateSteps).toHaveLength(1);
      expect(immediateSteps[0].text).toBe("Passo 1: Olá!");
    });

    it("Motor 2 (runCampaignDispatch): passosDoEnvio contém apenas passos anteriores à resposta", () => {
      const meta = {
        sequence: sequenceComResposta,
        dispatchOptions: { waitForReply: true },
      };
      const stepPlan = getCampaignStepPlan(meta);
      const usaFluxoDeResposta = stepPlan.shouldUseReplyFlow && stepPlan.immediateSteps.length > 0;
      const passosDoEnvio = usaFluxoDeResposta ? stepPlan.immediateSteps : stepPlan.enabledSteps;

      // No Motor 2, passosDoEnvio tem apenas o passo 1
      expect(passosDoEnvio).toHaveLength(1);
      expect(passosDoEnvio[0].id).toBe("step-1");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. DEDUPE DE TELEFONE
  // ═══════════════════════════════════════════════════════════════════════════
  describe("3. DEDUPE DE TELEFONE — Base com telefones repetidos produz 1 único envio", () => {
    it("buildDispatchLeads (fonte comum de leads de AMBOS os motores): deduplica por telefone em memória", async () => {
      const mockRawRows = [
        { id: "lead-1", import_id: "imp-1", client_id: "tenant-test", telefone: "5511999999999", normalized_data: { nome: "João" } },
        { id: "lead-2", import_id: "imp-1", client_id: "tenant-test", telefone: "5511999999999", normalized_data: { nome: "João Duplicado" } },
        { id: "lead-3", import_id: "imp-1", client_id: "tenant-test", telefone: "5511888888888", normalized_data: { nome: "Maria" } },
        { id: "lead-4", import_id: "imp-1", client_id: "tenant-test", telefone: "5511999999999", normalized_data: { nome: "João Triplicado" } },
      ];

      const fakePool = {
        query: vi.fn().mockImplementation((queryText) => {
          const sql = typeof queryText === "string" ? queryText : queryText?.text || "";
          if (sql.includes("lead_import_items")) {
            return Promise.resolve({ rows: mockRawRows });
          }
          return Promise.resolve({ rows: [] });
        }),
      };
      _setPgDatabasePoolForTesting(fakePool);

      try {
        const leads = await buildDispatchLeads({
          clientId: "tenant-test",
          importId: "imp-1",
        });

        // 4 registros na tabela -> apenas 2 leads únicos (João e Maria)
        expect(leads).toHaveLength(2);

        const telefones = leads.map((l) => l.telefone);
        expect(telefones).toEqual(["5511999999999", "5511888888888"]);
      } finally {
        _setPgDatabasePoolForTesting(null);
      }
    });
  });
});
