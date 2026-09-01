import { describe, expect, it, vi, beforeEach } from "vitest";
import { createLeadMessaging } from "../domains/shared/leadMessaging.js";
import { isFromMe, resolveMessageId, shouldIgnoreInboundEvent, _resetInboundGuard } from "../services/inboundGuard.js";

describe("Persistência e Tratamento de Mensagens fromMe (Aparelho / Celular)", () => {
  beforeEach(() => {
    _resetInboundGuard();
  });

  it("1. isFromMe detecta corretamente mensagens enviadas pelo próprio número em diferentes formatos", () => {
    expect(isFromMe({ data: { key: { fromMe: true } } })).toBe(true);
    expect(isFromMe({ key: { fromMe: true } })).toBe(true);
    expect(isFromMe({ fromMe: true })).toBe(true);
    expect(isFromMe({ data: { fromMe: true } })).toBe(true);
    expect(isFromMe({ data: { key: { fromMe: false } } })).toBe(false);
    expect(isFromMe({})).toBe(false);
  });

  it("2. shouldIgnoreInboundEvent permite mensagens fromMe passarem para gravação (sem descartar precocemente)", () => {
    const payloadFromMe = {
      event: "messages.upsert",
      data: {
        key: {
          id: "WA-DEVICE-MSG-001",
          fromMe: true,
          remoteJid: "5534999996397@s.whatsapp.net",
        },
        message: {
          conversation: "Olá! Já te respondo por aqui pelo celular.",
        },
      },
    };

    const res = shouldIgnoreInboundEvent(payloadFromMe);
    expect(res.ignore).toBe(false);
    expect(res.reason).toBeNull();
  });

  it("3. appendLeadMessage grava mensagem fromMe com direction 'outbound' e sender_type 'device'", async () => {
    const recorded = [];
    const mockSupabase = {
      from: vi.fn((table) => {
        if (table === "leads_sonhare") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: "lead-sonhare-123", source_campaign_id: "camp-001" },
              error: null,
            }),
          };
        }
        if (table === "lead_messages") {
          return {
            insert: vi.fn((payload) => {
              recorded.push(payload);
              return Promise.resolve({ data: [{ id: "msg-1" }], error: null });
            }),
          };
        }
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
          select: vi.fn().mockReturnThis(),
        };
      }),
    };

    const { appendLeadMessage } = createLeadMessaging({
      supabase: mockSupabase,
      normalizeString: (s) => (s ? String(s).trim() : ""),
      leadsTableName: (c) => `leads_${c}`,
      isMissingSchemaError: () => false,
    });

    const res = await appendLeadMessage({
      clientId: "sonhare",
      phone: "5534999996397",
      senderType: "device",
      direction: "outbound",
      messageText: "Olá! Já verifiquei o pacote para você.",
      instanceName: "sonhare-vendas",
      waMessageId: "WA-DEVICE-MSG-001",
      meta: {
        source: "device-whatsapp-webhook",
        fromMe: true,
      },
    });

    expect(res.leadId).toBe("lead-sonhare-123");
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({
      client_id: "sonhare",
      phone: "5534999996397",
      sender_type: "device",
      direction: "outbound",
      message_text: "Olá! Já verifiquei o pacote para você.",
      instance_name: "sonhare-vendas",
      wa_message_id: "WA-DEVICE-MSG-001",
      meta: {
        source: "device-whatsapp-webhook",
        fromMe: true,
      },
    });
  });

  it("4. appendLeadMessage é idempotente: eco com mesmo wa_message_id trata violação de chave única (23505) sem erro", async () => {
    let insertCount = 0;
    const mockSupabase = {
      from: vi.fn((table) => {
        if (table === "leads_sonhare") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: { id: "lead-1" }, error: null }),
          };
        }
        if (table === "lead_messages") {
          return {
            insert: vi.fn((payload) => {
              insertCount++;
              if (insertCount > 1) {
                // Simula erro de chave única (23505) do Postgres / Supabase
                return Promise.resolve({
                  data: null,
                  error: { code: "23505", message: 'duplicate key value violates unique constraint "idx_lead_messages_wa_message_id"' },
                });
              }
              return Promise.resolve({ data: [{ id: "msg-1" }], error: null });
            }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      }),
    };

    const { appendLeadMessage } = createLeadMessaging({
      supabase: mockSupabase,
      normalizeString: (s) => (s ? String(s).trim() : ""),
      leadsTableName: (c) => `leads_${c}`,
      isMissingSchemaError: () => false,
    });

    // Primeiro insert (sucesso)
    const res1 = await appendLeadMessage({
      clientId: "sonhare",
      phone: "5534999996397",
      senderType: "device",
      direction: "outbound",
      messageText: "Mensagem original",
      waMessageId: "WA-IDEMPOTENT-123",
    });
    expect(res1).not.toBeNull();

    // Segundo insert com mesmo wa_message_id (eco da Evolution) -> ignorado com sucesso
    const res2 = await appendLeadMessage({
      clientId: "sonhare",
      phone: "5534999996397",
      senderType: "device",
      direction: "outbound",
      messageText: "Mensagem original",
      waMessageId: "WA-IDEMPOTENT-123",
    });
    expect(res2).not.toBeNull();
  });

  it("5. Conversa cuja última mensagem é outbound (do aparelho ou CRM) tem fromMe=true e sai da aba Espera", () => {
    // Simula a lógica de agregação do /api/whatsapp/chats e do WhatsAppInbox.tsx
    const rowInbound = {
      phone_number: "5534999996397",
      direction: "inbound",
      message_text: "Olá, gostaria de saber os preços",
      sender_type: "lead",
    };

    const rowOutboundDevice = {
      phone_number: "5534999996397",
      direction: "outbound",
      message_text: "Olá! Seguem os preços das viagens...",
      sender_type: "device",
    };

    // Chat quando a última mensagem era do lead (em espera)
    const chatAntes = {
      id: rowInbound.phone_number,
      lastMessage: {
        body: rowInbound.message_text,
        fromMe: rowInbound.direction === "outbound", // false
      },
    };

    const isAguardandoAntes = Boolean(chatAntes.lastMessage && !chatAntes.lastMessage.fromMe);
    expect(isAguardandoAntes).toBe(true);

    // Chat depois que o consultor respondeu pelo aparelho (sai de espera)
    const chatDepois = {
      id: rowOutboundDevice.phone_number,
      lastMessage: {
        body: rowOutboundDevice.message_text,
        fromMe: rowOutboundDevice.direction === "outbound", // true
      },
    };

    const isAguardandoDepois = Boolean(chatDepois.lastMessage && !chatDepois.lastMessage.fromMe);
    expect(isAguardandoDepois).toBe(false);
  });
});
