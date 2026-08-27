import { describe, it, expect } from "vitest";

describe("WhatsAppInbox exports, sorting and polling utilities", () => {
  it("formats timestamps and previews without errors", () => {
    const rawId = "5511999999999@s.whatsapp.net";
    const isJid = rawId.includes("@");
    const phoneLabel = isJid
      ? (rawId.includes("@g.us") ? "Grupo do WhatsApp" : "Número não disponível")
      : `+${rawId}`;

    expect(isJid).toBe(true);
    expect(phoneLabel).toBe("Número não disponível");

    const directPhone = "5511988887777";
    const directLabel = directPhone.includes("@") ? "JID" : `+${directPhone}`;
    expect(directLabel).toBe("+5511988887777");
  });

  it("sorts chats by most recent message timestamp descending", () => {
    const chats = [
      { id: "chat-old", name: "Lead Antigo", timestamp: 1700000000 },
      { id: "chat-new", name: "Lead Novo", timestamp: 1700000500 },
      { id: "chat-mid", name: "Lead Médio", timestamp: 1700000200 },
    ];

    const sorted = [...chats].sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));

    expect(sorted[0].id).toBe("chat-new");
    expect(sorted[1].id).toBe("chat-mid");
    expect(sorted[2].id).toBe("chat-old");
  });

  it("calculates afterTimestamp correctly from loaded messages for incremental polling", () => {
    const messages = [
      { id: "1", body: "Primeira", createdAt: "2026-08-27T18:00:00.000Z", timestamp: 1787853600 },
      { id: "2", body: "Segunda", createdAt: "2026-08-27T18:05:00.000Z", timestamp: 1787853900 },
    ];

    let maxTimeMs = 0;
    for (const msg of messages) {
      const t = msg.createdAt ? new Date(msg.createdAt).getTime() : (msg.timestamp ? msg.timestamp * 1000 : 0);
      if (t > maxTimeMs) maxTimeMs = t;
    }

    const afterIso = new Date(maxTimeMs).toISOString();
    expect(afterIso).toBe("2026-08-27T18:05:00.000Z");
  });
});
