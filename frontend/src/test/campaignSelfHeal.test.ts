// Bloco A — auto-cura do id de campanha orfao vindo do localStorage.
//
// Cobre os 5 criterios de aceite. Os mocks reproduzem a forma REAL do backend, lida em
// backend/src/services/httpInfra.js:14-25 (sendError) e usada em
// backend/src/domains/campaigns/routes.js:980-982:
//   res.status(404).json({ error: { code: "CAMPAIGN_NOT_FOUND", message: "Campaign not found" } })
// com o Content-Type que res.json() do Express emite: application/json; charset=utf-8.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CampaignApiError,
  readApiErrorDetails,
  saveCampaignWithSelfHeal,
  type Campaign,
  type CreateCampaignPayload,
} from "@/hooks/useCampanhas";

const STALE_ID = "3c1d4be2-0000-4000-8000-28afc5dbdc1d";
const NEW_ID = "9f0aa111-1111-4111-8111-111111111111";
const STORAGE_KEY = "vexo_campaignId_geracao-digital";

// Resposta de erro exatamente como o backend a emite (sendError -> res.status(n).json(body)).
function backendErrorResponse(status: number, code: string, message: string) {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function backendJsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

const payload = {
  clientId: "geracao-digital",
  name: "Campanha de teste",
} as unknown as CreateCampaignPayload;

// Mesma cadeia de useUpdateCampaign: readApiErrorDetails (codigo REAL, importado) -> CampaignApiError.
// Assim o elo critico "forma do backend -> error.code" e exercitado pelo parser de producao,
// nao por um CampaignApiError fabricado a mao.
async function updateViaFetch(args: { id: string }): Promise<Campaign> {
  const res = await fetch(`/api/campaigns/${args.id}`, { method: "PATCH" });
  if (!res.ok) {
    const { code, message } = await readApiErrorDetails(res, "Erro ao atualizar campanha");
    throw new CampaignApiError(`Erro ao atualizar campanha: ${res.status} ${message}`, code, res.status);
  }
  return (await res.json()).item as Campaign;
}

async function createViaFetch(body: CreateCampaignPayload): Promise<Campaign> {
  const res = await fetch("/api/campaigns", { method: "POST", body: JSON.stringify(body) });
  return (await res.json()).item as Campaign;
}

describe("auto-cura de campanha orfa (Bloco A)", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(STALE_ID));
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("1. PATCH 404 CAMPAIGN_NOT_FOUND dispara CREATE e conclui", async () => {
    const calls: Array<{ url: string; method: string }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, method: init.method as string });
        if (init.method === "PATCH") {
          return backendErrorResponse(404, "CAMPAIGN_NOT_FOUND", "Campaign not found");
        }
        return backendJsonResponse(200, { item: { id: NEW_ID, name: "Campanha de teste" } });
      })
    );

    const saved = await saveCampaignWithSelfHeal({
      editingCampaignId: STALE_ID,
      payload,
      updateCampaign: updateViaFetch,
      createCampaign: createViaFetch,
    });

    expect(saved.id).toBe(NEW_ID);
    expect(calls).toEqual([
      { url: `/api/campaigns/${STALE_ID}`, method: "PATCH" },
      { url: "/api/campaigns", method: "POST" },
    ]);
    expect(warnSpy).toHaveBeenCalledWith(
      "[campanha] auto-cura: id de edicao orfao, criando campanha nova",
      { staleCampaignId: STALE_ID }
    );
  });

  it("2. localStorage e limpo pelo callback de auto-cura", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) =>
        init.method === "PATCH"
          ? backendErrorResponse(404, "CAMPAIGN_NOT_FOUND", "Campaign not found")
          : backendJsonResponse(200, { item: { id: NEW_ID } })
      )
    );

    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) as string)).toBe(STALE_ID);

    await saveCampaignWithSelfHeal({
      editingCampaignId: STALE_ID,
      payload,
      updateCampaign: updateViaFetch,
      createCampaign: createViaFetch,
      onOrphanRecovered: () => window.localStorage.setItem(STORAGE_KEY, JSON.stringify(null)),
    });

    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) as string)).toBeNull();
  });

  it("3. 403 propaga e NAO vira CREATE", async () => {
    const createSpy = vi.fn(createViaFetch);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        backendErrorResponse(403, "FORBIDDEN_CLIENT_SCOPE", "You do not have access to this client")
      )
    );

    await expect(
      saveCampaignWithSelfHeal({
        editingCampaignId: STALE_ID,
        payload,
        updateCampaign: updateViaFetch,
        createCampaign: createSpy,
      })
    ).rejects.toThrow(/403/);

    expect(createSpy).not.toHaveBeenCalled();
  });

  it("4. erro de rede propaga e NAO vira CREATE", async () => {
    const createSpy = vi.fn(createViaFetch);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      })
    );

    await expect(
      saveCampaignWithSelfHeal({
        editingCampaignId: STALE_ID,
        payload,
        updateCampaign: updateViaFetch,
        createCampaign: createSpy,
      })
    ).rejects.toThrow("Failed to fetch");

    expect(createSpy).not.toHaveBeenCalled();
  });

  it("5. id valido faz PATCH e NAO CREATE", async () => {
    const createSpy = vi.fn(createViaFetch);
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        calls.push(init.method as string);
        return backendJsonResponse(200, { item: { id: STALE_ID, name: "Campanha de teste" } });
      })
    );

    const saved = await saveCampaignWithSelfHeal({
      editingCampaignId: STALE_ID,
      payload,
      updateCampaign: updateViaFetch,
      createCampaign: createSpy,
    });

    expect(saved.id).toBe(STALE_ID);
    expect(calls).toEqual(["PATCH"]);
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("bonus: 404 de rota inexistente (HTML) NAO auto-cura", async () => {
    const createSpy = vi.fn(createViaFetch);
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("<!DOCTYPE html><html>Cannot PATCH /api/campaigns/x</html>", {
            status: 404,
            headers: { "Content-Type": "text/html; charset=utf-8" },
          })
      )
    );

    await expect(
      saveCampaignWithSelfHeal({
        editingCampaignId: STALE_ID,
        payload,
        updateCampaign: updateViaFetch,
        createCampaign: createSpy,
      })
    ).rejects.toThrow(/404/);

    expect(createSpy).not.toHaveBeenCalled();
  });
});
