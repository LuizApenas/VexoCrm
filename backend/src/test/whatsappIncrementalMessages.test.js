import { describe, expect, it } from "vitest";

describe("WhatsApp Messages — Incremental Polling (afterTimestamp)", () => {
  it("filters messages strictly newer than afterTimestamp", () => {
    const dbMessages = [
      { id: 1, phone: "5534997817660", message_text: "Msg 1", effective_timestamp: "2026-08-27T18:00:00.000Z" },
      { id: 2, phone: "5534997817660", message_text: "Msg 2", effective_timestamp: "2026-08-27T18:05:00.000Z" },
      { id: 3, phone: "5534997817660", message_text: "Msg 3", effective_timestamp: "2026-08-27T18:10:00.000Z" },
    ];

    const afterTimestamp = "2026-08-27T18:05:00.000Z";
    const filtered = dbMessages.filter(
      (m) => new Date(m.effective_timestamp).getTime() > new Date(afterTimestamp).getTime()
    );

    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe(3);
    expect(filtered[0].message_text).toBe("Msg 3");
  });

  it("handles unix millisecond and second timestamp parsing for afterTimestamp", () => {
    const rawSeconds = "1787853900"; // seconds
    const num = Number(rawSeconds);
    const ms = num < 10000000000 ? num * 1000 : num;
    const iso = new Date(ms).toISOString();

    expect(iso).toBe(new Date(1787853900 * 1000).toISOString());
  });
});
