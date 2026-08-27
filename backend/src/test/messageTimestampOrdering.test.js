import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { resolveMessageContent } from "../chatbot-ai-engine.js";

describe("Separação de message_timestamp e created_at em lead_messages", () => {
  it("resolveMessageContent extrai messageTimestamp do payload da Evolution em ISO string", async () => {
    const payload = {
      event: "messages.upsert",
      data: {
        key: { id: "wa-12345", fromMe: false, remoteJid: "5534997817660@s.whatsapp.net" },
        messageTimestamp: 1724709240, // 26/08/2026 18:54:00 GMT
        message: { conversation: "Ola, tudo bem?" },
      },
    };

    const res = await resolveMessageContent(payload);
    expect(res.text).toBe("Ola, tudo bem?");
    expect(res.waMessageId).toBe("wa-12345");
    expect(res.messageTimestamp).toBe(new Date(1724709240 * 1000).toISOString());
  });

  it("resolveMessageContent lida com messageTimestamp nulo ou ausente sem quebrar", async () => {
    const payload = {
      event: "messages.upsert",
      data: {
        key: { id: "wa-999" },
        message: { conversation: "Texto sem timestamp" },
      },
    };

    const res = await resolveMessageContent(payload);
    expect(res.text).toBe("Texto sem timestamp");
    expect(res.messageTimestamp).toBeNull();
  });

  it("Migration 20260827000000_add_lead_messages_message_timestamp.sql existe e possui sentinela forte em migrate.js", () => {
    const migrateSource = readFileSync(resolve("src/migrate.js"), "utf8");
    expect(migrateSource).toContain("20260827000000_add_lead_messages_message_timestamp.sql");
    expect(migrateSource).toContain("column_name='message_timestamp'");
    expect(migrateSource).toContain("indexname='idx_lead_messages_message_timestamp'");
  });

  it("Rotas /api/whatsapp/chats e /api/whatsapp/messages ordenam por effective_timestamp com fallback para created_at", () => {
    const chatbotRoutesSource = readFileSync(resolve("src/domains/chatbot/routes.js"), "utf8");
    expect(chatbotRoutesSource).toContain("COALESCE(message_timestamp, delivered_at, created_at)");
    expect(chatbotRoutesSource).toContain("effective_timestamp DESC NULLS LAST");
  });

  it("Rota /api/whatsapp/messages suporta cursor de paginação beforeTimestamp e retorna hasMore / oldestTimestamp", () => {
    const chatbotRoutesSource = readFileSync(resolve("src/domains/chatbot/routes.js"), "utf8");
    expect(chatbotRoutesSource).toContain("req.query.beforeTimestamp");
    expect(chatbotRoutesSource).toContain("COALESCE(message_timestamp, delivered_at, created_at) <");
    expect(chatbotRoutesSource).toContain("hasMore: result.rows.length === limit");
    expect(chatbotRoutesSource).toContain("oldestTimestamp");
  });
});
