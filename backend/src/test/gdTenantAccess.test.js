import { describe, expect, it } from "vitest";
import { hasInternalPageAccess } from "../accessGuards.js";
import { requireInternalPageAccess } from "../access/middlewares.js";

function mockRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(payload) {
      res.body = payload;
      return res;
    },
  };
  return res;
}

function runMiddleware(middleware, req) {
  const res = mockRes();
  let calledNext = false;
  middleware(req, res, () => {
    calledNext = true;
  });
  return { calledNext, statusCode: res.statusCode, body: res.body };
}

describe("ITEM C: Módulos GD vêm do tenant, sem revokes de usuário", () => {
  it("usuário interno do tenant geracao-digital acessa propostas-gd se tiver a página", () => {
    const gdUser = {
      role: "internal",
      isAdmin: false,
      clientId: "geracao-digital",
      clientIds: ["geracao-digital"],
      internalPages: ["dashboard", "propostas-gd"],
      permissions: [],
    };

    expect(hasInternalPageAccess(gdUser, "propostas-gd")).toBe(true);

    const mw = requireInternalPageAccess("propostas-gd");
    const result = runMiddleware(mw, { authAccess: gdUser });
    expect(result.calledNext).toBe(true);
  });

  it("usuário interno de OUTRO tenant (ex: sonhare) NÃO acessa propostas-gd mesmo que a página estivesse na lista", () => {
    const sonhareUser = {
      role: "internal",
      isAdmin: false,
      clientId: "sonhare",
      clientIds: ["sonhare"],
      internalPages: ["dashboard", "propostas-gd"],
      permissions: [],
    };

    expect(hasInternalPageAccess(sonhareUser, "propostas-gd")).toBe(false);

    const mw = requireInternalPageAccess("propostas-gd");
    const result = runMiddleware(mw, { authAccess: sonhareUser });
    expect(result.calledNext).toBe(false);
    expect(result.statusCode).toBe(403);
    expect(result.body?.error?.code).toBe("FORBIDDEN");
  });

  it("administrador vexo acessa propostas-gd em qualquer tenant", () => {
    const adminUser = {
      role: "internal",
      isAdmin: true,
      clientId: "sonhare",
      internalPages: [],
      permissions: [],
    };

    expect(hasInternalPageAccess(adminUser, "propostas-gd")).toBe(true);

    const mw = requireInternalPageAccess("propostas-gd");
    const result = runMiddleware(mw, { authAccess: adminUser });
    expect(result.calledNext).toBe(true);
  });
});
