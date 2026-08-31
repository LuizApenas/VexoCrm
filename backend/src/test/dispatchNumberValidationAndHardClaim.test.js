import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { validateWhatsappNumbersWithCache, checkWhatsappNumbers } from "../services/evolution.js";

describe("Validação Prévia de Números WhatsApp e Garantia Dura Anti-Reenvio", () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("1. validateWhatsappNumbersWithCache consulta cache de 30 dias e só chama a Evolution para números novos", async () => {
    const cachedRows = [
      { phone: "5534997817660", exists_whatsapp: true, validated_at: new Date() },
      { phone: "5533984583535", exists_whatsapp: false, validated_at: new Date() },
    ];

    const mockPool = {
      query: vi.fn().mockImplementation(async (sql, params) => {
        const sqlStr = String(sql);
        if (sqlStr.includes("SELECT phone, exists_whatsapp, validated_at")) {
          return { rows: cachedRows };
        }
        if (sqlStr.includes("INSERT INTO public.whatsapp_number_validations")) {
          return { rowCount: 1 };
        }
        return { rows: [] };
      }),
    };

    let fetchCalled = false;
    global.fetch = vi.fn().mockImplementation(async () => {
      fetchCalled = true;
      return {
        ok: true,
        status: 200,
        json: async () => [{ number: "5534997719779", exists: true, jid: "5534997719779@s.whatsapp.net" }],
        text: async () => "",
      };
    });

    const phones = ["5534997817660", "5533984583535", "5534997719779"];
    const resultMap = await validateWhatsappNumbersWithCache({
      pool: mockPool,
      webhookUrl: "https://evolution.teste/message/sendText/instancia-1",
      webhookToken: "token-123",
      phones,
    });

    expect(resultMap.get("5534997817660")?.exists).toBe(true);
    expect(resultMap.get("5534997817660")?.cached).toBe(true);
    expect(resultMap.get("5533984583535")?.exists).toBe(false);
    expect(resultMap.get("5533984583535")?.cached).toBe(true);

    // O terceiro número não estava em cache, então bateu na Evolution
    expect(fetchCalled).toBe(true);
    expect(resultMap.get("5534997719779")?.exists).toBe(true);
  });

  it("2. validateWhatsappNumbersWithCache não trava o lote se a Evolution API retornar erro HTTP ou timeout", async () => {
    const mockPool = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    });

    const phones = ["5534997817660", "5534997719779"];
    const resultMap = await validateWhatsappNumbersWithCache({
      pool: mockPool,
      webhookUrl: "https://evolution.teste/message/sendText/instancia-1",
      webhookToken: "token-123",
      phones,
    });

    // Em caso de falha da API da Evolution, assume exists: true para não bloquear o envio dos leads
    expect(resultMap.get("5534997817660")?.exists).toBe(true);
    expect(resultMap.get("5534997817660")?.validated).toBe(false);
    expect(resultMap.get("5534997719779")?.exists).toBe(true);
  });

  it("3. checkWhatsappNumbers formata corretamente o payload e endpoint da Evolution v2", async () => {
    let capturedUrl = "";
    let capturedBody = null;
    let capturedHeaders = null;

    global.fetch = vi.fn().mockImplementation(async (url, init) => {
      capturedUrl = String(url);
      capturedBody = JSON.parse(init.body);
      capturedHeaders = init.headers;
      return {
        ok: true,
        status: 200,
        json: async () => [
          { number: "5534997817660", exists: true, jid: "5534997817660@s.whatsapp.net" },
          { number: "5533984583535", exists: false },
        ],
        text: async () => "",
      };
    });

    const { results, error } = await checkWhatsappNumbers({
      webhookUrl: "https://evolution.teste/message/sendText/instancia-teste",
      webhookToken: "apikey-123",
      numbers: ["+55 (34) 99781-7660", "5533984583535"],
    });

    expect(error).toBeNull();
    expect(capturedUrl).toBe("https://evolution.teste/chat/whatsappNumbers/instancia-teste");
    expect(capturedHeaders.apikey).toBe("apikey-123");
    expect(capturedBody.numbers).toEqual(["5534997817660", "5533984583535"]);
    expect(results).toHaveLength(2);
    expect(results[0].exists).toBe(true);
    expect(results[1].exists).toBe(false);
  });
});
