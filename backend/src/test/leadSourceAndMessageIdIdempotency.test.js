import { describe, it, expect, vi, beforeEach } from "vitest";
import { normalizeLeadSource, CANONICAL_LEAD_SOURCES } from "../chatbot-ai-engine.js";
import { resolveMessageId, shouldIgnoreInboundEvent, _resetInboundGuard } from "../services/inboundGuard.js";
import { createLeadMessaging } from "../domains/shared/leadMessaging.js";

describe("Defeito 1: Normalização Canônica de lead_source e Preservação", () => {
  it("valores canônicos passam intactos", () => {
    for (const source of CANONICAL_LEAD_SOURCES) {
      expect(normalizeLeadSource(source)).toBe(source);
    }
  });

  it("mapeia variações de indicação com acento e caixa alta", () => {
    expect(normalizeLeadSource("Indicação")).toBe("indicacao");
    expect(normalizeLeadSource("INDICAÇÃO")).toBe("indicacao");
    expect(normalizeLeadSource("indicacao")).toBe("indicacao");
    expect(normalizeLeadSource("Amigo")).toBe("indicacao");
    expect(normalizeLeadSource("Recomendação")).toBe("indicacao");
    expect(normalizeLeadSource("Referral")).toBe("indicacao");
  });

  it("mapeia anúncios e tráfego pago para 'trafego_pago'", () => {
    expect(normalizeLeadSource("Google Ads")).toBe("trafego_pago");
    expect(normalizeLeadSource("Facebook Ads")).toBe("trafego_pago");
    expect(normalizeLeadSource("Meta Ads")).toBe("trafego_pago");
    expect(normalizeLeadSource("Instagram Ads")).toBe("trafego_pago");
    expect(normalizeLeadSource("TikTok Ads")).toBe("trafego_pago");
    expect(normalizeLeadSource("Anúncio")).toBe("trafego_pago");
    expect(normalizeLeadSource("Tráfego Pago")).toBe("trafego_pago");
  });

  it("mapeia WhatsApp Ads / Click to WhatsApp para 'whatsapp_ads'", () => {
    expect(normalizeLeadSource("WhatsApp Ads")).toBe("whatsapp_ads");
    expect(normalizeLeadSource("Click to WhatsApp")).toBe("whatsapp_ads");
    expect(normalizeLeadSource("CTWA")).toBe("whatsapp_ads");
    expect(normalizeLeadSource("Zap Ads")).toBe("whatsapp_ads");
  });

  it("mapeia canais orgânicos para 'organico'", () => {
    expect(normalizeLeadSource("WhatsApp")).toBe("organico");
    expect(normalizeLeadSource("Instagram")).toBe("organico");
    expect(normalizeLeadSource("TikTok")).toBe("organico");
    expect(normalizeLeadSource("Facebook")).toBe("organico");
    expect(normalizeLeadSource("Formulário")).toBe("organico");
    expect(normalizeLeadSource("Site")).toBe("organico");
    expect(normalizeLeadSource("Busca Orgânica")).toBe("organico");
  });

  it("mapeia campanha para 'campanha'", () => {
    expect(normalizeLeadSource("Campanha")).toBe("campanha");
    expect(normalizeLeadSource("Campanha Dia das Mães")).toBe("campanha");
  });

  it("REGRA DURA: valor desconhecido resolve para 'outro' e loga warn", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(normalizeLeadSource("Panfleto")).toBe("outro");
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Panfleto"));
    warnSpy.mockRestore();
  });

  it("valores nulos ou vazios retornam null", () => {
    expect(normalizeLeadSource(null)).toBeNull();
    expect(normalizeLeadSource(undefined)).toBeNull();
    expect(normalizeLeadSource("")).toBeNull();
    expect(normalizeLeadSource("   ")).toBeNull();
  });
});

describe("Defeito 2: Extração de waMessageId e Idempotência", () => {
  beforeEach(() => _resetInboundGuard());

  it("extrai messageId de todos os formatos de payload da Evolution", () => {
    expect(resolveMessageId({ data: { key: { id: "MSG_ID_1" } } })).toBe("MSG_ID_1");
    expect(resolveMessageId({ data: [{ key: { id: "MSG_ID_2" } }] })).toBe("MSG_ID_2");
    expect(resolveMessageId({ data: { messages: [{ key: { id: "MSG_ID_3" } }] } })).toBe("MSG_ID_3");
    expect(resolveMessageId({ key: { id: "MSG_ID_4" } })).toBe("MSG_ID_4");
    expect(resolveMessageId({ messageId: "MSG_ID_5" })).toBe("MSG_ID_5");
    expect(resolveMessageId({ data: { messageId: "MSG_ID_6" } })).toBe("MSG_ID_6");
    expect(resolveMessageId({ id: "MSG_ID_7" })).toBe("MSG_ID_7");
  });

  it("loga warn se messageId for vazio em evento messages.upsert", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = shouldIgnoreInboundEvent({ event: "messages.upsert", data: {} });
    expect(res.ignore).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[inbound-guard] messageId vazio"),
      expect.any(String)
    );
    warnSpy.mockRestore();
  });

  it("appendLeadMessage grava wa_message_id e retenta com campaign_id=null se FK falhar", async () => {
    let insertCalls = [];
    const createChain = () => {
      const chain = {
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        gte: vi.fn(() => chain),
        order: vi.fn(() => chain),
        limit: vi.fn(() => chain),
        maybeSingle: vi.fn(() => Promise.resolve({ data: { id: "lead-1", source_campaign_id: "dead-campaign-uuid" }, error: null })),
        insert: vi.fn((payload) => {
          insertCalls.push(payload);
          if (payload.campaign_id === "dead-campaign-uuid") {
            return Promise.resolve({ error: { code: "23503", message: "violates foreign key constraint lead_messages_campaign_id_fkey" } });
          }
          return Promise.resolve({ data: [{ id: "msg-1" }], error: null });
        }),
        update: vi.fn(() => chain),
      };
      return chain;
    };

    const mockSupabase = {
      from: vi.fn(() => createChain()),
    };

    const { appendLeadMessage } = createLeadMessaging({
      supabase: mockSupabase,
      normalizeString: (s) => String(s || "").trim(),
      leadsTableName: () => "leads",
      isMissingSchemaError: () => false,
    });

    const result = await appendLeadMessage({
      clientId: "geracao-digital",
      phone: "553497817660",
      senderType: "lead",
      direction: "inbound",
      messageText: "Olá",
      campaignId: "dead-campaign-uuid",
      waMessageId: "WA_3EB0123456",
    });

    expect(insertCalls.length).toBe(2);
    // Primeiro insert tentou com a FK
    expect(insertCalls[0].campaign_id).toBe("dead-campaign-uuid");
    expect(insertCalls[0].wa_message_id).toBe("WA_3EB0123456");
    // Segundo insert retentou com campaign_id = null
    expect(insertCalls[1].campaign_id).toBeNull();
    expect(insertCalls[1].wa_message_id).toBe("WA_3EB0123456");
    expect(result.campaignId).toBeNull();
  });
});
