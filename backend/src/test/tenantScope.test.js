import { describe, expect, it, vi } from "vitest";
import { resolveRequiredAuthorizedClientId } from "../tenantScope.js";

function makeResponse() {
  return {
    headersSent: false,
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  };
}

describe("tenant scope enforcement", () => {
  it("blocks access when the requested tenant is outside the authorized tenant list", () => {
    const req = {
      authAccess: {
        role: "internal",
        scopeMode: "assigned_clients",
        clientIds: ["tenant-a"],
      },
    };
    const res = makeResponse();
    const sendError = vi.fn((response, status, code, message) => {
      response.status(status).json({ error: { code, message } });
    });
    const resolveAuthorizedClientId = vi.fn((request, response, requestedClientId) => {
      if (!request.authAccess.clientIds.includes(requestedClientId)) {
        sendError(response, 403, "FORBIDDEN_CLIENT_SCOPE", "You do not have access to this client");
        response.headersSent = true;
        return null;
      }
      return requestedClientId;
    });

    const clientId = resolveRequiredAuthorizedClientId({
      req,
      res,
      requestedClientId: "tenant-b",
      resolveAuthorizedClientId,
      sendError,
    });

    expect(clientId).toBeNull();
    expect(resolveAuthorizedClientId).toHaveBeenCalledWith(req, res, "tenant-b");
    expect(sendError).toHaveBeenCalledWith(
      res,
      403,
      "FORBIDDEN_CLIENT_SCOPE",
      "You do not have access to this client"
    );
    expect(sendError).toHaveBeenCalledTimes(1);
  });

  it("requires an explicit or derived tenant before continuing", () => {
    const req = { authAccess: { role: "internal", scopeMode: "all_clients", clientIds: [] } };
    const res = makeResponse();
    const sendError = vi.fn();
    const resolveAuthorizedClientId = vi.fn(() => null);

    const clientId = resolveRequiredAuthorizedClientId({
      req,
      res,
      requestedClientId: "",
      resolveAuthorizedClientId,
      sendError,
    });

    expect(clientId).toBeNull();
    expect(sendError).toHaveBeenCalledWith(
      res,
      400,
      "MISSING_CLIENT_SCOPE",
      "clientId is required for this operation"
    );
  });
});

import { resolveAuthorizedClientId } from "../services/tenant.js";

describe("resolveAuthorizedClientId strict tenant requirement", () => {
  it("logs [tenant-missing], responds with 400, and returns null (NEVER returns geracao-digital) when admin does not supply clientId", () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const req = {
      method: "GET",
      originalUrl: "/api/leads",
      authAccess: {
        role: "internal",
        isAdmin: true,
        clientId: null,
      },
    };
    const res = makeResponse();

    const clientId = resolveAuthorizedClientId(req, res, null);

    expect(clientId).toBeNull();
    expect(clientId).not.toBe("geracao-digital");
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: "MISSING_TENANT_ID",
          message: "Tenant (clientId) não informado na requisição",
        }),
      })
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[tenant-missing] rota=GET /api/leads credencial=admin erro=MISSING_TENANT_ID")
    );
    consoleSpy.mockRestore();
  });

  it("does not log [tenant-missing] and returns requestedClientId when explicitly provided", () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const req = {
      method: "POST",
      originalUrl: "/api/campaigns",
      authAccess: {
        role: "internal",
        isAdmin: true,
        clientId: null,
      },
    };
    const res = makeResponse();

    const clientId = resolveAuthorizedClientId(req, res, "tenant-custom");

    expect(clientId).toBe("tenant-custom");
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

