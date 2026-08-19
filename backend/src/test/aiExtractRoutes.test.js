// backend/src/test/aiExtractRoutes.test.js
import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerAiExtractRoutes } from "../domains/leads/aiExtractRoutes.js";

describe("POST /api/leads/ai-extract", () => {
  let handlers = {};
  const app = {
    post: (path, ...rest) => {
      handlers[`POST ${path}`] = rest[rest.length - 1];
    },
  };

  const deps = {
    requireFirebaseAuth: (req, res, next) => next?.(),
    requireAppViewAccess: () => (req, res, next) => next?.(),
  };

  beforeEach(() => {
    handlers = {};
    registerAiExtractRoutes(app, deps);
  });

  it("retorna 400 se rawText estiver ausente ou vazio", async () => {
    const handler = handlers["POST /api/leads/ai-extract"];
    expect(handler).toBeDefined();

    const req = { body: { rawText: "" } };
    let statusSent = null;
    let jsonSent = null;

    const res = {
      status: (code) => {
        statusSent = code;
        return {
          json: (data) => {
            jsonSent = data;
          },
        };
      },
      json: (data) => {
        jsonSent = data;
      },
    };

    await handler(req, res);
    expect(statusSent).toBe(400);
    expect(jsonSent?.success).toBe(false);
    expect(jsonSent?.error?.code).toBe("MISSING_RAW_TEXT");
  });

  it("retorna 503 se GROQ_API_KEY nao estiver configurada", async () => {
    const prevKey = process.env.GROQ_API_KEY;
    delete process.env.GROQ_API_KEY;

    const handler = handlers["POST /api/leads/ai-extract"];
    const req = { body: { rawText: "Nome: Carlos, Tel: 34999998888" } };
    let statusSent = null;
    let jsonSent = null;

    const res = {
      status: (code) => {
        statusSent = code;
        return {
          json: (data) => {
            jsonSent = data;
          },
        };
      },
    };

    await handler(req, res);
    expect(statusSent).toBe(503);
    expect(jsonSent?.error?.code).toBe("GROQ_DISABLED");

    if (prevKey) process.env.GROQ_API_KEY = prevKey;
  });
});
