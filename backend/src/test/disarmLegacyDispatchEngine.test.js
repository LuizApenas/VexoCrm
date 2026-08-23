import { describe, expect, it, vi } from "vitest";
import { startCampaignScheduler, stopCampaignScheduler } from "../campaign/scheduler.js";
import { registerCampaignsRoutes } from "../domains/campaigns/routes.js";

describe("Desativação do Motor A (executeCampaignDispatch) e Isolamento de Segurança", () => {
  it("startCampaignScheduler não arma timers no event loop e permanece desativado", () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const setTimeoutSpy = vi.spyOn(global, "setTimeout");
    const setIntervalSpy = vi.spyOn(global, "setInterval");

    startCampaignScheduler();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[campaign-scheduler] disabled: scheduler legado de campanhas desarmado")
    );
    expect(setTimeoutSpy).not.toHaveBeenCalled();
    expect(setIntervalSpy).not.toHaveBeenCalled();

    expect(() => stopCampaignScheduler()).not.toThrow();

    consoleSpy.mockRestore();
    setTimeoutSpy.mockRestore();
    setIntervalSpy.mockRestore();
  });

  it("POST /api/campaigns/:id/trigger responde 410 CAMPAIGN_TRIGGER_DEPRECATED e não executa disparo direto", async () => {
    const postRoutes = {};
    const fakeApp = {
      get: vi.fn(),
      post: vi.fn((path, ...handlers) => {
        postRoutes[path] = handlers[handlers.length - 1];
      }),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    };

    const dummyDeps = {
      CAMPAIGN_SCHEDULER_MAX_BATCH: 5,
      buildDispatchLeads: vi.fn(),
      canCampaignBeDispatched: () => true,
      checkEvolutionInstanceHealth: async () => true,
      continueCampaignLeadFromReply: async () => {},
      ensureDb: () => true,
      executeCampaignDispatch: vi.fn(),
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
      sendError: vi.fn((res, status, code, message) => {
        res.status(status).json({ error: { code, message } });
      }),
      supabase: null,
      validateN8nInboundBearer: () => true,
    };

    registerCampaignsRoutes(fakeApp, dummyDeps);

    const triggerHandler = postRoutes["/api/campaigns/:id/trigger"];
    expect(triggerHandler).toBeDefined();

    const req = { params: { id: "camp-123" } };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    await triggerHandler(req, res);

    expect(dummyDeps.sendError).toHaveBeenCalledWith(
      res,
      410,
      "CAMPAIGN_TRIGGER_DEPRECATED",
      expect.stringContaining("Endpoint legado de disparo direto desativado")
    );
    expect(dummyDeps.executeCampaignDispatch).not.toHaveBeenCalled();
  });
});
