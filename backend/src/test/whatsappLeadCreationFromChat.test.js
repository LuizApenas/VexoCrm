import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import express from "express";
import http from "http";
import { registerChatbotRoutes } from "../domains/chatbot/routes.js";

describe("Criação de Leads a partir de Conversas do WhatsApp (Chat Inbox)", () => {
  let server;
  let baseUrl;
  let mockDb;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());

    const deps = {
      appendLeadMessage: vi.fn(),
      classifyConversation: vi.fn(),
      ensureDb: () => true,
      ensureDbClient: vi.fn(),
      findCampaignReplyMatches: vi.fn(),
      normalizeString: (s) => (s ? String(s).trim() : ""),
      normalizeTenantKey: (k) => k,
      pgDatabasePool: {
        query: (text, params) => mockDb.query(text, params),
      },
      requireAppViewAccess: () => (_req, _res, next) => next(),
      requireFirebaseAuth: (_req, res, next) => {
        _req.user = { client_id: "test-tenant", role: "admin" };
        next();
      },
      resolveAuthorizedClientId: (_req, _res, cid) => cid || "test-tenant",
      resolveDispatchWebhookSettings: async () => ({}),
      resolveInboundDispatchSettings: async () => ({}),
      sanitizePhone: (p) => String(p || "").replace(/\D/g, ""),
      sendError: (res, status, code, msg) => res.status(status).json({ error: code, message: msg }),
      supabase: null,
      validateLeadsOutlierRecord: () => true,
      validateN8nInboundBearer: () => true,
    };

    registerChatbotRoutes(app, deps);

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://localhost:${port}`;
  });

  afterAll(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it("POST /api/whatsapp/chats/create-lead cria lead com sucesso no tenant", async () => {
    mockDb = {
      query: vi.fn().mockImplementation(async (queryText, params) => {
        if (queryText.includes("FROM public.leads")) {
          return {
            rows: [
              {
                id: "lead-new-123",
                client_id: "test-tenant",
                nome: "Cliente WhatsApp",
                telefone: "5511999999999",
                origem: "inbound",
                status: "NOVO",
              },
            ],
          };
        }
        if (queryText.includes("FROM public.lead_messages")) {
          return { rows: [] };
        }
        if (queryText.includes("INSERT INTO public.leads") || queryText.includes("INSERT INTO leads")) {
          return {
            rows: [
              {
                id: "lead-new-123",
                client_id: "test-tenant",
                nome: "Cliente WhatsApp",
                telefone: "5511999999999",
              },
            ],
          };
        }
        return { rows: [] };
      }),
    };

    const res = await fetch(`${baseUrl}/api/whatsapp/chats/create-lead`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "5511999999999", name: "Cliente WhatsApp" }),
    });

    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.lead.id).toBe("lead-new-123");
    expect(json.lead.nome).toBe("Cliente WhatsApp");
  });

  it("POST /api/whatsapp/chats/create-leads-bulk cadastra lista de contatos em lote", async () => {
    mockDb = {
      query: vi.fn().mockImplementation(async (queryText, params) => {
        if (queryText.includes("FROM public.leads")) {
          return { rows: [] };
        }
        if (queryText.includes("FROM public.lead_messages")) {
          return { rows: [] };
        }
        if (queryText.includes("INSERT INTO public.leads") || queryText.includes("INSERT INTO leads")) {
          return {
            rows: [
              {
                id: "lead-mock",
                client_id: "test-tenant",
              },
            ],
          };
        }
        return { rows: [] };
      }),
    };

    const res = await fetch(`${baseUrl}/api/whatsapp/chats/create-leads-bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [
          { phone: "5511999990001", name: "Lead 1" },
          { phone: "5511999990002", name: "Lead 2" },
        ],
      }),
    });

    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.count).toBe(2);
  });
});
