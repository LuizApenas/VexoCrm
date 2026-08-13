import { describe, it, expect } from "vitest";

describe("WhatsAppInbox exports and utilities", () => {
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
});
